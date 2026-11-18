import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  FolderOpen,
  RefreshCw,
  RotateCcw,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  AccessoryId,
  HairStyle,
  PaletteId,
  SKIN_TONE_PRESETS,
} from '../types';
import {
  cropPortraitToDataUrl,
  PortraitCropParams,
  readFileAsDataUrl,
} from '../services/avatarPhotoService';
import {
  downloadDriveImageAsDataUrl,
  openGoogleDrivePicker,
} from '../services/googleDriveService';
import { CharacterFigureGroup } from './GrowingCharacterSvg';

interface ChildAvatarPhotoModalProps {
  isOpen: boolean;
  childName: string;
  currentAvatarUrl: string | null;
  paletteId: PaletteId;
  accessoryId: AccessoryId;
  hairStyle: HairStyle;
  skinTone: string;
  hairColor: string;
  accessToken: string | null;
  onClose: () => void;
  onApplyPhoto: (result: { croppedDataUrl: string; sampledSkinHex: string }) => void;
  onSaveCapturedPhoto?: (params: {
    dataUrl: string;
    kind: 'avatar';
    caption: string;
  }) => Promise<string | null> | void;
}

type ModalMode = 'choose-or-frame' | 'camera';

export const ChildAvatarPhotoModal: React.FC<ChildAvatarPhotoModalProps> = ({
  isOpen,
  childName,
  currentAvatarUrl,
  paletteId,
  accessoryId,
  hairStyle,
  skinTone,
  hairColor,
  accessToken,
  onClose,
  onApplyPhoto,
  onSaveCapturedPhoto,
}) => {
  const [mode, setMode] = useState<ModalMode>('choose-or-frame');
  const [rawSourceUrl, setRawSourceUrl] = useState<string | null>(currentAvatarUrl);
  const [previewCroppedUrl, setPreviewCroppedUrl] = useState<string | null>(currentAvatarUrl);
  const [sampledTone, setSampledTone] = useState<string>(skinTone);
  const [useSampledTone, setUseSampledTone] = useState<boolean>(true);
  const [crop, setCrop] = useState<PortraitCropParams>({
    zoom: 1.25,
    offsetX: 0,
    offsetY: 0,
  });

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSavedSourceRef = useRef<string | null>(null);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      setRawSourceUrl(currentAvatarUrl);
      setPreviewCroppedUrl(currentAvatarUrl);
      setSampledTone(skinTone);
      setCrop({ zoom: 1.25, offsetX: 0, offsetY: 0 });
      setCameraError(null);
      setSavedNotice(null);
      lastSavedSourceRef.current = currentAvatarUrl;
      setMode('choose-or-frame');
    } else {
      stopCameraStream();
    }
    return () => stopCameraStream();
  }, [isOpen, currentAvatarUrl, skinTone]);

  // Start camera stream when switching to camera mode
  useEffect(() => {
    if (!isOpen || mode !== 'camera') {
      stopCameraStream();
      return;
    }

    let cancelled = false;
    const startCamera = async () => {
      setCameraError(null);
      stopCameraStream();
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'Camera access is not supported in this browser. Please use Upload Photo instead.',
        );
        return;
      }
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 720 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setCameraError(
          'Could not open camera. Allow camera permission in your browser or upload a photo from your device.',
        );
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [isOpen, mode, facingMode]);

  // Re-generate live cropped preview whenever rawSourceUrl or crop sliders change
  useEffect(() => {
    if (!rawSourceUrl) {
      setPreviewCroppedUrl(null);
      return;
    }
    let active = true;
    cropPortraitToDataUrl(rawSourceUrl, crop)
      .then((res) => {
        if (!active) return;
        setPreviewCroppedUrl(res.croppedDataUrl);
        setSampledTone(res.sampledSkinHex);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [rawSourceUrl, crop]);

  if (!isOpen) return null;

  const persistCapturedPortraitToAlbum = (dataUrl: string, caption: string) => {
    if (!onSaveCapturedPhoto || lastSavedSourceRef.current === dataUrl) return;
    lastSavedSourceRef.current = dataUrl;
    void onSaveCapturedPhoto({ dataUrl, kind: 'avatar', caption });
    setSavedNotice(`Saved photo to ${childName || 'your child'}’s photo album!`);
  };

  const handleSnapFromCamera = () => {
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
    const capturedUrl = canvas.toDataURL('image/jpeg', 0.92);
    stopCameraStream();
    setRawSourceUrl(capturedUrl);
    setCrop({ zoom: 1.3, offsetX: 0, offsetY: 0 });
    setMode('choose-or-frame');
    persistCapturedPortraitToAlbum(capturedUrl, 'Camera portrait');
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsBusy(true);
    setCameraError(null);
    try {
      const url = await readFileAsDataUrl(file);
      setRawSourceUrl(url);
      setCrop({ zoom: 1.25, offsetX: 0, offsetY: 0 });
      setMode('choose-or-frame');
      persistCapturedPortraitToAlbum(url, 'Uploaded portrait');
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Failed to load photo.');
    } finally {
      setIsBusy(false);
      e.target.value = '';
    }
  };

  const handlePickFromDrive = async () => {
    if (!accessToken) return;
    setIsBusy(true);
    setCameraError(null);
    try {
      const picked = await openGoogleDrivePicker(accessToken, {
        viewMode: 'images',
        includeUploadView: true,
        title: `Select a photo of ${childName || 'your child'}`,
      });
      if (picked) {
        const dataUrl = await downloadDriveImageAsDataUrl(accessToken, picked.id);
        setRawSourceUrl(dataUrl);
        setCrop({ zoom: 1.25, offsetX: 0, offsetY: 0 });
        setMode('choose-or-frame');
        persistCapturedPortraitToAlbum(dataUrl, `Drive portrait (${picked.name.slice(0, 60)})`);
      }
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : 'Could not load photo from Google Drive.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmPortrait = () => {
    if (!previewCroppedUrl) return;
    onApplyPhoto({
      croppedDataUrl: previewCroppedUrl,
      sampledSkinHex: useSampledTone ? sampledTone : skinTone,
    });
    onClose();
  };

  const activePreviewSkin = useSampledTone && previewCroppedUrl ? sampledTone : skinTone;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-photo-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="bg-white border-2 border-amber-300 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-sky-100 pb-4">
          <div className="space-y-0.5">
            <h3
              id="avatar-photo-modal-title"
              className="text-lg font-bold text-indigo-950"
            >
              Realistic Photo Avatar for {childName || 'Your Child'}
            </h3>
            <p className="text-xs text-slate-600">
              Take a live camera picture or upload a photo to frame their real face onto their growing character.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close photo studio"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:bg-sky-50 hover:text-indigo-950 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Source Action Strip */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMode(mode === 'camera' ? 'choose-or-frame' : 'camera')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'camera'
                ? 'bg-rose-600 text-white'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
            }`}
          >
            <Camera className="w-4 h-4" aria-hidden="true" />
            {mode === 'camera' ? 'Close Camera' : 'Take Picture'}
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            Upload Photo
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => void handleFileSelected(e)}
            className="hidden"
          />

          {accessToken && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handlePickFromDrive()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-sky-900 bg-sky-100 hover:bg-sky-200 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" aria-hidden="true" />
              Pick from Google Drive
            </button>
          )}
        </div>

        {cameraError && (
          <div
            role="alert"
            className="px-3.5 py-2.5 rounded-lg text-xs font-medium bg-red-50 text-red-900 border border-red-200"
          >
            {cameraError}
          </div>
        )}

        {savedNotice && !cameraError && (
          <div
            role="status"
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>{savedNotice}</span>
          </div>
        )}

        {/* Camera Viewfinder OR Portrait Crop & Live Character Preview */}
        {mode === 'camera' ? (
          <div className="space-y-4">
            <div className="relative mx-auto max-w-sm aspect-square rounded-2xl overflow-hidden bg-slate-900 border-2 border-sky-300">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  facingMode === 'user' ? '-scale-x-100' : ''
                }`}
              />
              {/* Circular Face Framing Overlay */}
              <svg
                viewBox="0 0 200 200"
                className="absolute inset-0 w-full h-full pointer-events-none"
                aria-hidden="true"
              >
                <ellipse
                  cx={100}
                  cy={98}
                  rx={62}
                  ry={74}
                  fill="none"
                  stroke="#facc15"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                />
              </svg>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-sky-900 bg-sky-100 hover:bg-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                Flip Camera
              </button>
              <button
                type="button"
                onClick={handleSnapFromCamera}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                Snap Photo Now
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
            {/* Live Realistic Growing Avatar Preview */}
            <div className="sm:col-span-5 bg-gradient-to-b from-sky-100 to-amber-50 border-2 border-sky-200 rounded-xl p-3 flex flex-col items-center">
              <svg
                viewBox="0 0 220 265"
                className="w-full max-w-[200px] h-auto select-none"
                role="img"
                aria-label="Live preview of child avatar with framed photo"
              >
                <CharacterFigureGroup
                  instanceId="modal_preview"
                  centerX={110}
                  floorY={248}
                  crownY={32}
                  ageMonths={60}
                  heightCm={110}
                  weightKg={19}
                  paletteId={paletteId}
                  accessoryId={previewCroppedUrl ? 'none' : accessoryId}
                  hairStyle={hairStyle}
                  skinTone={activePreviewSkin}
                  hairColor={hairColor}
                  avatarPhotoUrl={previewCroppedUrl}
                  mode="current"
                  isWaveActive
                />
              </svg>
              <p className="text-[11px] font-semibold text-indigo-950 text-center">
                {previewCroppedUrl
                  ? 'Live Realistic Photo Avatar'
                  : 'Take or upload a photo above'}
              </p>
            </div>

            {/* Framing & Complexion Controls */}
            <div className="sm:col-span-7 space-y-4">
              {rawSourceUrl ? (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <ZoomIn className="w-3.5 h-3.5 text-sky-700" aria-hidden="true" />
                        Face Zoom
                      </span>
                      <span className="font-mono tabular-nums text-sky-800">
                        {crop.zoom.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={2.8}
                      step={0.05}
                      value={crop.zoom}
                      onChange={(e) =>
                        setCrop((prev) => ({ ...prev, zoom: parseFloat(e.target.value) }))
                      }
                      className="w-full accent-sky-600 h-2 bg-sky-100 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="pan-x-slider"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Center Left / Right
                      </label>
                      <input
                        id="pan-x-slider"
                        type="range"
                        min={-100}
                        max={100}
                        step={2}
                        value={crop.offsetX}
                        onChange={(e) =>
                          setCrop((prev) => ({
                            ...prev,
                            offsetX: parseInt(e.target.value, 10),
                          }))
                        }
                        className="w-full accent-sky-600 h-2 bg-sky-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="pan-y-slider"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Center Up / Down
                      </label>
                      <input
                        id="pan-y-slider"
                        type="range"
                        min={-100}
                        max={100}
                        step={2}
                        value={crop.offsetY}
                        onChange={(e) =>
                          setCrop((prev) => ({
                            ...prev,
                            offsetY: parseInt(e.target.value, 10),
                          }))
                        }
                        className="w-full accent-sky-600 h-2 bg-sky-100 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useSampledTone}
                        onChange={(e) => setUseSampledTone(e.target.checked)}
                        className="rounded border-slate-300 accent-sky-600"
                      />
                      <span>Match neck &amp; arms to photo skin tone</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                        <circle
                          cx="8"
                          cy="8"
                          r="7"
                          fill={sampledTone || SKIN_TONE_PRESETS[1].hex}
                          stroke="#334155"
                          strokeWidth="1.2"
                        />
                      </svg>
                    </label>

                    <button
                      type="button"
                      onClick={() => setCrop({ zoom: 1.25, offsetX: 0, offsetY: 0 })}
                      className="inline-flex items-center gap-1 text-xs font-bold text-sky-800 hover:text-indigo-950 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      Re-center
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                  <p className="font-semibold text-indigo-950">
                    Tips for a super realistic avatar:
                  </p>
                  <p>
                    1. Have your child face a bright window or playroom light and smile straight at the camera.
                  </p>
                  <p>
                    2. Use the Zoom and Center sliders so their face fills the portrait oval cleanly.
                  </p>
                  <p>
                    3. Their character’s body, arms, and clothes will automatically stretch and grow with every height &amp; weight milestone!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-sky-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!previewCroppedUrl || mode === 'camera'}
            onClick={handleConfirmPortrait}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Check className="w-4 h-4" aria-hidden="true" />
            Use Photo on Avatar
          </button>
        </div>
      </div>
    </div>
  );
};
