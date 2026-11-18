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
  const [crownRatioY, setCrownRatioY] = useState<number>(0.22);
  const [heelRatioY, setHeelRatioY] = useState<number>(0.92);
  const [refTopRatioY, setRefTopRatioY] = useState<number>(0.36);
  const [refBottomRatioY, setRefBottomRatioY] = useState<number>(0.58);
  const [activeDrag, setActiveDrag] = useState<DragHandleId>(null);

  // Reference object inches for 2-bracket pixel calibration
  const [selectedPresetId, setSelectedPresetId] = useState<string>('paper_tall');
  const [refInches, setRefInches] = useState<number>(11.0);
  const [showRefBracket, setShowRefBracket] = useState<boolean>(true);

  // AI Vision Guesstimate state
  const [aiEstimate, setAiEstimate] = useState<WallHeightAiEstimate | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<SelectedResultSource>('ai');
  const [isPhotoSavedToAlbum, setIsPhotoSavedToAlbum] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const svgCanvasRef = useRef<SVGSVGElement | null>(null);
  const activeSavedPhotoIdRef = useRef<string | null>(null);

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
          'Camera access is not supported in this browser. Use Upload Wall Photo instead.',
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
          'Could not open camera. Allow camera permission in your browser or upload a wall photo.',
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

      // If AI spotted a real wall reference object, snap reference lines & inches too
      if (result.detectedReferenceInches >= 3) {
        setRefInches(result.detectedReferenceInches);
        setSelectedPresetId('custom');
        setRefTopRatioY(clampNumber(result.refTopRatioY, 0.03, 0.9));
        setRefBottomRatioY(
          clampNumber(
            result.refBottomRatioY,
            Math.min(0.97, result.refTopRatioY + 0.05),
            0.98,
          ),
        );
      }

      // Enrich the already-saved photo with the AI estimated height in inches
      if (onSaveCapturedPhoto && activeSavedPhotoIdRef.current) {
        const estCm = Number(clampNumber(result.estimatedInches * 2.54, 65, 175).toFixed(1));
        const estFmt = formatInchesDetailed(result.estimatedInches);
        void onSaveCapturedPhoto({
          dataUrl: photoToAnalyze.dataUrl,
          kind: 'wall',
          caption: `Wall check-in · ${estFmt.feetInchesLabel} (${estFmt.totalInchesLabel})`,
          heightCmOverride: estCm,
          existingPhotoId: activeSavedPhotoIdRef.current,
        });
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not run AI guesstimate. Drag the Crown, Heel, and Reference lines to measure inches!',
      );
      setSelectedSource('ruler');
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const loadNewWallPhoto = async (rawDataUrl: string, sourceCaption = 'Wall height photo') => {
    setErrorMessage(null);
    setAiEstimate(null);
    setIsPhotoSavedToAlbum(false);
    activeSavedPhotoIdRef.current = null;
    try {
      const prepared = await prepareWallPhotoForAnalysis(rawDataUrl);
      setPreparedPhoto(prepared);
      setViewMode('workspace');
      if (onSaveCapturedPhoto) {
        const savedId = await onSaveCapturedPhoto({
          dataUrl: prepared.dataUrl,
          kind: 'wall',
          caption: sourceCaption,
        });
        if (typeof savedId === 'string' && savedId.length > 0) {
          activeSavedPhotoIdRef.current = savedId;
        }
        setIsPhotoSavedToAlbum(true);
      }
      await runAiGuesstimate(prepared);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to process wall photo.',
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
    void loadNewWallPhoto(snappedUrl, 'Wall camera photo');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await loadNewWallPhoto(dataUrl, 'Uploaded wall photo');
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
        title: `Select wall photo of ${childName}`,
      });
      if (picked) {
        const dataUrl = await downloadDriveImageAsDataUrl(accessToken, picked.id);
        await loadNewWallPhoto(dataUrl, `Drive wall photo (${picked.name.slice(0, 50)})`);
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
        ? `AI Wall Guesstimate (${aiEstimate.detectedReferenceLabel})`
        : `Photo Reference Ruler (${refInches}" reference)`;

    if (preparedPhoto && onSaveCapturedPhoto) {
      void onSaveCapturedPhoto({
        dataUrl: preparedPhoto.dataUrl,
        kind: 'wall',
        caption: `${activeFormatted.feetInchesLabel} (${activeFormatted.totalInchesLabel}) · ${sourceLabel}`.slice(
          0,
          120,
        ),
        heightCmOverride: clampedCm,
        existingPhotoId: activeSavedPhotoIdRef.current,
      });
    }

    onApplyEstimatedInches({
      inches: clampedIn,
      heightCm: clampedCm,
      sourceLabel,
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
      <div className="bg-white border-2 border-amber-300 rounded-2xl max-w-5xl w-full p-5 sm:p-6 shadow-xl space-y-5 my-auto max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-sky-100 pb-4">
          <div className="space-y-1">
            <h3
              id="wall-photo-estimator-title"
              className="text-lg sm:text-xl font-bold text-indigo-950"
            >
              Wall Photo Height Guesstimator — How Many Inches Tall?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              Stand {childName} barefoot flat against a wall from head to heels. Snap or upload a
              photo for an instant AI guesstimate in inches, or line up a known item (like an
              11-inch sheet of paper, light switch, or door) for sharper accuracy!
            </p>
          </div>
          <button
            type="button"
            aria-label="Close wall photo height guesstimator"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:bg-sky-50 hover:text-indigo-950 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Photo Source Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                setViewMode((prev) => (prev === 'camera' ? 'workspace' : 'camera'))
              }
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'camera'
                  ? 'bg-rose-600 text-white'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
            >
              <Camera className="w-4 h-4" aria-hidden="true" />
              {viewMode === 'camera' ? 'Close Camera' : 'Take Wall Picture'}
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              Upload Wall Photo
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-sky-900 bg-sky-100 hover:bg-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" aria-hidden="true" />
                Pick from Google Drive
              </button>
            )}
          </div>

          {preparedPhoto && viewMode === 'workspace' && (
            <button
              type="button"
              disabled={isAnalyzingAi}
              onClick={() => void runAiGuesstimate(preparedPhoto)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-950 bg-emerald-100 hover:bg-emerald-200 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              {isAnalyzingAi ? 'Scanning Wall Cues...' : 'Re-Run AI Guesstimate'}
            </button>
          )}
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="px-4 py-2.5 rounded-xl text-xs font-medium bg-amber-50 text-amber-950 border border-amber-200"
          >
            {errorMessage}
          </div>
        )}

        {/* Live Camera Viewfinder OR Interactive Wall Measurement Workspace */}
        {viewMode === 'camera' ? (
          <div className="space-y-4">
            <div className="relative mx-auto max-w-md aspect-[3/4] rounded-2xl overflow-hidden bg-slate-900 border-2 border-sky-300">
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
                {/* Crown Line */}
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

                {/* Floor / Heels Line */}
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

                {/* Optional Paper / Switch Reference Hint Box */}
                <rect
                  x={210}
                  y={130}
                  width={48}
                  height={64}
                  rx={4}
                  fill="none"
                  stroke="#facc15"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
                <text
                  x={234}
                  y={122}
                  textAnchor="middle"
                  fill="#fef08a"
                  fontSize={8.5}
                  fontWeight={700}
                >
                  11&quot; PAPER / SWITCH
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-sky-900 bg-sky-100 hover:bg-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
                Snap Wall Photo &amp; Guesstimate
              </button>
            </div>
          </div>
        ) : !preparedPhoto ? (
          /* Empty State with Helpful How-It-Works Visual Guide */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-sky-50/70 border border-sky-200 rounded-2xl p-6">
            <div className="md:col-span-5 flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center">
                <Ruler className="w-7 h-7 text-amber-800" aria-hidden="true" />
              </div>
              <h4 className="text-base font-bold text-indigo-950">
                Yes — We Can Guesstimate Inches From a Wall Photo!
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Take or upload a full-body photo from crown to heels. Hold the camera near
                tummy height pointing straight at the wall so perspective stays flat.
              </p>
            </div>

            <div className="md:col-span-7 space-y-3 text-xs text-slate-700">
              <p className="font-bold text-indigo-950">
                3 Easy Ways to Make Your Photo Guesstimate Super Close:
              </p>
              <div className="space-y-2">
                <p>
                  <strong className="text-sky-900">1. Stand Next to a Door or Light Switch:</strong>{' '}
                  Our AI Vision spots standard 80-inch doors, 48-inch wall switches, and 36-inch
                  doorknobs automatically (~±1.5 inches).
                </p>
                <p>
                  <strong className="text-emerald-900">
                    2. Tape a Regular Sheet of Printer Paper (11 inches):
                  </strong>{' '}
                  Tape a standard 8.5 × 11&quot; piece of paper flat on the wall beside {childName}{' '}
                  and drag the Amber reference bars to its top and bottom (~±0.5–1 inch!).
                </p>
                <p>
                  <strong className="text-amber-900">3. Bare Wall Quick Guess:</strong> Even on a
                  blank wall, AI Vision estimates inches from proportions (~±3–4 inches) so you get
                  an instant ballpark mark!
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Loaded Photo Interactive Guesstimator Split View */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Interactive SVG Photo + Draggable Crown / Heel / Reference Lines */}
            <div className="lg:col-span-6 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold text-indigo-950">
                  Drag lines on the photo to fine-tune head, heels &amp; reference
                </span>
                <label className="inline-flex items-center gap-1.5 font-semibold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRefBracket}
                    onChange={(e) => setShowRefBracket(e.target.checked)}
                    className="rounded accent-amber-500"
                  />
                  Show Reference Bars
                </label>
              </div>

              <div className="rounded-xl overflow-hidden border-2 border-sky-200 bg-slate-900">
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
                          x={354}
                          y={Math.max(4, refTopY - 22)}
                          width={146}
                          height={20}
                          rx={5}
                          fill="#f59e0b"
                        />
                        <text
                          x={427}
                          y={Math.max(4, refTopY - 22) + 14}
                          textAnchor="middle"
                          fill="#0f172a"
                          fontSize={10.5}
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
                          x={366}
                          y={Math.min(svgH - 24, refBotY + 4)}
                          width={134}
                          height={20}
                          rx={5}
                          fill="#f59e0b"
                        />
                        <text
                          x={433}
                          y={Math.min(svgH - 24, refBotY + 4) + 14}
                          textAnchor="middle"
                          fill="#0f172a"
                          fontSize={10.5}
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

            {/* Right: AI Guesstimate + Reference Object Inches Calibration */}
            <div className="lg:col-span-6 space-y-5">
              {/* Method 1: AI Vision Wall Guesstimate */}
              <div
                className={`rounded-2xl p-4 border-2 transition-colors space-y-2.5 ${
                  selectedSource === 'ai' && aiEstimate
                    ? 'border-emerald-400 bg-emerald-50/50'
                    : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <Sparkles className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    <span>AI Wall Scene Guesstimate</span>
                  </div>
                  {aiEstimate && (
                    <button
                      type="button"
                      onClick={() => setSelectedSource('ai')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer ${
                        selectedSource === 'ai'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {selectedSource === 'ai' ? 'Selected' : 'Use AI Result'}
                    </button>
                  )}
                </div>

                {isAnalyzingAi ? (
                  <p className="text-xs font-medium text-slate-700 py-2">
                    Inspecting wall photo for doors, switches, baseboards, and head-to-heel height in inches...
                  </p>
                ) : aiEstimate && aiFormatted ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-indigo-950">
                        {aiFormatted.feetInchesLabel}
                      </span>
                      <span className="text-sm font-bold font-mono tabular-nums text-emerald-800">
                        ({aiFormatted.totalInchesLabel} ± {aiEstimate.marginInches} in)
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-400">
                        Secondary: {aiFormatted.cmLabel}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                      <span>
                        Scale cue: <strong className="text-slate-900">{aiEstimate.detectedReferenceLabel}</strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Confidence:{' '}
                        <strong className="capitalize text-slate-900">{aiEstimate.confidence}</strong>
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">
                      {aiEstimate.explanation}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">
                    Click <strong>Re-Run AI Guesstimate</strong> above or use the Reference Object Ruler below.
                  </p>
                )}
              </div>

              {/* Method 2: Interactive Reference Object Calibration */}
              <div
                className={`rounded-2xl p-4 border-2 transition-colors space-y-3.5 ${
                  selectedSource === 'ruler'
                    ? 'border-amber-400 bg-amber-50/40'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                    <Ruler className="w-4 h-4 text-amber-600" aria-hidden="true" />
                    <span>Reference Object Ruler (Sharper Inches)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRefBracket(true);
                      setSelectedSource('ruler');
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer ${
                      selectedSource === 'ruler'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {selectedSource === 'ruler' ? 'Selected' : 'Use Ruler Lines'}
                  </button>
                </div>

                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-indigo-950">
                    {rulerFormatted.feetInchesLabel}
                  </span>
                  <span className="text-sm font-bold font-mono tabular-nums text-sky-800">
                    ({rulerFormatted.totalInchesLabel})
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    Secondary: {rulerFormatted.cmLabel}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700">
                    What wall reference are the Amber bars lined up with?
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {WALL_REFERENCE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSelectedPresetId(preset.id);
                          setRefInches(preset.inches);
                          setShowRefBracket(true);
                          setSelectedSource('ruler');
                        }}
                        className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border text-left transition-colors whitespace-nowrap truncate cursor-pointer ${
                          selectedPresetId === preset.id
                            ? 'border-amber-500 bg-amber-100/80 text-slate-950'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Reference Size (inches)
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
                      className="w-full h-9 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Drag <strong>REF TOP</strong> &amp; <strong>REF BOTTOM</strong> on the photo to
                    match this known height in inches.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-sky-100">
          <div className="text-xs text-slate-600 space-y-0.5">
            {preparedPhoto ? (
              <>
                <div>
                  Ready to apply:{' '}
                  <strong className="font-mono tabular-nums text-indigo-950">
                    {activeFormatted.feetInchesLabel} ({activeFormatted.totalInchesLabel})
                  </strong>{' '}
                  <span className="font-mono tabular-nums text-slate-400">
                    · {activeFormatted.cmLabel}
                  </span>
                </div>
                {isPhotoSavedToAlbum && (
                  <p className="text-[11px] font-semibold text-emerald-700">
                    Photo automatically saved to {childName}’s photo album.
                  </p>
                )}
              </>
            ) : (
              <span>Photo guesstimates are great for playful check-ins; verify with a book &amp; tape for doctor records.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
