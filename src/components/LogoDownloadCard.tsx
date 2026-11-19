import React, { useState } from 'react';
import { Check, Download, Image as ImageIcon, Sparkles, X } from 'lucide-react';
import sproutScaleLogoImg from '../assets/images/sproutscale_app_logo_1795072586676.jpg';

type DownloadVariant = 'meta_1024' | 'social_512' | 'svg_vector';

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
}

export const LogoDownloadCard: React.FC<LogoDownloadCardProps> = ({ compact = false }) => {
  const [downloadedVariant, setDownloadedVariant] = useState<DownloadVariant | null>(null);
  const [isExporting, setIsExporting] = useState<DownloadVariant | null>(null);

  const triggerDownload = async (variant: DownloadVariant) => {
    if (isExporting) return;
    setIsExporting(variant);
    try {
      if (variant === 'meta_1024') {
        await downloadLogoPng(1024, 'sproutscale-meta-app-icon-1024x1024.png', true);
      } else if (variant === 'social_512') {
        await downloadLogoPng(512, 'sproutscale-logo-512x512.png', false);
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
      }, 2400);
    } catch {
      // Ignore export error
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div
      className={`bg-white rounded-3xl border-2 border-sky-200 shadow-xs ${
        compact ? 'p-5' : 'p-6'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
        {/* Crisp Logo Preview */}
        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-sky-200 bg-sky-50 shadow-xs shrink-0">
          <img
            src={sproutScaleLogoImg}
            alt="SproutScale brand app icon logo"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Copy & One-Click Download Buttons */}
        <div className="flex-1 space-y-3 text-center sm:text-left">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
              <span>SproutScale Official Brand Logo</span>
            </div>
            <h2 className="text-lg sm:text-xl font-display font-extrabold text-indigo-950">
              Download Logo for Meta App &amp; Social Profiles
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Export the exact <strong>1024 × 1024 PNG</strong> icon required in Meta for Developers (App Settings → Basic → App Icon), a 512 × 512 social profile logo, or a crisp SVG vector.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
            <button
              type="button"
              disabled={isExporting !== null}
              onClick={() => void triggerDownload('meta_1024')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              {downloadedVariant === 'meta_1024' ? (
                <>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  Saved 1024×1024 PNG
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" aria-hidden="true" />
                  {isExporting === 'meta_1024'
                    ? 'Preparing PNG...'
                    : 'Meta App Icon (1024×1024 PNG)'}
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isExporting !== null}
              onClick={() => void triggerDownload('social_512')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              {downloadedVariant === 'social_512' ? (
                <>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  Saved 512×512 PNG
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" aria-hidden="true" />
                  Social Badge (512×512 PNG)
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isExporting !== null}
              onClick={() => void triggerDownload('svg_vector')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-800 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
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
}

export const LogoDownloadModal: React.FC<LogoDownloadModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Download SproutScale Logo"
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close logo download dialog"
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white border-2 border-slate-200 text-slate-700 hover:text-slate-950 shadow-md flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
        <LogoDownloadCard />
      </div>
    </div>
  );
};
