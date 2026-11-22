import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  FolderOpen,
  RefreshCw,
  Ruler,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { clampNumber } from '../types';
import { readFileAsDataUrl } from '../services/avatarPhotoService';
import {
  downloadDriveImageAsDataUrl,
  openGoogleDrivePicker,
} from '../services/googleDriveService';
import {
  formatInchesDetailed,
  PreparedWallPhoto,
  prepareWallPhotoForAnalysis,
  requestAiWallHeightEstimate,
  WALL_REFERENCE_PRESETS,
  WallHeightAiEstimate,
} from '../services/wallHeightEstimatorService';

interface WallPhotoHeightEstimatorModalProps {
  isOpen: boolean;
  childName: string;
  ageMonths: number;
  accessToken: string | null;
  onClose: () => void;
  onApplyEstimatedInches: (result: {
    inches: number;
    heightCm: number;
    sourceLabel: string;
    savedToAlbum?: boolean;
  }) => void;
  onSaveCapturedPhoto?: (params: {
    dataUrl: string;
    kind: 'wall';
    caption: string;
    heightCmOverride?: number;
    existingPhotoId?: string | null;
  }) => Promise<string | null> | void;
}

type CaptureViewMode = 'workspace' | 'camera';
type DragHandleId = 'crown' | 'heel' | 'refTop' | 'refBottom' | null;
type SelectedResultSource = 'ai' | 'ruler';

const GENERAL_WALL_PRESETS = WALL_REFERENCE_PRESETS.filter(
  (preset) => preset.category === 'general',
);

export const WallPhotoHeightEstimatorModal: React.FC<
  WallPhotoHeightEstimatorModalProps
> = ({
  isOpen,
  childName,
  ageMonths,
  accessToken,
  onClose,
  onApplyEstimatedInches,
  onSaveCapturedPhoto,
}) => {
  const [viewMode, setViewMode] = useState<CaptureViewMode>('workspace');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [preparedPhoto, setPreparedPhoto] = useState<PreparedWallPhoto | null>(null);

  // Draggable normalized Y ratios (0.0 top of photo -> 1.0 bottom of photo)
  const [crownRatioY, setCrownRatioY] = useState<number>(0.32);
  const [heelRatioY, setHeelRatioY] = useState<number>(0.92);
  const [refTopRatioY, setRefTopRatioY] = useState<number>(0.22);
  const [refBottomRatioY, setRefBottomRatioY] = useState<number>(0.42);
  const [activeDrag, setActiveDrag] = useState<DragHandleId>(null);

  // Reference object inches for 2-bracket pixel calibration (default to 11.0" sheet of paper)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('paper_tall');
  const [refInches, setRefInches] = useState<number>(11.0);
  const [showRefBracket, setShowRefBracket] = useState<boolean>(true);

  // AI Vision Guesstimate state
  const [aiEstimate, setAiEstimate] = useState<WallHeightAiEstimate | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<SelectedResultSource>('ai');

  // Strictly opt-in (unchecked by default) so measurement photos don't clutter the child's album
  const [savePhotoToAlbum, setSavePhotoToAlbum] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const svgCanvasRef = useRef<SVGSVGElement | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setViewMode('workspace');
      setActiveDrag(null);
      setSavePhotoToAlbum(false);
    }
    return () => stopCamera();
  }, [isOpen]);

  // Camera stream lifecycle
  useEffect(() => {
    if (!isOpen || viewMode !== 'camera') {
      stopCamera();
      return;
    }

    let cancelled = false;
    const openStream = async () => {
      setErrorMessage(null);
      stopCamera();
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMessage(
          'Camera access is not supported in this browser. Use Upload Photo instead.',
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1080 },
            height: { ideal: 1440 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setErrorMessage(
          'Could not open camera. Allow camera permission in your browser or upload a photo.',
        );
      }
    };

    void openStream();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, viewMode, facingMode]);

  const runAiGuesstimate = async (photoToAnalyze: PreparedWallPhoto) => {
    setIsAnalyzingAi(true);
    setErrorMessage(null);
    try {
      const result = await requestAiWallHeightEstimate({
        imageDataUrl: photoToAnalyze.dataUrl,
        ageMonths,
        childName,
        calibrationMode: 'general_wall',
      });
      setAiEstimate(result);
      setSelectedSource('ai');

      // Snap crown & heel lines to AI-detected child bounds
      setCrownRatioY(clampNumber(result.childCrownRatioY, 0.03, 0.88));
      setHeelRatioY(
        clampNumber(
          result.childHeelRatioY,
          Math.min(0.96, result.childCrownRatioY + 0.12),
          0.98,
        ),
      );

      // Snap reference bracket to detected wall/room object
      if (result.detectedReferenceInches >= 3) {
        setRefInches(result.detectedReferenceInches);
        const matchingPreset = GENERAL_WALL_PRESETS.find(
          (p) => Math.abs(p.inches - result.detectedReferenceInches) <= 0.5,
        );
        setSelectedPresetId(matchingPreset ? matchingPreset.id : 'custom');
        setRefTopRatioY(clampNumber(result.refTopRatioY, 0.03, 0.9));
        setRefBottomRatioY(
          clampNumber(
            result.refBottomRatioY,
            Math.min(0.97, result.refTopRatioY + 0.05),
            0.98,
          ),
        );
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not run AI calculation. Drag the Crown, Heel, and Reference lines to measure inches!',
      );
      setSelectedSource('ruler');
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const loadNewWallPhoto = async (rawDataUrl: string) => {
    setErrorMessage(null);
    setAiEstimate(null);
    try {
      const prepared = await prepareWallPhotoForAnalysis(rawDataUrl);
      setPreparedPhoto(prepared);
      setViewMode('workspace');
      await runAiGuesstimate(prepared);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to process photo.',
      );
    }
  };

  const handleSnapWallCamera = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const snappedUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    void loadNewWallPhoto(snappedUrl);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await loadNewWallPhoto(dataUrl);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not read photo file.');
    } finally {
      e.target.value = '';
    }
  };

  const handlePickDrivePhoto = async () => {
    if (!accessToken) return;
    setErrorMessage(null);
    try {
      const picked = await openGoogleDrivePicker(accessToken, {
        viewMode: 'images',
        includeUploadView: true,
        title: `Select measurement photo of ${childName}`,
      });
      if (picked) {
        const dataUrl = await downloadDriveImageAsDataUrl(accessToken, picked.id);
        await loadNewWallPhoto(dataUrl);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not load photo from Google Drive.',
      );
    }
  };

  if (!isOpen) return null;

  // Geometric Ruler Calculation from Child Span vs Reference Span
  const childSpanRatio = Math.max(0.02, Math.abs(heelRatioY - crownRatioY));
  const refSpanRatio = Math.max(0.02, Math.abs(refBottomRatioY - refTopRatioY));
  const rulerEstimatedInches = clampNumber(
    refInches * (childSpanRatio / refSpanRatio),
    24,
    72,
  );

  const activeInchesToApply =
    selectedSource === 'ai' && aiEstimate
      ? aiEstimate.estimatedInches
      : rulerEstimatedInches;

  const activeFormatted = formatInchesDetailed(activeInchesToApply);
  const rulerFormatted = formatInchesDetailed(rulerEstimatedInches);
  const aiFormatted = aiEstimate
    ? formatInchesDetailed(aiEstimate.estimatedInches)
    : null;

  // SVG Coordinate System normalized to width = 520, proportional height
  const svgW = 520;
  const svgH = preparedPhoto
    ? Math.round(clampNumber((preparedPhoto.height / preparedPhoto.width) * svgW, 340, 740))
    : 620;

  const updateDraggedLineFromPointer = (clientY: number, targetHandle: DragHandleId) => {
    if (!targetHandle || !svgCanvasRef.current) return;
    const rect = svgCanvasRef.current.getBoundingClientRect();
    if (!rect.height) return;
    const ratio = clampNumber((clientY - rect.top) / rect.height, 0.02, 0.98);

    if (targetHandle === 'crown') {
      setCrownRatioY(Math.min(ratio, heelRatioY - 0.05));
    } else if (targetHandle === 'heel') {
      setHeelRatioY(Math.max(ratio, crownRatioY + 0.05));
    } else if (targetHandle === 'refTop') {
      setRefTopRatioY(Math.min(ratio, refBottomRatioY - 0.03));
      setSelectedSource('ruler');
    } else if (targetHandle === 'refBottom') {
      setRefBottomRatioY(Math.max(ratio, refTopRatioY + 0.03));
      setSelectedSource('ruler');
    }
  };

  const crownY = crownRatioY * svgH;
  const heelY = heelRatioY * svgH;
  const refTopY = refTopRatioY * svgH;
  const refBotY = refBottomRatioY * svgH;

  const handleApplyToWall = () => {
    const clampedCm = Number(
      clampNumber(activeInchesToApply * 2.54, 65, 175).toFixed(1),
    );
    const clampedIn = Number((clampedCm / 2.54).toFixed(1));
    const sourceLabel =
      selectedSource === 'ai' && aiEstimate
        ? `Photo Ruler AI (${aiEstimate.detectedReferenceLabel})`
        : `Photo Ruler (${refInches}" reference)`;

    // Only save to the child's photo album if the parent explicitly checked the opt-in box
    if (savePhotoToAlbum && preparedPhoto && onSaveCapturedPhoto) {
      void onSaveCapturedPhoto({
        dataUrl: preparedPhoto.dataUrl,
        kind: 'wall',
        caption: `${activeFormatted.feetInchesLabel} (${activeFormatted.totalInchesLabel}) · ${sourceLabel}`.slice(
          0,
          120,
        ),
        heightCmOverride: clampedCm,
      });
    }

    onApplyEstimatedInches({
      inches: clampedIn,
      heightCm: clampedCm,
      sourceLabel,
      savedToAlbum: Boolean(savePhotoToAlbum && preparedPhoto && onSaveCapturedPhoto),
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wall-photo-estimator-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-slate-700 rounded-2xl max-w-5xl w-full p-5 sm:p-6 shadow-xl space-y-5 my-auto max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-sky-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <h3
              id="wall-photo-estimator-title"
              className="text-lg sm:text-xl font-bold text-indigo-950 dark:text-white"
            >
              Photo Height Ruler
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
              Snap or pick any full-body photo of {childName} against a wall, doorway, or taped
              11&quot; sheet of paper to calculate an accurate height in inches. Measurement photos
              stay temporary unless you choose to save them to the album.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close photo height ruler"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800 hover:text-indigo-950 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Photo Source Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setViewMode((prev) => (prev === 'camera' ? 'workspace' : 'camera'))
              }
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'camera'
                  ? 'bg-rose-600 text-white'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
            >
              <Camera className="w-4 h-4" aria-hidden="true" />
              {viewMode === 'camera' ? 'Close Camera' : 'Take Photo'}
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              Upload Photo
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handleFileUpload(e)}
              className="hidden"
            />

            {accessToken && (
              <button
                type="button"
                onClick={() => void handlePickDrivePhoto()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-sky-900 dark:text-sky-200 bg-sky-100 dark:bg-slate-800 hover:bg-sky-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" aria-hidden="true" />
                Google Drive
              </button>
            )}

            {preparedPhoto && viewMode === 'workspace' && (
              <button
                type="button"
                disabled={isAnalyzingAi}
                onClick={() => void runAiGuesstimate(preparedPhoto)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-indigo-950 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/70 hover:bg-emerald-200 dark:hover:bg-emerald-900/70 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                {isAnalyzingAi ? 'Measuring...' : 'Re-Run AI'}
              </button>
            )}
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="px-4 py-2.5 rounded-xl text-xs font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
          >
            {errorMessage}
          </div>
        )}

        {/* Live Camera Viewfinder OR Interactive Measurement Workspace */}
        {viewMode === 'camera' ? (
          <div className="space-y-4">
            <div className="relative mx-auto max-w-md aspect-[3/4] rounded-2xl overflow-hidden bg-slate-900 border-2 border-sky-300 dark:border-sky-700">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  facingMode === 'user' ? '-scale-x-100' : ''
                }`}
              />
              {/* Full-Body Wall Alignment Guide Overlay */}
              <svg
                viewBox="0 0 300 400"
                className="absolute inset-0 w-full h-full pointer-events-none"
                aria-hidden="true"
              >
                <line
                  x1={40}
                  y1={56}
                  x2={260}
                  y2={56}
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
                <text
                  x={150}
                  y={48}
                  textAnchor="middle"
                  fill="#bbf7d0"
                  fontSize={10}
                  fontWeight={700}
                >
                  KEEP TOP OF HEAD IN FRAME
                </text>

                <line
                  x1={30}
                  y1={362}
                  x2={270}
                  y2={362}
                  stroke="#22c55e"
                  strokeWidth={2.5}
                />
                <text
                  x={150}
                  y={380}
                  textAnchor="middle"
                  fill="#bbf7d0"
                  fontSize={10}
                  fontWeight={700}
                >
                  INCLUDE HEELS TOUCHING FLOOR
                </text>
              </svg>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setFacingMode((prev) =>
                    prev === 'environment' ? 'user' : 'environment',
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-sky-900 dark:text-sky-200 bg-sky-100 dark:bg-slate-800 hover:bg-sky-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                Flip Camera
              </button>
              <button
                type="button"
                onClick={handleSnapWallCamera}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                Snap Photo &amp; Calculate Height
              </button>
            </div>
          </div>
        ) : !preparedPhoto ? (
          /* Clean Universal Empty State */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-sky-50/70 dark:bg-slate-800/70 border border-sky-200 dark:border-slate-700 rounded-2xl p-6">
            <div className="md:col-span-5 flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/50 border-2 border-amber-300 dark:border-amber-600 flex items-center justify-center">
                <Ruler className="w-7 h-7 text-amber-800 dark:text-amber-300" aria-hidden="true" />
              </div>
              <h4 className="text-base font-bold text-indigo-950 dark:text-white">
                Quick Accurate Measurement on Any Wall
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Take or upload a full-body photo from crown to heels. Hold the phone near tummy
                height pointing straight at the wall so perspective stays flat.
              </p>
            </div>

            <div className="md:col-span-7 space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <p className="font-bold text-indigo-950 dark:text-white">
                3 Easy Ways to Get a Sharp Inch Reading:
              </p>
              <div className="space-y-2">
                <p>
                  <strong className="text-sky-900 dark:text-sky-300">
                    1. Stand Next to a Doorway or Light Switch:
                  </strong>{' '}
                  AI Vision spots standard 80-inch interior doors, 48-inch light switches, and
                  36-inch doorknobs automatically.
                </p>
                <p>
                  <strong className="text-emerald-900 dark:text-emerald-300">
                    2. Tape a Sheet of Printer Paper (11 inches):
                  </strong>{' '}
                  Tape a regular 8.5 × 11&quot; sheet flat on the wall beside {childName} and drag
                  the Amber reference lines to its top and bottom (~±0.5–1 in accuracy).
                </p>
                <p>
                  <strong className="text-amber-900 dark:text-amber-300">
                    3. Enter Any Custom Object Height:
                  </strong>{' '}
                  Measure any frame, ruler, or trim mark once, type its inches into Reference Span,
                  and drag the bars for instant calculation.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Loaded Photo Interactive Split View */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Interactive SVG Photo + Draggable Crown / Heel / Reference Lines */}
            <div className="lg:col-span-6 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-indigo-950 dark:text-white">
                  Drag green (child) &amp; amber (reference) lines to fine-tune
                </span>
                <label className="inline-flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRefBracket}
                    onChange={(e) => setShowRefBracket(e.target.checked)}
                    className="rounded accent-amber-500"
                  />
                  Show Reference Scale
                </label>
              </div>

              <div className="rounded-xl overflow-hidden border-2 border-sky-200 dark:border-slate-700 bg-slate-900">
                <svg
                  ref={svgCanvasRef}
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="w-full h-auto select-none touch-none"
                  onPointerMove={(e) => {
                    if (activeDrag) {
                      updateDraggedLineFromPointer(e.clientY, activeDrag);
                    }
                  }}
                  onPointerUp={() => setActiveDrag(null)}
                  onPointerCancel={() => setActiveDrag(null)}
                  onPointerLeave={() => setActiveDrag(null)}
                >
                  <image
                    href={preparedPhoto.dataUrl}
                    x={0}
                    y={0}
                    width={svgW}
                    height={svgH}
                    preserveAspectRatio="none"
                  />

                  {/* Child Vertical Span Connector */}
                  <line
                    x1={116}
                    y1={crownY}
                    x2={116}
                    y2={heelY}
                    stroke="#22c55e"
                    strokeWidth={3}
                    strokeDasharray="6 4"
                  />

                  {/* Reference Object Span Bracket (Amber) */}
                  {showRefBracket && (
                    <g>
                      <line
                        x1={404}
                        y1={refTopY}
                        x2={404}
                        y2={refBotY}
                        stroke="#f59e0b"
                        strokeWidth={3}
                        strokeDasharray="5 3"
                      />

                      {/* Draggable Ref Top Handle */}
                      <g
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setActiveDrag('refTop');
                        }}
                        className="cursor-ns-resize"
                      >
                        <line
                          x1={290}
                          y1={refTopY}
                          x2={504}
                          y2={refTopY}
                          stroke="#f59e0b"
                          strokeWidth={3}
                        />
                        <rect
                          x={338}
                          y={Math.max(4, refTopY - 22)}
                          width={164}
                          height={20}
                          rx={5}
                          fill="#f59e0b"
                        />
                        <text
                          x={420}
                          y={Math.max(4, refTopY - 22) + 14}
                          textAnchor="middle"
                          fill="#0f172a"
                          fontSize={10}
                          fontWeight={700}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {`REF TOP (${refInches}")`}
                        </text>
                        <rect
                          x={280}
                          y={refTopY - 14}
                          width={230}
                          height={28}
                          fill="transparent"
                        />
                      </g>

                      {/* Draggable Ref Bottom Handle */}
                      <g
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setActiveDrag('refBottom');
                        }}
                        className="cursor-ns-resize"
                      >
                        <line
                          x1={290}
                          y1={refBotY}
                          x2={504}
                          y2={refBotY}
                          stroke="#f59e0b"
                          strokeWidth={3}
                        />
                        <rect
                          x={354}
                          y={Math.min(svgH - 24, refBotY + 4)}
                          width={148}
                          height={20}
                          rx={5}
                          fill="#f59e0b"
                        />
                        <text
                          x={428}
                          y={Math.min(svgH - 24, refBotY + 4) + 14}
                          textAnchor="middle"
                          fill="#0f172a"
                          fontSize={10}
                          fontWeight={700}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          REF BOTTOM
                        </text>
                        <rect
                          x={280}
                          y={refBotY - 14}
                          width={230}
                          height={28}
                          fill="transparent"
                        />
                      </g>
                    </g>
                  )}

                  {/* Draggable Child Crown Line (Green) */}
                  <g
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setActiveDrag('crown');
                    }}
                    className="cursor-ns-resize"
                  >
                    <line
                      x1={16}
                      y1={crownY}
                      x2={320}
                      y2={crownY}
                      stroke="#16a34a"
                      strokeWidth={3.5}
                    />
                    <rect
                      x={18}
                      y={Math.max(4, crownY - 24)}
                      width={176}
                      height={22}
                      rx={6}
                      fill="#16a34a"
                    />
                    <text
                      x={106}
                      y={Math.max(4, crownY - 24) + 15}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={11}
                      fontWeight={700}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      TOP OF HEAD (DRAG)
                    </text>
                    <rect x={10} y={crownY - 15} width={320} height={30} fill="transparent" />
                  </g>

                  {/* Draggable Child Heel Line (Green) */}
                  <g
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setActiveDrag('heel');
                    }}
                    className="cursor-ns-resize"
                  >
                    <line
                      x1={16}
                      y1={heelY}
                      x2={320}
                      y2={heelY}
                      stroke="#16a34a"
                      strokeWidth={3.5}
                    />
                    <rect
                      x={18}
                      y={Math.min(svgH - 26, heelY + 4)}
                      width={176}
                      height={22}
                      rx={6}
                      fill="#16a34a"
                    />
                    <text
                      x={106}
                      y={Math.min(svgH - 26, heelY + 4) + 15}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={11}
                      fontWeight={700}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      HEELS / FLOOR (DRAG)
                    </text>
                    <rect x={10} y={heelY - 15} width={320} height={30} fill="transparent" />
                  </g>
                </svg>
              </div>
            </div>

            {/* Right: AI Result + Calibrated Reference Ruler */}
            <div className="lg:col-span-6 space-y-5">
              {/* Method 1: AI Vision Calculation */}
              <div
                className={`rounded-2xl p-4 border-2 transition-colors space-y-2.5 ${
                  selectedSource === 'ai' && aiEstimate
                    ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-300">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span>AI Photo Height Calculation</span>
                  </div>
                  {aiEstimate && (
                    <button
                      type="button"
                      onClick={() => setSelectedSource('ai')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedSource === 'ai'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {selectedSource === 'ai' ? 'Selected' : 'Use AI Result'}
                    </button>
                  )}
                </div>

                {isAnalyzingAi ? (
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 py-2">
                    Inspecting photo for doors, switches, baseboards, and head-to-heel height...
                  </p>
                ) : aiEstimate && aiFormatted ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-indigo-950 dark:text-white">
                        {aiFormatted.feetInchesLabel}
                      </span>
                      <span className="text-sm font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-400">
                        ({aiFormatted.totalInchesLabel} ± {aiEstimate.marginInches} in)
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-400">
                        {aiFormatted.cmLabel}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <span>
                        Reference:{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {aiEstimate.detectedReferenceLabel}
                        </strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Confidence:{' '}
                        <strong className="capitalize text-slate-900 dark:text-white">
                          {aiEstimate.confidence}
                        </strong>
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {aiEstimate.explanation}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Click <strong>Re-Run AI</strong> above or align the Reference Ruler below.
                  </p>
                )}
              </div>

              {/* Method 2: Interactive Reference Ruler */}
              <div
                className={`rounded-2xl p-4 border-2 transition-colors space-y-3.5 ${
                  selectedSource === 'ruler'
                    ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/30'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950 dark:text-white">
                    <Ruler className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span>Interactive Calibrated Ruler</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRefBracket(true);
                      setSelectedSource('ruler');
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedSource === 'ruler'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {selectedSource === 'ruler' ? 'Selected' : 'Use Ruler Lines'}
                  </button>
                </div>

                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-indigo-950 dark:text-white">
                    {rulerFormatted.feetInchesLabel}
                  </span>
                  <span className="text-sm font-bold font-mono tabular-nums text-sky-800 dark:text-sky-300">
                    ({rulerFormatted.totalInchesLabel})
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    {rulerFormatted.cmLabel}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Match Amber bars to a wall or room reference:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {GENERAL_WALL_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSelectedPresetId(preset.id);
                          setRefInches(preset.inches);
                          setShowRefBracket(true);
                          setSelectedSource('ruler');
                        }}
                        className={`px-2.5 py-2 text-[11px] font-semibold rounded-lg border text-left transition-colors whitespace-nowrap truncate cursor-pointer ${
                          selectedPresetId === preset.id
                            ? 'border-amber-500 bg-amber-100/80 dark:bg-amber-900/50 text-slate-950 dark:text-amber-100'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="space-y-1">
                    <label
                      htmlFor="custom-ref-inches"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Reference Span (inches)
                    </label>
                    <input
                      id="custom-ref-inches"
                      type="number"
                      min={2}
                      max={96}
                      step={0.1}
                      value={refInches}
                      onChange={(e) => {
                        setSelectedPresetId('custom');
                        setRefInches(clampNumber(parseFloat(e.target.value) || 11, 2, 96));
                        setSelectedSource('ruler');
                      }}
                      className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    Drag REF TOP &amp; REF BOTTOM on the photo to match this exact inch span.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-sky-100 dark:border-slate-800">
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
            {preparedPhoto ? (
              <>
                <div>
                  Ready to apply:{' '}
                  <strong className="font-mono tabular-nums text-indigo-950 dark:text-white">
                    {activeFormatted.feetInchesLabel} ({activeFormatted.totalInchesLabel})
                  </strong>{' '}
                  <span className="font-mono tabular-nums text-slate-400">
                    · {activeFormatted.cmLabel}
                  </span>
                </div>
                {onSaveCapturedPhoto && (
                  <label className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={savePhotoToAlbum}
                      onChange={(e) => setSavePhotoToAlbum(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    Also save this photo to {childName}’s album (optional)
                  </label>
                )}
              </>
            ) : (
              <span>
                Photos used in the Photo Ruler are for height measuring only and won’t be added to
                your photo album unless you check the save option.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!preparedPhoto || viewMode === 'camera' || isAnalyzingAi}
              onClick={handleApplyToWall}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              {preparedPhoto
                ? `Apply ${activeFormatted.feetInchesLabel} (${activeFormatted.totalInchesLabel}) to Wall`
                : 'Apply Height to Wall'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
