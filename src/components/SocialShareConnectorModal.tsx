import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Instagram,
  Link2,
  LogOut,
  Send,
  Share2,
  Smartphone,
  X,
} from 'lucide-react';
import {
  ChildPhotoRecord,
  ChildProfile,
  formatAgeLabel,
  formatFeetInches,
  formatHeightDelta,
  formatHumanDate,
  formatPounds,
  getLocalTodayIso,
  GrowthMeasurement,
  MilestoneEventRecord,
} from '../types';
import {
  disconnectMetaAccount,
  fetchMetaAuthUrl,
  fetchMetaConnectionStatus,
  MetaConnectionStatus,
  MetaPublishTarget,
  publishToMetaSocial,
} from '../services/metaSocialService';
import {
  dataUrlToJpegFile,
  renderSocialShareCardJpeg,
  ShareCardFormat,
  ShareCardTheme,
} from '../services/socialShareCardService';
import { useDefaultAppAvatar } from '../services/defaultAvatarService';

export interface SocialShareInitialContext {
  photoId?: string | null;
  headline?: string;
  caption?: string;
  dateIso?: string;
  ageMonths?: number;
  heightCm?: number;
  weightKg?: number;
}

interface SocialShareConnectorModalProps {
  isOpen: boolean;
  childProfile: ChildProfile;
  avatarPhotoUrl: string | null;
  photos: ChildPhotoRecord[];
  events: MilestoneEventRecord[];
  measurements: GrowthMeasurement[];
  initialContext?: SocialShareInitialContext | null;
  onClose: () => void;
}

export const SocialShareConnectorModal: React.FC<SocialShareConnectorModalProps> = ({
  isOpen,
  childProfile,
  avatarPhotoUrl,
  photos,
  events,
  measurements,
  initialContext,
  onClose,
}) => {
  const defaultAppAvatar = useDefaultAppAvatar();
  void avatarPhotoUrl;
  const effectiveAvatarUrl = defaultAppAvatar.portraitUrl;

  // Share card configuration
  const [format, setFormat] = useState<ShareCardFormat>('story_9_16');
  const [theme, setTheme] = useState<ShareCardTheme>('sunny');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>('');
  const [headline, setHeadline] = useState<string>('');
  const [caption, setCaption] = useState<string>('');
  const [dateIso, setDateIso] = useState<string>(getLocalTodayIso());
  const [ageMonths, setAgeMonths] = useState<number>(24);
  const [heightCm, setHeightCm] = useState<number>(0);
  const [weightKg, setWeightKg] = useState<number>(0);

  // Parent privacy toggles
  const [showChildName, setShowChildName] = useState<boolean>(true);
  const [includeMeasurements, setIncludeMeasurements] = useState<boolean>(true);
  const [includeDateAndAge, setIncludeDateAndAge] = useState<boolean>(true);
  const [includeGrowthGain, setIncludeGrowthGain] = useState<boolean>(true);

  // Rendered JPEG state
  const [renderedJpeg, setRenderedJpeg] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(false);

  // Meta OAuth Connector state
  const [metaStatus, setMetaStatus] = useState<MetaConnectionStatus | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(false);
  const [isConnectingMeta, setIsConnectingMeta] = useState<boolean>(false);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [publishingTarget, setPublishingTarget] = useState<MetaPublishTarget | null>(null);

  // Feedback states
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);
  const [copiedCallback, setCopiedCallback] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const photosWithImage = useMemo(
    () => photos.filter((p) => Boolean(p.localDataUrl)),
    [photos],
  );

  const latestMeasurement = useMemo(() => {
    if (measurements.length === 0) return null;
    return [...measurements].sort((a, b) => b.ageMonths - a.ageMonths)[0];
  }, [measurements]);

  const activePhotoDataUrl = useMemo(() => {
    if (selectedPhotoId === '__none__') return null;
    if (selectedPhotoId === '__avatar__') return effectiveAvatarUrl;
    const found = photosWithImage.find((p) => p.id === selectedPhotoId);
    if (found?.localDataUrl) return found.localDataUrl;
    return effectiveAvatarUrl;
  }, [selectedPhotoId, photosWithImage, effectiveAvatarUrl]);

  const loadMetaStatus = useCallback(async () => {
    setIsLoadingMeta(true);
    try {
      const status = await fetchMetaConnectionStatus();
      setMetaStatus(status);
      if (status.account?.pages.length) {
        setSelectedPageId((prev) =>
          status.account?.pages.some((p) => p.id === prev)
            ? prev
            : status.account!.pages[0].id,
        );
      } else {
        setSelectedPageId('');
      }
    } catch {
      setMetaStatus(null);
    } finally {
      setIsLoadingMeta(false);
    }
  }, []);

  // Initialize fields when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setFeedback(null);
    setCopiedCaption(false);

    const matchedPhoto = initialContext?.photoId
      ? photosWithImage.find((p) => p.id === initialContext.photoId)
      : photosWithImage[0];

    if (initialContext?.photoId === '__none__') {
      setSelectedPhotoId('__none__');
    } else if (matchedPhoto) {
      setSelectedPhotoId(matchedPhoto.id);
    } else if (effectiveAvatarUrl) {
      setSelectedPhotoId('__avatar__');
    } else {
      setSelectedPhotoId('__none__');
    }

    const startDate =
      initialContext?.dateIso ||
      matchedPhoto?.capturedDate ||
      events[0]?.eventDate ||
      latestMeasurement?.recordedDate ||
      getLocalTodayIso();
    const startAge =
      initialContext?.ageMonths ??
      matchedPhoto?.ageMonths ??
      latestMeasurement?.ageMonths ??
      24;
    const startHeight =
      initialContext?.heightCm ??
      (matchedPhoto && matchedPhoto.heightCm > 0
        ? matchedPhoto.heightCm
        : latestMeasurement?.heightCm ?? childProfile.ageTwoHeightCm);
    const startWeight =
      initialContext?.weightKg ??
      (matchedPhoto && matchedPhoto.weightKg > 0
        ? matchedPhoto.weightKg
        : latestMeasurement?.weightKg ?? childProfile.ageTwoWeightKg);

    const startHeadline =
      initialContext?.headline ||
      matchedPhoto?.eventTitle ||
      events[0]?.title ||
      `${childProfile.name} at ${formatAgeLabel(startAge)}`;

    const gainedCm = Math.max(0, startHeight - childProfile.ageTwoHeightCm);
    const defaultStoryCaption =
      initialContext?.caption ||
      matchedPhoto?.caption ||
      `${childProfile.name} is now ${formatFeetInches(startHeight)} (${formatPounds(startWeight)})${
        gainedCm >= 0.4
          ? ` — ${formatHeightDelta(gainedCm, 'imperial')} taller since Age 2!`
          : '!'
      }`;

    setDateIso(startDate);
    setAgeMonths(startAge);
    setHeightCm(startHeight);
    setWeightKg(startWeight);
    setHeadline(startHeadline);
    setCaption(defaultStoryCaption);
    setShowChildName(true);
    setIncludeMeasurements(startHeight > 0);
    setIncludeDateAndAge(true);
    setIncludeGrowthGain(true);

    void loadMetaStatus();
  }, [
    isOpen,
    initialContext,
    childProfile.id,
    childProfile.name,
    childProfile.ageTwoHeightCm,
    childProfile.ageTwoWeightKg,
    photosWithImage,
    events,
    latestMeasurement,
    avatarPhotoUrl,
    loadMetaStatus,
  ]);

  // Listen for Meta OAuth popup postMessage completion
  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'META_OAUTH_SUCCESS') {
        setIsConnectingMeta(false);
        setFeedback({
          type: 'success',
          message: 'Connected to Facebook & Instagram! Choose a Page or Instagram account below to share.',
        });
        void loadMetaStatus();
      } else if (event.data?.type === 'META_OAUTH_ERROR') {
        setIsConnectingMeta(false);
        setFeedback({
          type: 'error',
          message: String(
            event.data?.message || 'Facebook & Instagram sign-in was not completed.',
          ),
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, loadMetaStatus]);

  // Re-render live Canvas share card whenever options change
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsRendering(true);
    const timer = window.setTimeout(() => {
      void renderSocialShareCardJpeg({
        format,
        theme,
        childName: childProfile.name,
        showChildName,
        headline,
        caption,
        dateIso,
        ageMonths,
        heightCm,
        weightKg,
        ageTwoHeightCm: childProfile.ageTwoHeightCm,
        includeMeasurements,
        includeDateAndAge,
        includeGrowthGain,
        photoDataUrl: activePhotoDataUrl,
      })
        .then((jpeg) => {
          if (!cancelled) {
            setRenderedJpeg(jpeg);
            setIsRendering(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setIsRendering(false);
          }
        });
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    isOpen,
    format,
    theme,
    childProfile.name,
    childProfile.ageTwoHeightCm,
    showChildName,
    headline,
    caption,
    dateIso,
    ageMonths,
    heightCm,
    weightKg,
    includeMeasurements,
    includeDateAndAge,
    includeGrowthGain,
    activePhotoDataUrl,
  ]);

  if (!isOpen) return null;

  const selectedPage =
    metaStatus?.account?.pages.find((p) => p.id === selectedPageId) ??
    metaStatus?.account?.pages[0] ??
    null;

  const fullSocialCaption = [
    headline.trim(),
    caption.trim(),
    includeMeasurements && heightCm > 0
      ? `${formatFeetInches(heightCm)}${weightKg > 0 ? ` · ${formatPounds(weightKg)}` : ''} (${formatAgeLabel(ageMonths)})`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const handleSelectPortfolioPhoto = (nextId: string) => {
    setSelectedPhotoId(nextId);
    const found = photosWithImage.find((p) => p.id === nextId);
    if (found) {
      setDateIso(found.capturedDate);
      setAgeMonths(found.ageMonths);
      if (found.heightCm > 0) setHeightCm(found.heightCm);
      if (found.weightKg > 0) setWeightKg(found.weightKg);
      if (found.eventTitle) setHeadline(found.eventTitle);
      if (found.caption) setCaption(found.caption);
    }
  };

  const handleConnectMetaOAuth = async () => {
    setFeedback(null);
    setIsConnectingMeta(true);
    try {
      const { url } = await fetchMetaAuthUrl();
      // OAuth skill rule: open the OAuth provider's authorization URL directly in popup
      const popup = window.open(
        url,
        'meta_oauth_popup',
        'width=620,height=720,noopener=no',
      );
      if (!popup) {
        setIsConnectingMeta(false);
        setFeedback({
          type: 'error',
          message:
            'Your browser blocked the sign-in popup. Please allow popups for this site and click Connect again.',
        });
      }
    } catch (err) {
      setIsConnectingMeta(false);
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Could not start Facebook & Instagram sign-in.',
      });
    }
  };

  const handleDisconnectMeta = async () => {
    await disconnectMetaAccount();
    setFeedback({
      type: 'success',
      message: 'Disconnected Facebook & Instagram account.',
    });
    await loadMetaStatus();
  };

  const handleDirectMetaPublish = async (target: MetaPublishTarget) => {
    if (!renderedJpeg || !selectedPage) return;
    setFeedback(null);
    setPublishingTarget(target);
    try {
      const res = await publishToMetaSocial({
        target,
        pageId: selectedPage.id,
        instagramAccountId: selectedPage.instagramAccount?.id,
        imageDataUrl: renderedJpeg,
        caption: fullSocialCaption,
      });
      setFeedback({
        type: 'success',
        message: `Published to ${res.platformLabel}!`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Could not publish right now. Please try again.',
      });
    } finally {
      setPublishingTarget(null);
    }
  };

  const handleDownloadShareCard = () => {
    if (!renderedJpeg) return;
    const safeName = childProfile.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Child';
    const suffix = format === 'story_9_16' ? 'Story_9x16' : 'Post_4x5';
    const link = document.createElement('a');
    link.href = renderedJpeg;
    link.download = `SproutScale_${safeName}_${suffix}_${dateIso}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setFeedback({
      type: 'success',
      message: `Saved ${format === 'story_9_16' ? '9:16 Story' : '4:5 Feed'} JPEG — ready to share on Instagram or Facebook!`,
    });
  };

  const handleNativeMobileShare = async () => {
    if (!renderedJpeg) return;
    setFeedback(null);
    const safeName = childProfile.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Child';
    const fileName = `SproutScale_${safeName}_${format === 'story_9_16' ? 'Story' : 'Post'}.jpg`;
    try {
      const file = dataUrlToJpegFile(renderedJpeg, fileName);
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          files: [file],
          title: headline || `${childProfile.name}’s Growth Milestone`,
          text: fullSocialCaption,
        });
        setFeedback({
          type: 'success',
          message: 'Opened your device share sheet for Instagram & Facebook!',
        });
        return;
      }
      // Graceful fallback on desktop browsers without Web Share file support
      handleDownloadShareCard();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      handleDownloadShareCard();
    }
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(fullSocialCaption);
      setCopiedCaption(true);
      window.setTimeout(() => setCopiedCaption(false), 2500);
    } catch {
      // Ignore clipboard permission failure
    }
  };

  const callbackUrlDisplay =
    metaStatus?.callbackUrl || `${window.location.origin}/auth/meta/callback`;

  const handleCopyCallbackUrl = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrlDisplay);
      setCopiedCallback(true);
      window.setTimeout(() => setCopiedCallback(false), 2500);
    } catch {
      // Ignore clipboard permission failure
    }
  };

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="social-share-studio-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-white border-2 border-amber-300 rounded-2xl max-w-5xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-sky-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-sky-700 shrink-0" aria-hidden="true" />
              <h3
                id="social-share-studio-title"
                className="text-lg sm:text-xl font-bold text-indigo-950"
              >
                Facebook &amp; Instagram Share Studio — {childProfile.name}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              Turn any portfolio photo or milestone into a ready-to-post Story (9:16) or Feed
              card (4:5), then share straight to Instagram &amp; Facebook.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Facebook and Instagram share studio"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-sky-50 hover:text-indigo-950 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {feedback && (
          <div
            role="status"
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Two-Column Studio Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Story / Feed Card Preview */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div
                role="tablist"
                aria-label="Social post format"
                className="inline-flex items-center gap-1 p-1 bg-sky-100 rounded-lg"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={format === 'story_9_16'}
                  onClick={() => setFormat('story_9_16')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    format === 'story_9_16'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-sky-950 hover:text-indigo-950'
                  }`}
                >
                  Story (9:16)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={format === 'post_4_5'}
                  onClick={() => setFormat('post_4_5')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    format === 'post_4_5'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-sky-950 hover:text-indigo-950'
                  }`}
                >
                  Feed Post (4:5)
                </button>
              </div>

              <div
                role="group"
                aria-label="Card color theme"
                className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
              >
                {(['sunny', 'editorial', 'midnight'] as ShareCardTheme[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-md capitalize transition-colors cursor-pointer ${
                      theme === t
                        ? 'bg-white text-indigo-950 shadow-xs'
                        : 'text-slate-600 hover:text-indigo-950'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-200 p-3 flex items-center justify-center min-h-[380px]">
              {renderedJpeg ? (
                <img
                  src={renderedJpeg}
                  alt={`Preview of ${childProfile.name}’s ${format === 'story_9_16' ? 'Story' : 'Feed'} share card`}
                  className={`rounded-xl shadow-lg object-contain transition-opacity ${
                    format === 'story_9_16' ? 'max-h-[460px]' : 'max-h-[420px]'
                  } ${isRendering ? 'opacity-70' : 'opacity-100'}`}
                />
              ) : (
                <p className="text-xs text-slate-300">Rendering preview...</p>
              )}
            </div>

            {/* Quick Photo Selector Strip */}
            {(photosWithImage.length > 0 || effectiveAvatarUrl) && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-600">
                  Choose photo from {childProfile.name}’s portfolio:
                </p>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {photosWithImage.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPortfolioPhoto(p.id)}
                      className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer transition-transform ${
                        selectedPhotoId === p.id
                          ? 'border-amber-400 scale-[1.03]'
                          : 'border-slate-200 hover:border-sky-400'
                      }`}
                    >
                      <img
                        src={p.localDataUrl}
                        alt={p.eventTitle || formatHumanDate(p.capturedDate)}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                  {effectiveAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => setSelectedPhotoId('__avatar__')}
                      className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer bg-sky-50 ${
                        selectedPhotoId === '__avatar__'
                          ? 'border-amber-400'
                          : 'border-slate-200 hover:border-sky-400'
                      }`}
                    >
                      <img
                        src={effectiveAvatarUrl}
                        alt={`${childProfile.name} portrait`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-top"
                      />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedPhotoId('__none__')}
                    className={`px-2.5 h-14 rounded-lg border-2 text-[11px] font-bold shrink-0 cursor-pointer ${
                      selectedPhotoId === '__none__'
                        ? 'border-amber-400 bg-indigo-950 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-400'
                    }`}
                  >
                    Text Card
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Caption, Privacy Toggles, Instant Share & Meta OAuth Connector */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Headline, Caption & Parent Privacy Controls */}
            <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-indigo-950">
                  1. Story Text &amp; Privacy Controls
                </h4>
                <button
                  type="button"
                  onClick={() => void handleCopyCaption()}
                  className="inline-flex items-center gap-1 text-xs font-bold text-sky-800 hover:text-indigo-950 cursor-pointer"
                >
                  {copiedCaption ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                      Copied Caption
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      Copy Caption
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-2.5">
                <input
                  type="text"
                  maxLength={80}
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Story headline (e.g., First Day of School!)"
                  className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <textarea
                  rows={2}
                  maxLength={300}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a note or caption for friends & family..."
                  className="w-full p-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs text-slate-700">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showChildName}
                    onChange={(e) => setShowChildName(e.target.checked)}
                    className="rounded accent-sky-600"
                  />
                  Show name
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMeasurements}
                    onChange={(e) => setIncludeMeasurements(e.target.checked)}
                    className="rounded accent-sky-600"
                  />
                  Show height &amp; weight
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDateAndAge}
                    onChange={(e) => setIncludeDateAndAge(e.target.checked)}
                    className="rounded accent-sky-600"
                  />
                  Show date &amp; age
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeGrowthGain}
                    onChange={(e) => setIncludeGrowthGain(e.target.checked)}
                    className="rounded accent-sky-600"
                  />
                  Show +in since Age 2
                </label>
              </div>
            </div>

            {/* 2. Instant Personal Share (Works immediately on Phone & Desktop) */}
            <div className="space-y-3 bg-sky-50/70 border border-sky-200 rounded-xl p-4">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-indigo-950">
                  2. Share to Personal Instagram Story or Facebook Now
                </h4>
                <p className="text-xs text-slate-600">
                  Works immediately with any personal Instagram or Facebook account — no Business
                  Page required.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={!renderedJpeg}
                  onClick={() => void handleNativeMobileShare()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" aria-hidden="true" />
                  {canNativeShare
                    ? 'Share to Instagram / Facebook App'
                    : 'Download Ready-to-Post Story JPG'}
                </button>

                <button
                  type="button"
                  disabled={!renderedJpeg}
                  onClick={handleDownloadShareCard}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-sky-950 bg-white hover:bg-sky-100 border border-sky-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Download {format === 'story_9_16' ? '9:16 Story' : '4:5 Post'} JPG
                </button>
              </div>
            </div>

            {/* 3. Direct Facebook & Instagram OAuth Connector (Meta Graph API) */}
            <div className="space-y-3.5 border border-indigo-200 bg-white rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-indigo-700 shrink-0" aria-hidden="true" />
                    <h4 className="text-xs font-bold text-indigo-950">
                      3. Direct Facebook &amp; Instagram Account Connector (Meta OAuth)
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600">
                    Connect your Meta account to publish photos and Instagram Stories directly from
                    SproutScale (supports Facebook Pages &amp; linked Instagram Creator/Business
                    accounts).
                  </p>
                </div>

                {metaStatus?.connected && (
                  <button
                    type="button"
                    onClick={() => void handleDisconnectMeta()}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-rose-700 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    Disconnect
                  </button>
                )}
              </div>

              {isLoadingMeta ? (
                <p className="text-xs text-slate-500">Checking Facebook &amp; Instagram connection...</p>
              ) : metaStatus?.connected && metaStatus.account ? (
                <div className="space-y-3 pt-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-900 font-semibold">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>Connected as {metaStatus.account.userName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-600 font-normal">
                      {metaStatus.account.pages.length}{' '}
                      {metaStatus.account.pages.length === 1 ? 'Page' : 'Pages'} authorized
                    </span>
                  </div>

                  {metaStatus.account.pages.length === 0 ? (
                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      Meta requires a Facebook Page (and linked Instagram Creator/Business account)
                      for direct API publishing. Reconnect and select a Page, or use the Instant
                      Personal Share button above.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label
                          htmlFor="meta-page-select"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Publish Destination (Facebook Page &amp; Linked Instagram)
                        </label>
                        <select
                          id="meta-page-select"
                          value={selectedPage?.id || ''}
                          onChange={(e) => setSelectedPageId(e.target.value)}
                          className="w-full h-9 px-3 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-indigo-950"
                        >
                          {metaStatus.account.pages.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                              {p.instagramAccount
                                ? ` · Instagram @${p.instagramAccount.username}`
                                : ' · Facebook only'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={Boolean(publishingTarget) || !renderedJpeg}
                          onClick={() => void handleDirectMetaPublish('facebook_photo')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" aria-hidden="true" />
                          {publishingTarget === 'facebook_photo'
                            ? 'Publishing to Facebook...'
                            : 'Post to Facebook'}
                        </button>

                        {selectedPage?.instagramAccount && (
                          <>
                            <button
                              type="button"
                              disabled={Boolean(publishingTarget) || !renderedJpeg}
                              onClick={() => void handleDirectMetaPublish('instagram_feed')}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Instagram className="w-3.5 h-3.5" aria-hidden="true" />
                              {publishingTarget === 'instagram_feed'
                                ? 'Posting...'
                                : 'Post to Instagram'}
                            </button>

                            <button
                              type="button"
                              disabled={Boolean(publishingTarget) || !renderedJpeg}
                              onClick={() => void handleDirectMetaPublish('instagram_story')}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-950 bg-amber-300 hover:bg-amber-400 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Instagram className="w-3.5 h-3.5" aria-hidden="true" />
                              {publishingTarget === 'instagram_story'
                                ? 'Sharing Story...'
                                : 'Publish IG Story'}
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {metaStatus?.configured ? (
                    <button
                      type="button"
                      disabled={isConnectingMeta}
                      onClick={() => void handleConnectMetaOAuth()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      {isConnectingMeta
                        ? 'Waiting for Meta Sign-In...'
                        : 'Connect Facebook & Instagram'}
                    </button>
                  ) : (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2 text-xs text-slate-700">
                      <p className="font-semibold text-indigo-950">
                        Enable Direct Publishing with Your Meta App Credentials
                      </p>
                      <p className="leading-relaxed">
                        To turn on 1-click direct Facebook &amp; Instagram publishing, add{' '}
                        <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">
                          META_APP_ID
                        </code>{' '}
                        and{' '}
                        <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">
                          META_APP_SECRET
                        </code>{' '}
                        in AI Studio Secrets and register this Valid OAuth Redirect URI in your
                        Meta Developer App:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate font-mono text-[11px] bg-white px-2.5 py-1.5 rounded border border-slate-200 text-slate-800">
                          {callbackUrlDisplay}
                        </code>
                        <button
                          type="button"
                          onClick={() => void handleCopyCallbackUrl()}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-sky-900 bg-sky-100 hover:bg-sky-200 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {copiedCallback ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                              Copy URI
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
