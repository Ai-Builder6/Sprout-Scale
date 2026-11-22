import React, { useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Share2,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { getShareableDownloadUrl, useOnlineStatus } from '../hooks/usePWAInstall';

interface MobileAppDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  onTriggerInstall: () => Promise<boolean>;
}

function buildQrSvgPath(text: string): { size: number; pathData: string } {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const parts: string[] = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (qr.modules.get(r, c)) {
        parts.push(`M${c},${r}h1v1h-1z`);
      }
    }
  }
  return { size, pathData: parts.join('') };
}

export const MobileAppDownloadModal: React.FC<MobileAppDownloadModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  isInstalled,
  isIOS,
  isAndroid,
  onTriggerInstall,
}) => {
  const [selectedPlatformTab, setSelectedPlatformTab] = useState<'ios' | 'android'>(() =>
    isIOS ? 'ios' : 'android',
  );
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [isPromptingInstall, setIsPromptingInstall] = useState<boolean>(false);

  const shareUrl = useMemo(() => getShareableDownloadUrl(), []);
  const qrGeometry = useMemo(() => buildQrSvgPath(shareUrl), [shareUrl]);

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const isRunningInIframe =
    typeof window !== 'undefined' && window.self !== window.top;

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    setShareFeedback(null);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      setShareFeedback('Select and copy the link from the box above.');
    }
  };

  const handleNativeShare = async () => {
    setShareFeedback(null);
    if (!canNativeShare) {
      await handleCopyLink();
      return;
    }
    try {
      await navigator.share({
        title: 'Download SproutScale Kids Growth App',
        text: 'Install SproutScale on your phone to track kids’ height (ft & in) and weight (lb) from Age 2 onward!',
        url: shareUrl,
      });
      setShareFeedback('Shared download link!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.toLowerCase().includes('abort') && !msg.toLowerCase().includes('cancel')) {
        await handleCopyLink();
      }
    }
  };

  const handleDirectInstallClick = async () => {
    setIsPromptingInstall(true);
    try {
      const accepted = await onTriggerInstall();
      if (accepted) {
        onClose();
      }
    } finally {
      setIsPromptingInstall(false);
    }
  };

  const handleDownloadQrCardSvg = () => {
    const pad = 4;
    const total = qrGeometry.size + pad * 2;
    const cardSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 520" width="420" height="520">
  <rect width="420" height="520" rx="28" fill="#e0f2fe" />
  <rect x="20" y="20" width="380" height="480" rx="20" fill="#ffffff" stroke="#facc15" stroke-width="4" />
  <text x="210" y="68" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="bold" fill="#1e1b4b">SproutScale Mobile App</text>
  <text x="210" y="96" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#475569">Scan with your phone camera to install on iPhone or Android</text>
  <g transform="translate(80, 122) scale(${(260 / total).toFixed(4)})">
    <rect width="${total}" height="${total}" rx="2" fill="#ffffff" />
    <g transform="translate(${pad}, ${pad})">
      <path d="${qrGeometry.pathData}" fill="#0f172a" />
    </g>
  </g>
  <text x="210" y="424" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="#0369a1">Kids Height (ft &amp; in) &amp; Weight (lb) Growth Wall</text>
  <text x="210" y="454" text-anchor="middle" font-family="monospace" font-size="9.5" fill="#64748b">${shareUrl.replace(/[<>&"]/g, '')}</text>
</svg>`;
    const blob = new Blob([cardSvg], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'SproutScale_Download_QR_Card.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  const qrPad = 3;
  const qrViewSize = qrGeometry.size + qrPad * 2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-app-download-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-slate-900 border-t-2 sm:border-2 border-amber-300 dark:border-slate-700 rounded-t-3xl sm:rounded-2xl max-w-3xl w-full p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Mobile Sheet Grab Handle */}
        <div className="w-10 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto sm:hidden" aria-hidden="true" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-sky-100 dark:border-slate-800 pb-4">
          <div className="flex items-start gap-3.5">
            <img
              src="/pwa-192x192.png"
              alt="SproutScale mobile app icon"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-2xl shrink-0 border border-sky-200 dark:border-slate-700"
            />
            <div className="space-y-1">
              <h3
                id="mobile-app-download-title"
                className="text-lg sm:text-xl font-bold text-indigo-950 dark:text-white"
              >
                {isInstalled
                  ? 'Share SproutScale Mobile App'
                  : 'Install SproutScale Mobile App'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                Install SproutScale directly onto any iPhone, iPad, or Android home screen for
                full-screen Photo Ruler, Kids Games, and Daytime &amp; Bedtime Storybooks!
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close mobile app download dialog"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800 hover:text-indigo-950 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: Shareable Download Link & Scannable QR Code */}
          <div className="md:col-span-6 bg-sky-50/80 dark:bg-slate-800/70 border border-sky-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-indigo-950 dark:text-white">
                Shareable App Download Link
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Send this link by text, WhatsApp, or email — or scan the QR code with any phone
                camera to open the app installer.
              </p>
            </div>

            {/* Crisp Client-Side SVG QR Code */}
            <div className="flex flex-col items-center justify-center bg-white border border-sky-200 rounded-xl p-4 space-y-2.5">
              <svg
                viewBox={`0 0 ${qrViewSize} ${qrViewSize}`}
                className="w-40 h-40 sm:w-44 sm:h-44"
                role="img"
                aria-label="QR code to download SproutScale mobile app"
              >
                <rect width={qrViewSize} height={qrViewSize} fill="#ffffff" rx={1.5} />
                <g transform={`translate(${qrPad}, ${qrPad})`}>
                  <path d={qrGeometry.pathData} fill="#0f172a" />
                </g>
              </svg>
              <span className="text-[11px] font-semibold text-sky-900">
                Point phone camera at QR code to open &amp; install
              </span>
            </div>

            {/* Copyable URL Field */}
            <div className="space-y-2">
              <label
                htmlFor="share-download-url-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Direct Download URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="share-download-url-input"
                  type="text"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full h-11 px-3 text-xs font-mono bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  className="min-h-[44px] px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-800" aria-hidden="true" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" aria-hidden="true" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Share via Native Sheet + Save QR Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => void handleNativeShare()}
                className="min-h-[44px] px-3.5 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Share2 className="w-4 h-4" aria-hidden="true" />
                {canNativeShare ? 'Share Link...' : 'Copy to Share'}
              </button>

              <button
                type="button"
                onClick={handleDownloadQrCardSvg}
                className="min-h-[44px] px-3.5 py-2.5 text-xs font-bold text-indigo-950 bg-white border border-sky-200 hover:bg-sky-100 rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4 text-sky-700" aria-hidden="true" />
                Save QR Card
              </button>
            </div>

            {shareFeedback && (
              <p className="text-xs font-medium text-emerald-800">{shareFeedback}</p>
            )}
          </div>

          {/* Right Column: One-Tap Install & Step-by-Step Phone Guide */}
          <div className="md:col-span-6 space-y-4">
            {isInstalled ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <p className="text-sm font-bold text-emerald-950">
                  SproutScale Is Installed on This Device
                </p>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  You’re running the full-screen SproutScale app! Use the link or QR code on the
                  left so family members can install it on their phones too.
                </p>
              </div>
            ) : isInstallable ? (
              <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-indigo-950">
                    Ready for One-Tap App Install
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Add SproutScale directly to your home screen or app launcher with full-screen
                    mode and offline wall viewing.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isPromptingInstall}
                  onClick={() => void handleDirectInstallClick()}
                  className="w-full min-h-[46px] px-4 py-2.5 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 rounded-xl shadow-xs transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  {isPromptingInstall ? 'Opening Installer...' : 'Install SproutScale App Now'}
                </button>
              </div>
            ) : isRunningInIframe ? (
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-2.5">
                <p className="text-xs font-bold text-indigo-950">
                  Tip: Open Direct Link in Browser Tab to Install
                </p>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Browsers disable home-screen installation inside embedded preview frames. Open
                  the direct link in Safari or Chrome (or scan the QR code on your phone) to
                  install!
                </p>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Open App Installer in New Tab
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            ) : null}

            {/* Platform Segmented Guide: iPhone / iPad vs Android / Chrome */}
            <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-indigo-950 dark:text-white">
                  How Anyone Can Install on Their Phone
                </span>
                <div className="flex items-center gap-1 p-1 bg-sky-100 dark:bg-slate-900 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSelectedPlatformTab('ios')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedPlatformTab === 'ios'
                        ? 'bg-white dark:bg-slate-700 text-indigo-950 dark:text-white shadow-xs'
                        : 'text-sky-900 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
                    }`}
                  >
                    iPhone / iPad
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlatformTab('android')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedPlatformTab === 'android'
                        ? 'bg-white dark:bg-slate-700 text-indigo-950 dark:text-white shadow-xs'
                        : 'text-sky-900 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
                    }`}
                  >
                    {isAndroid ? 'Android (This Device)' : 'Android / Chrome'}
                  </button>
                </div>
              </div>

              {selectedPlatformTab === 'ios' ? (
                <ol className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="font-mono font-bold text-sky-700 dark:text-sky-400 shrink-0">01.</span>
                    <span>
                      Open the shared link in <strong>Safari</strong> on iPhone or iPad (or scan
                      the QR code with the Camera app).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-mono font-bold text-sky-700 dark:text-sky-400 shrink-0">02.</span>
                    <span>
                      Tap the <strong>Share</strong> button (square with upward arrow) in the
                      Safari toolbar.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-mono font-bold text-sky-700 dark:text-sky-400 shrink-0">03.</span>
                    <span>
                      Scroll down and tap <strong>Add to Home Screen</strong>, then tap{' '}
                      <strong>Add</strong> — SproutScale appears right beside your native apps!
                    </span>
                  </li>
                </ol>
              ) : (
                <ol className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 shrink-0">01.</span>
                    <span>
                      Open the shared link in <strong>Chrome</strong> (or Samsung Internet / Edge)
                      on Android or desktop.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 shrink-0">02.</span>
                    <span>
                      Tap <strong>Install SproutScale App</strong> right on the page — or tap the{' '}
                      <strong>⋮ browser menu</strong> in the top corner.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 shrink-0">03.</span>
                    <span>
                      Choose <strong>Install app</strong> / <strong>Add to Home screen</strong> to
                      launch SproutScale full-screen anytime.
                    </span>
                  </li>
                </ol>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Works on iOS &amp; Android</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>No App Store fee</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>Full-screen mobile experience</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PWAInstallActionStrip: React.FC<{
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onDirectInstall: () => Promise<boolean>;
  onOpenDownloadModal: () => void;
}> = ({
  isInstallable,
  isInstalled,
  isIOS,
  onDirectInstall,
  onOpenDownloadModal,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isInstalled && isInstallable && (
        <button
          type="button"
          onClick={() => void onDirectInstall()}
          className="min-h-[40px] px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          Install App
        </button>
      )}

      {!isInstalled && !isInstallable && (
        <button
          type="button"
          onClick={onOpenDownloadModal}
          className="min-h-[40px] px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
          {isIOS ? 'Install on iPhone' : 'Download Mobile App'}
        </button>
      )}

      <button
        type="button"
        onClick={onOpenDownloadModal}
        className="min-h-[40px] px-3 py-2 text-xs font-bold text-indigo-950 bg-white border border-sky-300 hover:bg-sky-50 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Share2 className="w-3.5 h-3.5 text-sky-700" aria-hidden="true" />
        Share App Link
      </button>
    </div>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg border border-amber-600"
    >
      <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>Offline Mode — Viewing cached Growth Wall.</span>
    </div>
  );
};
