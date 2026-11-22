import React, { useState } from 'react';
import {
  Check,
  CloudUpload,
  Download,
  ExternalLink,
  FolderArchive,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import sproutScaleLogoImg from '../assets/images/sproutscale_app_logo_1795072586676.jpg';
import { uploadZipBlobToDrive } from '../services/googleDriveService';

type DownloadVariant = 'meta_1024' | 'social_512' | 'svg_vector' | 'launch_kit_zip';

const LAUNCH_KIT_ZIP_PATH = '/SproutScale-Meta-Launch-Kit.zip';
const LAUNCH_KIT_FILENAME = 'SproutScale-Meta-Launch-Kit.zip';

/**
 * Renders the SproutScale logo image onto an offscreen canvas at exact target pixel dimensions
 * and triggers a clean browser PNG download (exact 1024x1024 required by Meta App Dashboard).
 */
async function downloadLogoPng(
  targetSize: number,
  filename: string,
  fullBleedCrop: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        // Fill sky-blue base so edges are always clean
        ctx.fillStyle = '#2596ff';
        ctx.fillRect(0, 0, targetSize, targetSize);

        if (fullBleedCrop) {
          // Crop cleanly inside the rounded squircle so Meta/iOS/Android apply their own mask with zero outer white border
          const insetRatio = 0.145;
          const sx = Math.round(w * insetRatio);
          const sy = Math.round(h * insetRatio);
          const sw = Math.round(w * (1 - insetRatio * 2));
          const sh = Math.round(h * (1 - insetRatio * 2));
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetSize, targetSize);
        } else {
          ctx.drawImage(img, 0, 0, w, h, 0, 0, targetSize, targetSize);
        }

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Could not load SproutScale logo image.'));
    img.src = sproutScaleLogoImg;
  });
}

interface LogoDownloadCardProps {
  compact?: boolean;
  accessToken?: string | null;
}

export const LogoDownloadCard: React.FC<LogoDownloadCardProps> = ({
  compact = false,
  accessToken = null,
}) => {
  const [downloadedVariant, setDownloadedVariant] = useState<DownloadVariant | null>(null);
  const [isExporting, setIsExporting] = useState<DownloadVariant | null>(null);
  const [isSavingToDrive, setIsSavingToDrive] = useState<boolean>(false);
  const [driveResult, setDriveResult] = useState<{
    status: 'success' | 'error';
    message: string;
    webViewLink?: string;
  } | null>(null);

  const triggerDownload = async (variant: DownloadVariant) => {
    if (isExporting) return;
    setIsExporting(variant);
    try {
      if (variant === 'meta_1024') {
        await downloadLogoPng(1024, 'sproutscale-meta-app-icon-1024x1024.png', true);
      } else if (variant === 'social_512') {
        await downloadLogoPng(512, 'sproutscale-logo-512x512.png', false);
      } else if (variant === 'launch_kit_zip') {
        const res = await fetch(LAUNCH_KIT_ZIP_PATH);
        if (!res.ok) throw new Error('Launch kit archive unavailable.');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = LAUNCH_KIT_FILENAME;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
      } else {
        const link = document.createElement('a');
        link.href = '/icon.svg';
        link.download = 'sproutscale-logo-vector.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setDownloadedVariant(variant);
      window.setTimeout(() => {
        setDownloadedVariant((prev) => (prev === variant ? null : prev));
      }, 2600);
    } catch {
      // Ignore export error
    } finally {
      setIsExporting(null);
    }
  };

  const handleSaveKitToDrive = async () => {
    if (!accessToken || isSavingToDrive) return;
    setIsSavingToDrive(true);
    setDriveResult(null);
    try {
      const res = await fetch(LAUNCH_KIT_ZIP_PATH);
      if (!res.ok) {
        throw new Error('Could not fetch SproutScale-Meta-Launch-Kit.zip.');
      }
      const blob = await res.blob();
      const uploaded = await uploadZipBlobToDrive(accessToken, blob, LAUNCH_KIT_FILENAME);
      setDriveResult({
        status: 'success',
        message: `Saved ${uploaded.name} straight to your Google Drive!`,
        webViewLink: uploaded.webViewLink,
      });
    } catch (err) {
      setDriveResult({
        status: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Could not upload to Google Drive. You can still click Download Launch Kit (.ZIP) directly.',
      });
    } finally {
      setIsSavingToDrive(false);
    }
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-3xl border-2 border-sky-200 dark:border-slate-700 shadow-xs space-y-5 ${
        compact ? 'p-5' : 'p-6'
      }`}
    >
      {/* Featured Complete Launch Kit ZIP Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-sky-50 via-amber-50/70 to-emerald-50/70 dark:from-slate-800 dark:via-slate-800/90 dark:to-indigo-950/60 border-2 border-amber-300 dark:border-amber-500/40 p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
            <FolderArchive className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-display font-extrabold text-indigo-950 dark:text-white">
              Complete Meta &amp; Domain Launch Kit (sprout-scale.com)
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              One ZIP folder with your start-to-finish guide (HTML + Markdown), copy-paste Meta URLs
              &amp; compliant ad copy, <strong>1024×1024 Meta App Icon</strong>, 512×512 FB/IG
              logo, 1200×630 OG banner, 1640×924 Facebook cover, 1080×1080 &amp; 1080×1920 ad
              creatives, and scannable <code>sprout-scale.com</code> QR codes.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={isExporting !== null}
            onClick={() => void triggerDownload('launch_kit_zip')}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            {downloadedVariant === 'launch_kit_zip' ? (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                Downloaded Launch Kit (.ZIP)
              </>
            ) : isExporting === 'launch_kit_zip' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Downloading ZIP...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" aria-hidden="true" />
                Download Launch Kit (.ZIP)
              </>
            )}
          </button>

          {accessToken ? (
            <button
              type="button"
              disabled={isSavingToDrive}
              onClick={() => void handleSaveKitToDrive()}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              {isSavingToDrive ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Saving to Google Drive...
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4" aria-hidden="true" />
                  Save .ZIP to Google Drive
                </>
              )}
            </button>
          ) : (
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Sign in with Google to also save this .ZIP directly into Google Drive in 1 click.
            </span>
          )}
        </div>

        {driveResult && (
          <div
            className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 ${
              driveResult.status === 'success'
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
            }`}
          >
            <span>{driveResult.message}</span>
            {driveResult.webViewLink && (
              <a
                href={driveResult.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline font-bold whitespace-nowrap"
              >
                Open in Google Drive
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Individual Quick Logo Exports */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-sky-200 dark:border-slate-700 bg-sky-50 shadow-xs shrink-0">
          <img
            src={sproutScaleLogoImg}
            alt="SproutScale brand app icon logo"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 space-y-3 text-center sm:text-left">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
              <span>Individual Brand Icon Exports</span>
            </div>
            <h2 className="text-base sm:text-lg font-display font-extrabold text-indigo-950 dark:text-white">
              Quick-Save Standalone Icons &amp; Vector
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Need just a single icon? Export the <strong>1024 × 1024 PNG</strong> Meta App Icon,
              512 × 512 social profile logo, or crisp SVG vector directly.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
            <button
              type="button"
              disabled={isExporting !== null}
              onClick={() => void triggerDownload('meta_1024')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              {downloadedVariant === 'meta_1024' ? (
                <>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  Saved 1024×1024 PNG
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Meta App Icon (1024×1024)
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isExporting !== null}
              onClick={() => void triggerDownload('social_512')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              {downloadedVariant === 'social_512' ? (
                <>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  Saved 512×512 PNG
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" aria-hidden="true" />
                  Social Logo (512×512)
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isExporting !== null}
              onClick={() => void triggerDownload('svg_vector')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-60 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              {downloadedVariant === 'svg_vector' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  Saved SVG
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Vector (.SVG)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface LogoDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken?: string | null;
}

export const LogoDownloadModal: React.FC<LogoDownloadModalProps> = ({
  isOpen,
  onClose,
  accessToken = null,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Download SproutScale Meta Launch Kit & Brand Icons"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close launch kit dialog"
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white shadow-md flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
        <LogoDownloadCard accessToken={accessToken} />
      </div>
    </div>
  );
};
