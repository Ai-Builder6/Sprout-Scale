import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
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
  CALIBRATED_FRIDGE_SPOT,
  formatInchesDetailed,
  PreparedWallPhoto,
  prepareWallPhotoForAnalysis,
  requestAiWallHeightEstimate,
  WALL_REFERENCE_PRESETS,
  WallCalibrationMode,
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

const FRIDGE_GUIDE_TICKS = [
  { inches: 61.5, label: '61.5" Handle Top' },
  { inches: 54.5, label: '54.5" Red Magnet' },
  { inches: 30.5, label: '30.5" Handle Bot' },
  { inches: 27.5, label: '27.5" Seam' },
  { inches: 24.0, label: '24.0" Handle' },
];

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
  const [calibrationMode, setCalibrationMode] =
    useState<WallCalibrationMode>('kitchen_fridge');
  const [showTapeReferencePhotos, setShowTapeReferencePhotos] =
    useState<boolean>(false);
  const [viewMode, setViewMode] = useState<CaptureViewMode>('workspace');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [preparedPhoto, setPreparedPhoto] = useState<PreparedWallPhoto | null>(null);

  // Draggable normalized Y ratios (0.0 top of photo -> 1.0 bottom of photo)
  const [crownRatioY, setCrownRatioY] = useState<number>(0.36);
  const [heelRatioY, setHeelRatioY] = useState<number>(0.92);
  const [refTopRatioY, setRefTopRatioY] = useState<number>(0.14);
  const [refBottomRatioY, setRefBottomRatioY] = useState<number>(0.92);
  const [activeDrag, setActiveDrag] = useState<DragHandleId>(null);

  // Reference object inches for 2-bracket pixel calibration (default to calibrated 69.0" fridge!)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('fridge_full');
  const [refInches, setRefInches] = useState<number>(CALIBRATED_FRIDGE_SPOT.totalInches);
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

  const handleSelectCalibrationMode = (mode: WallCalibrationMode) => {
    setCalibrationMode(mode);
    if (mode === 'kitchen_fridge') {
      setSelectedPresetId('fridge_full');
      setRefInches(CALIBRATED_FRIDGE_SPOT.totalInches);
    } else if (selectedPresetId.startsWith('fridge_')) {
      setSelectedPresetId('paper_tall');
      setRefInches(11.0);
    }
    if (preparedPhoto) {
      void runAiGuesstimate(preparedPhoto, mode);
    }
  };

  const runAiGuesstimate = async (
    photoToAnalyze: PreparedWallPhoto,
    modeOverride?: WallCalibrationMode,
  ) => {
    const activeMode = modeOverride ?? calibrationMode;
    setIsAnalyzingAi(true);
    setErrorMessage(null);
    try {
      const result = await requestAiWallHeightEstimate({
        imageDataUrl: photoToAnalyze.dataUrl,
        ageMonths,
        childName,
        calibrationMode: activeMode,
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

      // Snap reference bracket to matched calibrated fridge or detected wall object
      if (result.detectedReferenceInches >= 3) {
        setRefInches(result.detectedReferenceInches);
        if (
          result.usedCalibratedSpot &&
          Math.abs(result.detectedReferenceInches - 69.0) <= 0.5
        ) {
          setSelectedPresetId('fridge_full');
        } else if (
          result.usedCalibratedSpot &&
          Math.abs(result.detectedReferenceInches - 41.5) <= 0.5
        ) {
          setSelectedPresetId('fridge_upper_door');
        } else if (
          result.usedCalibratedSpot &&
          Math.abs(result.detectedReferenceInches - 31.0) <= 0.5
        ) {
          setSelectedPresetId('fridge_vertical_handle');
        } else {
          setSelectedPresetId('custom');
        }
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
          caption: `${result.usedCalibratedSpot ? 'Fridge check-in' : 'Wall check-in'} · ${estFmt.feetInchesLabel} (${estFmt.totalInchesLabel})`,
          heightCmOverride: estCm,
          existingPhotoId: activeSavedPhotoIdRef.current,
        });
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

  const loadNewWallPhoto = async (rawDataUrl: string, sourceCaption = 'Fridge height photo') => {
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
    void loadNewWallPhoto(
      snappedUrl,
      calibrationMode === 'kitchen_fridge' ? 'Fridge camera photo' : 'Wall camera photo',
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await loadNewWallPhoto(
        dataUrl,
        calibrationMode === 'kitchen_fridge' ? 'Uploaded fridge photo' : 'Uploaded wall photo',
      );
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
        title: `Select photo of ${childName}`,
      });
      if (picked) {
        const dataUrl = await downloadDriveImageAsDataUrl(accessToken, picked.id);
        await loadNewWallPhoto(dataUrl, `Drive photo (${picked.name.slice(0, 50)})`);
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

  const showFridgeTickOverlay =
    showRefBracket &&
    calibrationMode === 'kitchen_fridge' &&
    Math.abs(refInches - CALIBRATED_FRIDGE_SPOT.totalInches) <= 0.5 &&
    refBotY - refTopY >= 120;

  const visiblePresets =
    calibrationMode === 'kitchen_fridge'
      ? WALL_REFERENCE_PRESETS
      : WALL_REFERENCE_PRESETS.filter((p) => p.category === 'general');

  const handleApplyToWall = () => {
    const clampedCm = Number(
      clampNumber(activeInchesToApply * 2.54, 65, 175).toFixed(1),
    );
    const clampedIn = Number((clampedCm / 2.54).toFixed(1));
    const sourceLabel =
      selectedSource === 'ai' && aiEstimate
        ? `${aiEstimate.usedCalibratedSpot ? 'Calibrated Fridge AI' : 'AI Wall Photo'} (${aiEstimate.detectedReferenceLabel})`
        : `Calibrated Ruler (${refInches}" reference)`;

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
              Photo Height Calculator — Calibrated to Your 69.0&quot; Kitchen Fridge
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              Stand {childName} barefoot flat in front of your Whirlpool kitchen fridge (tape-verified
              at <strong className="font-mono tabular-nums text-indigo-950">5&apos; 9.0&quot; / 69.0 in</strong> from
              floor to door top) or any wall for a precision photo measurement.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close photo height calculator"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-sky-50 hover:text-indigo-950 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Calibration Spot Switcher + Photo Source Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Interactive Segmented Control for Spot Mode */}
          <div
            role="group"
            aria-label="Calibration spot mode"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
          >
            <button
              type="button"
              onClick={() => handleSelectCalibrationMode('kitchen_fridge')}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                calibrationMode === 'kitchen_fridge'
                  ? 'bg-white text-indigo-950 shadow-xs'
                  : 'text-slate-600 hover:text-indigo-950'
              }`}
            >
              Kitchen Fridge (69.0&quot; Calibrated)
            </button>
            <button
              type="button"
              onClick={() => handleSelectCalibrationMode('general_wall')}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                calibrationMode === 'general_wall'
                  ? 'bg-white text-indigo-950 shadow-xs'
                  : 'text-slate-600 hover:text-indigo-950'
              }`}
            >
              Any Wall / Room
            </button>
          </div>

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
              {viewMode === 'camera'
                ? 'Close Camera'
                : calibrationMode === 'kitchen_fridge'
                  ? 'Take Fridge Picture'
                  : 'Take Wall Picture'}
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-sky-900 bg-sky-100 hover:bg-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-indigo-950 bg-emerald-100 hover:bg-emerald-200 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                {isAnalyzingAi ? 'Measuring...' : 'Re-Run AI'}
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Tape-Verified Kitchen Fridge Reference Banner (when Fridge Mode is active & photo loaded) */}
        {calibrationMode === 'kitchen_fridge' && preparedPhoto && viewMode === 'workspace' && (
          <div className="border border-sky-200 bg-sky-50/60 rounded-xl px-4 py-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-700">
                <strong className="text-indigo-950">Calibrated Fridge Scale Active</strong>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">69.0&quot; Door Top</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">54.5&quot; Red Magnet</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">30.5&quot;–61.5&quot; Vertical Handles</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">27.5&quot; Freezer Seam</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">24.0&quot; Freezer Handle</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTapeReferencePhotos((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-bold text-sky-800 hover:text-indigo-950 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {showTapeReferencePhotos ? 'Hide Tape Photos' : 'View Tape Photos'}
                {showTapeReferencePhotos ? (
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            </div>

            {showTapeReferencePhotos && (
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-sky-200/70">
                <figure className="space-y-1">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                    <img
                      src={CALIBRATED_FRIDGE_SPOT.tapeFullPhotoUrl}
                      alt="Full kitchen fridge height with yellow measuring tape reaching 69.0 inches"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <figcaption className="text-[11px] text-slate-600 font-mono tabular-nums">
                    Full Door: 0&quot; → 69.0&quot; (5&apos; 9.0&quot;)
                  </figcaption>
                </figure>
                <figure className="space-y-1">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                    <img
                      src={CALIBRATED_FRIDGE_SPOT.tapeCloseUpPhotoUrl}
                      alt="Close-up measuring tape from floor 0 inches to freezer handle at 24.0 inches"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <figcaption className="text-[11px] text-slate-600 font-mono tabular-nums">
                    Lower: 3.0&quot; Door · 24.0&quot; Handle
                  </figcaption>
                </figure>
                <figure className="space-y-1">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                    <img
                      src={CALIBRATED_FRIDGE_SPOT.cleanPhotoUrl}
                      alt="Clean Whirlpool stainless steel kitchen fridge measuring spot without tape"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <figcaption className="text-[11px] text-slate-600">
                    Clean Measuring Spot Reference
                  </figcaption>
                </figure>
              </div>
            )}
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="px-4 py-2.5 rounded-xl text-xs font-medium bg-amber-50 text-amber-950 border border-amber-200"
          >
            {errorMessage}
          </div>
        )}

        {/* Live Camera Viewfinder OR Interactive Measurement Workspace */}
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
              {/* Full-Body Fridge or Wall Alignment Guide Overlay */}
              <svg
                viewBox="0 0 300 400"
                className="absolute inset-0 w-full h-full pointer-events-none"
                aria-hidden="true"
              >
                {calibrationMode === 'kitchen_fridge' ? (
                  <>
                    <line
                      x1={32}
                      y1={46}
                      x2={268}
                      y2={46}
                      stroke="#facc15"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                    />
                    <text
                      x={150}
                      y={38}
                      textAnchor="middle"
                      fill="#fef08a"
                      fontSize={9.5}
                      fontWeight={700}
                    >
                      TOP OF FRIDGE DOOR (69.0&quot;)
                    </text>

                    <line
                      x1={44}
                      y1={236}
                      x2={256}
                      y2={236}
                      stroke="#38bdf8"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                    <text
                      x={150}
                      y={229}
                      textAnchor="middle"
                      fill="#bae6fd"
                      fontSize={9}
                      fontWeight={700}
                    >
                      FREEZER SEAM (27.5&quot;)
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
                      fontSize={9.5}
                      fontWeight={700}
                    >
                      CHILD HEELS ON FLOOR (0.0&quot;)
                    </text>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
                Snap Photo &amp; Calculate Height
              </button>
            </div>
          </div>
        ) : !preparedPhoto ? (
          /* Empty State: Calibrated Fridge Reference Showcase OR General Wall Guide */
          calibrationMode === 'kitchen_fridge' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start bg-sky-50/70 border border-sky-200 rounded-2xl p-5">
              {/* Left: User's Tape-Measured Fridge Photos */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                <figure className="space-y-1.5">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden border border-sky-200 bg-slate-100">
                    <img
                      src={CALIBRATED_FRIDGE_SPOT.tapeFullPhotoUrl}
                      alt="Kitchen fridge with yellow measuring tape showing exact 69.0 inch height"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <figcaption className="text-[11px] font-medium text-slate-600 font-mono tabular-nums">
                    Tape Verified: 0&quot; → 69.0&quot;
                  </figcaption>
                </figure>
                <figure className="space-y-1.5">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden border border-sky-200 bg-slate-100">
                    <img
                      src={CALIBRATED_FRIDGE_SPOT.cleanPhotoUrl}
                      alt="Whirlpool stainless steel fridge measuring spot"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <figcaption className="text-[11px] font-medium text-slate-600">
                    Stand {childName} Here
                  </figcaption>
                </figure>
              </div>

              {/* Right: Saved Exact Landmarks + Quick Instructions */}
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-indigo-950">
                    Your Kitchen Fridge Is Calibrated! (5&apos; 9.0&quot; / 69.0 in)
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    We read your measuring tape photos and locked in exact floor-to-landmark
                    measurements for your Whirlpool fridge. Now whenever you snap or upload a photo
                    of {childName} standing barefoot right against the fridge, AI Vision compares
                    against these exact marks (~±0.5–1.0 in accuracy).
                  </p>
                </div>

                {/* Clean Tabular Landmark Table (no pill badges) */}
                <div className="bg-white border border-sky-200/80 rounded-xl divide-y divide-slate-100 text-xs">
                  <div className="grid grid-cols-12 px-3 py-2 font-bold text-slate-500">
                    <span className="col-span-7">Fridge Landmark</span>
                    <span className="col-span-3 text-right font-mono tabular-nums">Height</span>
                    <span className="col-span-2 text-right font-mono tabular-nums">Inches</span>
                  </div>
                  {[
                    { name: 'Top lip of stainless fridge door', ft: '5\' 9.0"', inch: '69.0"' },
                    { name: 'Top tips of vertical French handles', ft: '5\' 1.5"', inch: '61.5"' },
                    { name: 'Bottom of red Measuring Lane magnet', ft: '4\' 6.5"', inch: '54.5"' },
                    { name: 'Bottom tips of vertical French handles', ft: '2\' 6.5"', inch: '30.5"' },
                    { name: 'Freezer drawer / upper door seam', ft: '2\' 3.5"', inch: '27.5"' },
                    { name: 'Bottom of horizontal freezer handle', ft: '2\' 0.0"', inch: '24.0"' },
                    { name: 'Bottom edge of stainless freezer door', ft: '0\' 3.0"', inch: '3.0"' },
                  ].map((row) => (
                    <div
                      key={row.name}
                      className="grid grid-cols-12 px-3 py-1.5 text-slate-700"
                    >
                      <span className="col-span-7 truncate">{row.name}</span>
                      <span className="col-span-3 text-right font-mono tabular-nums font-semibold text-indigo-950">
                        {row.ft}
                      </span>
                      <span className="col-span-2 text-right font-mono tabular-nums text-slate-500">
                        {row.inch}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-slate-600">
                  <strong>Best photo tip:</strong> Stand {childName} flat against the fridge doors
                  barefoot and step back 6–8 feet with your phone held near chest height so both the
                  wood floor and the fridge top (or handles) stay straight in frame.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-sky-50/70 border border-sky-200 rounded-2xl p-6">
              <div className="md:col-span-5 flex flex-col items-center text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center">
                  <Ruler className="w-7 h-7 text-amber-800" aria-hidden="true" />
                </div>
                <h4 className="text-base font-bold text-indigo-950">
                  Measure Against Any Wall in Your Home
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Take or upload a full-body photo from crown to heels. Hold the camera near tummy
                  height pointing straight at the wall so perspective stays flat.
                </p>
              </div>

              <div className="md:col-span-7 space-y-3 text-xs text-slate-700">
                <p className="font-bold text-indigo-950">
                  3 Easy Ways to Make Any Wall Photo Accurate:
                </p>
                <div className="space-y-2">
                  <p>
                    <strong className="text-sky-900">1. Stand Next to a Door or Light Switch:</strong>{' '}
                    AI Vision spots standard 80-inch doors, 48-inch wall switches, and 36-inch
                    doorknobs automatically (~±1.5 inches).
                  </p>
                  <p>
                    <strong className="text-emerald-900">
                      2. Tape a Regular Sheet of Printer Paper (11 inches):
                    </strong>{' '}
                    Tape a standard 8.5 × 11&quot; piece of paper flat on the wall beside {childName}{' '}
                    and drag the Amber reference bars to its top and bottom (~±0.5–1 inch).
                  </p>
                  <p>
                    <strong className="text-amber-900">3. Switch to Kitchen Fridge Mode:</strong>{' '}
                    Standing in front of your calibrated 69.0&quot; Whirlpool fridge gives the sharpest
                    automatic readings with zero extra setup!
                  </p>
                </div>
              </div>
            </div>
          )
        ) : (
          /* Loaded Photo Interactive Split View */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Interactive SVG Photo + Draggable Crown / Heel / Reference Lines + Projected Fridge Landmarks */}
            <div className="lg:col-span-6 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold text-indigo-950">
                  Drag green (child) &amp; amber (fridge/ref) lines to fine-tune
                </span>
                <label className="inline-flex items-center gap-1.5 font-semibold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRefBracket}
                    onChange={(e) => setShowRefBracket(e.target.checked)}
                    className="rounded accent-amber-500"
                  />
                  Show Reference Scale
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

                  {/* Projected Calibrated Fridge Landmark Ticks when 69.0" Full Fridge Span is active */}
                  {showFridgeTickOverlay &&
                    FRIDGE_GUIDE_TICKS.map((tick) => {
                      const fracFromFloor =
                        tick.inches / CALIBRATED_FRIDGE_SPOT.totalInches;
                      const tickY = refBotY - fracFromFloor * (refBotY - refTopY);
                      return (
                        <g key={tick.inches} opacity={0.85} className="pointer-events-none">
                          <line
                            x1={328}
                            y1={tickY}
                            x2={504}
                            y2={tickY}
                            stroke="#38bdf8"
                            strokeWidth={1.5}
                            strokeDasharray="3 3"
                          />
                          <rect
                            x={396}
                            y={tickY - 9}
                            width={106}
                            height={15}
                            rx={3}
                            fill="#0c4a6e"
                            fillOpacity={0.85}
                          />
                          <text
                            x={449}
                            y={tickY + 2}
                            textAnchor="middle"
                            fill="#e0f2fe"
                            fontSize={8.5}
                            fontWeight={700}
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {tick.label}
                          </text>
                        </g>
                      );
                    })}

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
                          {selectedPresetId === 'fridge_full'
                            ? `FRIDGE TOP (${refInches}")`
                            : `REF TOP (${refInches}")`}
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
                          {selectedPresetId === 'fridge_full'
                            ? 'FLOOR (0.0")'
                            : 'REF BOTTOM'}
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
              {/* Method 1: AI Vision Calibrated Calculation */}
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
                    <span>
                      {aiEstimate?.usedCalibratedSpot
                        ? 'AI Fridge-Calibrated Measurement'
                        : 'AI Photo Height Calculation'}
                    </span>
                  </div>
                  {aiEstimate && (
                    <button
                      type="button"
                      onClick={() => setSelectedSource('ai')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
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
                    {calibrationMode === 'kitchen_fridge'
                      ? 'Comparing photo against your 69.0" tape-verified Whirlpool fridge landmarks...'
                      : 'Inspecting wall photo for doors, switches, baseboards, and head-to-heel height...'}
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
                        Reference:{' '}
                        <strong className="text-slate-900">
                          {aiEstimate.detectedReferenceLabel}
                        </strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Confidence:{' '}
                        <strong className="capitalize text-slate-900">
                          {aiEstimate.confidence}
                        </strong>
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">
                      {aiEstimate.explanation}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">
                    Click <strong>Re-Run AI</strong> above or align the Reference Ruler below.
                  </p>
                )}
              </div>

              {/* Method 2: Interactive Reference Ruler */}
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
                    Match Amber bars to a calibrated fridge or room reference:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {visiblePresets.map((preset) => (
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
                        setRefInches(clampNumber(parseFloat(e.target.value) || 69, 2, 96));
                        setSelectedSource('ruler');
                      }}
                      className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {selectedPresetId === 'fridge_full'
                      ? 'Line FRIDGE TOP up with the top lip of the door and FLOOR up with the wood floor — check that blue handle & seam ticks match!'
                      : 'Drag REF TOP & REF BOTTOM on the photo to match this exact inch span.'}
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
              <span>
                Your Whirlpool fridge landmarks (0.0&quot; to 69.0&quot;) are saved and ready for every child in your family.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
