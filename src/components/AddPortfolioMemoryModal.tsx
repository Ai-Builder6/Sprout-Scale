import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Camera,
  Check,
  FolderOpen,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  calculateExactAgeFromDob,
  ChildPhotoKind,
  ChildProfile,
  clampNumber,
  EVENT_CATEGORY_LABELS,
  formatAgeLabel,
  formatFeetInches,
  formatHumanDate,
  formatPounds,
  getLocalTodayIso,
  GrowthMeasurement,
  inchesToCm,
  kgToLbs,
  lbsToKg,
  MilestoneEventCategory,
  PHOTO_KIND_LABELS,
  splitCmToFeetAndInches,
  VALIDATION_BOUNDS,
} from '../types';
import { readFileAsDataUrl } from '../services/avatarPhotoService';
import {
  downloadDriveImageAsDataUrl,
  openGoogleDrivePicker,
} from '../services/googleDriveService';

export interface InitialMemoryModalContext {
  dateIso?: string;
  ageMonths?: number;
  heightCm?: number;
  weightKg?: number;
  linkedMeasurementId?: string;
  suggestedTitle?: string;
  mode?: 'photo_and_event' | 'event_only';
}

export interface CreatePortfolioMemoryPayload {
  photosDataUrls: string[];
  photoKind: ChildPhotoKind;
  isFavorite: boolean;
  createEventRecord: boolean;
  eventTitle: string;
  eventCategory: MilestoneEventCategory;
  story: string;
  dateIso: string;
  ageMonths: number;
  includeMeasurements: boolean;
  heightCm: number;
  weightKg: number;
  linkedMeasurementId: string;
  alsoSaveWallMeasurement: boolean;
}

interface AddPortfolioMemoryModalProps {
  isOpen: boolean;
  childProfile: ChildProfile;
  measurements: GrowthMeasurement[];
  currentDraftHeightCm: number;
  currentDraftWeightKg: number;
  currentDraftAgeMonths: number;
  accessToken: string | null;
  isSaving: boolean;
  initialContext?: InitialMemoryModalContext | null;
  onClose: () => void;
  onSaveMemory: (payload: CreatePortfolioMemoryPayload) => Promise<void>;
}

const QUICK_EVENT_IDEAS: {
  label: string;
  title: string;
  category: MilestoneEventCategory;
  photoKind: ChildPhotoKind;
}[] = [
  {
    label: 'Birthday',
    title: 'Birthday Celebration!',
    category: 'birthday',
    photoKind: 'event',
  },
  {
    label: 'First Day of School',
    title: 'First Day of School',
    category: 'school',
    photoKind: 'school',
  },
  {
    label: 'Lost a Tooth',
    title: 'Lost a Tooth!',
    category: 'firsts',
    photoKind: 'milestone',
  },
  {
    label: 'Wall Height Check',
    title: 'Wall Height Check-In',
    category: 'celebration',
    photoKind: 'wall',
  },
  {
    label: 'Doctor Wellness Visit',
    title: 'Pediatric Wellness Checkup',
    category: 'health',
    photoKind: 'milestone',
  },
  {
    label: 'Family Adventure',
    title: 'Family Outing & Adventure',
    category: 'adventure',
    photoKind: 'family',
  },
];

export const AddPortfolioMemoryModal: React.FC<AddPortfolioMemoryModalProps> = ({
  isOpen,
  childProfile,
  measurements,
  currentDraftHeightCm,
  currentDraftWeightKg,
  currentDraftAgeMonths,
  accessToken,
  isSaving,
  initialContext,
  onClose,
  onSaveMemory,
}) => {
  const [photosDataUrls, setPhotosDataUrls] = useState<string[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const [dateIso, setDateIso] = useState<string>(getLocalTodayIso());
  const [ageMonths, setAgeMonths] = useState<number>(currentDraftAgeMonths);
  const [eventTitle, setEventTitle] = useState<string>('');
  const [story, setStory] = useState<string>('');
  const [photoKind, setPhotoKind] = useState<ChildPhotoKind>('milestone');
  const [eventCategory, setEventCategory] =
    useState<MilestoneEventCategory>('celebration');
  const [isFavorite, setIsFavorite] = useState<boolean>(false);

  const [includeMeasurements, setIncludeMeasurements] = useState<boolean>(true);
  const [feet, setFeet] = useState<number>(3);
  const [inches, setInches] = useState<number>(6.0);
  const [weightLbs, setWeightLbs] = useState<number>(36.0);
  const [linkedMeasurementId, setLinkedMeasurementId] = useState<string>('');
  const [alsoSaveWallMeasurement, setAlsoSaveWallMeasurement] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // Initialize form whenever modal opens
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setIsCameraOpen(false);
      return;
    }

    const startIso = initialContext?.dateIso || getLocalTodayIso();
    setDateIso(startIso);

    const calcAge = childProfile.birthDate
      ? calculateExactAgeFromDob(childProfile.birthDate, startIso)?.totalMonths
      : undefined;
    const startAge = initialContext?.ageMonths ?? calcAge ?? currentDraftAgeMonths;
    setAgeMonths(startAge);

    const startH = initialContext?.heightCm ?? currentDraftHeightCm;
    const startW = initialContext?.weightKg ?? currentDraftWeightKg;
    const splitH = splitCmToFeetAndInches(startH);
    setFeet(splitH.feet);
    setInches(splitH.inches);
    setWeightLbs(Number(kgToLbs(startW).toFixed(1)));

    setLinkedMeasurementId(initialContext?.linkedMeasurementId || '');
    setIncludeMeasurements(true);
    setAlsoSaveWallMeasurement(false);
    setEventTitle(initialContext?.suggestedTitle || '');
    setStory('');
    setPhotoKind('milestone');
    setEventCategory('celebration');
    setIsFavorite(false);
    setPhotosDataUrls([]);
    setErrorMessage(null);
  }, [
    isOpen,
    initialContext,
    childProfile.id,
    childProfile.birthDate,
    currentDraftHeightCm,
    currentDraftWeightKg,
    currentDraftAgeMonths,
  ]);

  // Camera lifecycle
  useEffect(() => {
    if (!isOpen || !isCameraOpen) {
      stopCamera();
      return;
    }
    let cancelled = false;
    const startStream = async () => {
      stopCamera();
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMessage('Camera is not supported in this browser. Upload photos instead.');
        setIsCameraOpen(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
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
        setErrorMessage('Could not access camera. Check browser permission or upload a photo.');
        setIsCameraOpen(false);
      }
    };
    void startStream();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, isCameraOpen, facingMode]);

  // Find closest recorded measurement to the chosen date/age so parents can sync in 1 tap
  const matchingMeasurement = useMemo(() => {
    if (measurements.length === 0) return null;
    const exactDateMatch = measurements.find((m) => m.recordedDate === dateIso);
    if (exactDateMatch) return exactDateMatch;
    const sortedByAgeDist = [...measurements].sort(
      (a, b) => Math.abs(a.ageMonths - ageMonths) - Math.abs(b.ageMonths - ageMonths),
    );
    const closest = sortedByAgeDist[0];
    if (closest && Math.abs(closest.ageMonths - ageMonths) <= 3) {
      return closest;
    }
    return null;
  }, [measurements, dateIso, ageMonths]);

  const exactDobBreakdown = useMemo(() => {
    if (!childProfile.birthDate) return null;
    return calculateExactAgeFromDob(childProfile.birthDate, dateIso);
  }, [childProfile.birthDate, dateIso]);

  if (!isOpen) return null;

  const handleDateChange = (nextDate: string) => {
    setDateIso(nextDate);
    if (childProfile.birthDate && VALIDATION_BOUNDS.DATE_PATTERN.test(nextDate)) {
      const calc = calculateExactAgeFromDob(childProfile.birthDate, nextDate);
      if (calc) {
        setAgeMonths(calc.totalMonths);
      }
    }
    const exact = measurements.find((m) => m.recordedDate === nextDate);
    if (exact) {
      const splitH = splitCmToFeetAndInches(exact.heightCm);
      setFeet(splitH.feet);
      setInches(splitH.inches);
      setWeightLbs(Number(kgToLbs(exact.weightKg).toFixed(1)));
      setLinkedMeasurementId(exact.id);
    } else {
      setLinkedMeasurementId('');
    }
  };

  const handleSyncMeasurement = (m: GrowthMeasurement) => {
    const splitH = splitCmToFeetAndInches(m.heightCm);
    setFeet(splitH.feet);
    setInches(splitH.inches);
    setWeightLbs(Number(kgToLbs(m.weightKg).toFixed(1)));
    setAgeMonths(m.ageMonths);
    setLinkedMeasurementId(m.id);
    setIncludeMeasurements(true);
    setAlsoSaveWallMeasurement(false);
  };

  const handleMultiFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);
    try {
      const selectedFiles = Array.from(fileList).slice(0, 8 - photosDataUrls.length);
      const loadedUrls: string[] = [];
      for (const file of selectedFiles) {
        const url = await readFileAsDataUrl(file);
        loadedUrls.push(url);
      }
      setPhotosDataUrls((prev) => [...prev, ...loadedUrls].slice(0, 8));
    } catch {
      setErrorMessage('Could not read one of the selected image files.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSnapCameraPhoto = () => {
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
    const snapped = canvas.toDataURL('image/jpeg', 0.88);
    setPhotosDataUrls((prev) => [...prev, snapped].slice(0, 8));
    stopCamera();
    setIsCameraOpen(false);
  };

  const handlePickFromDrive = async () => {
    if (!accessToken) return;
    setErrorMessage(null);
    try {
      const picked = await openGoogleDrivePicker(accessToken, {
        viewMode: 'images',
        includeUploadView: true,
        title: `Pick photo for ${childProfile.name}’s portfolio`,
      });
      if (picked) {
        const dataUrl = await downloadDriveImageAsDataUrl(accessToken, picked.id);
        setPhotosDataUrls((prev) => [...prev, dataUrl].slice(0, 8));
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not load image from Google Drive.',
      );
    }
  };

  const computedHeightCm = clampNumber(
    Number(inchesToCm(feet * 12 + inches).toFixed(1)),
    VALIDATION_BOUNDS.HEIGHT_CM_MIN,
    VALIDATION_BOUNDS.HEIGHT_CM_MAX,
  );
  const computedWeightKg = clampNumber(
    Number(lbsToKg(weightLbs).toFixed(1)),
    VALIDATION_BOUNDS.WEIGHT_KG_MIN,
    VALIDATION_BOUNDS.WEIGHT_KG_MAX,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = eventTitle.trim();
    const trimmedStory = story.trim();

    if (photosDataUrls.length === 0 && !trimmedTitle) {
      setErrorMessage(
        'Please upload/snap at least one photo OR enter a Milestone Event Title to save to the portfolio.',
      );
      return;
    }

    if (!VALIDATION_BOUNDS.DATE_PATTERN.test(dateIso)) {
      setErrorMessage('Please choose a valid date.');
      return;
    }

    await onSaveMemory({
      photosDataUrls,
      photoKind,
      isFavorite,
      createEventRecord: trimmedTitle.length > 0 || photosDataUrls.length === 0,
      eventTitle:
        trimmedTitle ||
        `${PHOTO_KIND_LABELS[photoKind]} (${formatHumanDate(dateIso)})`,
      eventCategory,
      story: trimmedStory,
      dateIso,
      ageMonths: clampNumber(
        Math.round(ageMonths),
        VALIDATION_BOUNDS.AGE_MONTHS_MIN,
        VALIDATION_BOUNDS.AGE_MONTHS_MAX,
      ),
      includeMeasurements,
      heightCm: includeMeasurements ? computedHeightCm : 0,
      weightKg: includeMeasurements ? computedWeightKg : 0,
      linkedMeasurementId: includeMeasurements ? linkedMeasurementId : '',
      alsoSaveWallMeasurement: includeMeasurements && alsoSaveWallMeasurement,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-portfolio-memory-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-white border-2 border-amber-300 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-xl space-y-5 my-auto max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-sky-100 pb-4">
          <div className="space-y-1">
            <h3
              id="add-portfolio-memory-title"
              className="text-lg sm:text-xl font-bold text-indigo-950"
            >
              Add Portfolio Photos &amp; Milestone Event — {childProfile.name}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Save gallery pictures, special events, firsts, and birthdays synced with{' '}
              {childProfile.name}’s exact date, age, and height/weight measurements.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close add portfolio memory dialog"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-sky-50 hover:text-indigo-950 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form noValidate onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {errorMessage && (
            <div
              role="alert"
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-900 border border-rose-200"
            >
              {errorMessage}
            </div>
          )}

          {/* Step 1: Photos Upload / Camera Strip */}
          <div className="space-y-3 bg-sky-50/60 border border-sky-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-indigo-950">
                  1. Gallery Pictures (Optional for text-only events · Up to 8 photos at once)
                </span>
                <p className="text-[11px] text-slate-600">
                  Synced to Firestore gallery metadata &amp; backed up to Google Drive when signed in.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photosDataUrls.length >= 8}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  Select Photos
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => void handleMultiFileSelect(e)}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => setIsCameraOpen((prev) => !prev)}
                  disabled={photosDataUrls.length >= 8}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isCameraOpen
                      ? 'bg-rose-600 text-white'
                      : 'bg-sky-600 hover:bg-sky-700 text-white'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                  {isCameraOpen ? 'Close Camera' : 'Take Picture'}
                </button>

                {accessToken && (
                  <button
                    type="button"
                    onClick={() => void handlePickFromDrive()}
                    disabled={photosDataUrls.length >= 8}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-sky-900 bg-white border border-sky-200 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                    Google Drive
                  </button>
                )}
              </div>
            </div>

            {isCameraOpen && (
              <div className="space-y-3 pt-2">
                <div className="relative mx-auto max-w-sm aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 border border-sky-300">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      facingMode === 'user' ? '-scale-x-100' : ''
                    }`}
                  />
                </div>
                <div className="flex items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setFacingMode((prev) =>
                        prev === 'environment' ? 'user' : 'environment',
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-sky-900 bg-white border border-sky-200 rounded-lg cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    Flip
                  </button>
                  <button
                    type="button"
                    onClick={handleSnapCameraPhoto}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                    Capture Photo
                  </button>
                </div>
              </div>
            )}

            {photosDataUrls.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {photosDataUrls.map((url, idx) => (
                    <div
                      key={`queued_${idx}`}
                      className="relative aspect-[4/3] rounded-lg overflow-hidden bg-slate-900 border border-sky-200 group"
                    >
                      <img
                        src={url}
                        alt={`Selected memory photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`Remove selected photo ${idx + 1}`}
                        onClick={() =>
                          setPhotosDataUrls((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-md bg-slate-950/75 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  {photosDataUrls.length < 8 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-[4/3] rounded-lg border-2 border-dashed border-sky-300 bg-white/80 hover:bg-white flex flex-col items-center justify-center gap-1 text-xs font-bold text-sky-800 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      Add More
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="memory-photo-kind"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Gallery Album Tag:
                    </label>
                    <select
                      id="memory-photo-kind"
                      value={photoKind}
                      onChange={(e) => setPhotoKind(e.target.value as ChildPhotoKind)}
                      className="h-9 px-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-indigo-950"
                    >
                      {(Object.keys(PHOTO_KIND_LABELS) as ChildPhotoKind[]).map((k) => (
                        <option key={k} value={k}>
                          {PHOTO_KIND_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFavorite}
                      onChange={(e) => setIsFavorite(e.target.checked)}
                      className="rounded accent-amber-500"
                    />
                    Star as Portfolio Favorite
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Event Title, Quick Ideas & Story */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-indigo-950">
                2. Milestone Event or Memory Title (Quick Ideas or Type Your Own)
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {QUICK_EVENT_IDEAS.map((idea) => (
                  <button
                    key={idea.label}
                    type="button"
                    onClick={() => {
                      setEventTitle(idea.title);
                      setEventCategory(idea.category);
                      setPhotoKind(idea.photoKind);
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {idea.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8 space-y-1">
                <label
                  htmlFor="portfolio-event-title"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Event / Moment Headline
                </label>
                <input
                  id="portfolio-event-title"
                  type="text"
                  maxLength={VALIDATION_BOUNDS.EVENT_TITLE_MAX_LEN}
                  placeholder={`e.g., ${childProfile.name}’s First Day of Kindergarten or Lost First Tooth`}
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="sm:col-span-4 space-y-1">
                <label
                  htmlFor="portfolio-event-category"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Event Chapter
                </label>
                <select
                  id="portfolio-event-category"
                  value={eventCategory}
                  onChange={(e) =>
                    setEventCategory(e.target.value as MilestoneEventCategory)
                  }
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {(Object.keys(EVENT_CATEGORY_LABELS) as MilestoneEventCategory[]).map(
                    (cat) => (
                      <option key={cat} value={cat}>
                        {EVENT_CATEGORY_LABELS[cat]}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="portfolio-story"
                className="block text-xs font-semibold text-slate-700"
              >
                Memory Story / Photo Caption
              </label>
              <textarea
                id="portfolio-story"
                rows={2}
                maxLength={VALIDATION_BOUNDS.EVENT_STORY_MAX_LEN}
                placeholder={`Write a keepsake note about what ${childProfile.name} loved, said, or achieved on this day...`}
                value={story}
                onChange={(e) => setStory(e.target.value)}
                className="w-full p-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Step 3: Date, Auto-Calculated Age & Synced Measurements */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                <Calendar className="w-4 h-4 text-sky-700" aria-hidden="true" />
                <span>3. Synced Date, Age &amp; Growth Measurements</span>
              </div>

              {matchingMeasurement && (
                <button
                  type="button"
                  onClick={() => handleSyncMeasurement(matchingMeasurement)}
                  className="text-xs font-bold text-emerald-800 hover:text-indigo-950 hover:underline cursor-pointer"
                >
                  Sync {formatHumanDate(matchingMeasurement.recordedDate)} mark (
                  {formatFeetInches(matchingMeasurement.heightCm)} ·{' '}
                  {formatPounds(matchingMeasurement.weightKg)})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="portfolio-date"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Date of Photo / Event
                </label>
                <input
                  id="portfolio-date"
                  type="date"
                  value={dateIso}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="portfolio-age-months"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Age on This Date (months)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="portfolio-age-months"
                    type="number"
                    min={0}
                    max={216}
                    step={1}
                    value={ageMonths}
                    onChange={(e) =>
                      setAgeMonths(
                        clampNumber(parseInt(e.target.value || '0', 10), 0, 216),
                      )
                    }
                    className="w-24 h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <span className="text-xs text-slate-600">
                    {exactDobBreakdown
                      ? `Auto from DOB: ${exactDobBreakdown.formattedExactAge}`
                      : formatAgeLabel(ageMonths)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-1 space-y-3 border-t border-slate-200/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMeasurements}
                    onChange={(e) => setIncludeMeasurements(e.target.checked)}
                    className="rounded accent-sky-600"
                  />
                  Include {childProfile.name}’s height &amp; weight on this date
                </label>

                {includeMeasurements && (
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alsoSaveWallMeasurement}
                      onChange={(e) => setAlsoSaveWallMeasurement(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    Also pencil onto Growth Wall &amp; Chart
                  </label>
                )}
              </div>

              {includeMeasurements && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="portfolio-height-ft"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Feet (ft)
                    </label>
                    <input
                      id="portfolio-height-ft"
                      type="number"
                      min={1}
                      max={6}
                      step={1}
                      value={feet}
                      onChange={(e) => {
                        setFeet(clampNumber(parseInt(e.target.value || '0', 10), 1, 6));
                        setLinkedMeasurementId('');
                      }}
                      className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="portfolio-height-in"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Inches (in)
                    </label>
                    <input
                      id="portfolio-height-in"
                      type="number"
                      min={0}
                      max={11.9}
                      step={0.1}
                      value={inches}
                      onChange={(e) => {
                        setInches(
                          clampNumber(parseFloat(e.target.value || '0'), 0, 11.9),
                        );
                        setLinkedMeasurementId('');
                      }}
                      className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="portfolio-weight-lb"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Weight (lb)
                    </label>
                    <input
                      id="portfolio-weight-lb"
                      type="number"
                      min={6}
                      max={260}
                      step={0.1}
                      value={weightLbs}
                      onChange={(e) => {
                        setWeightLbs(
                          clampNumber(parseFloat(e.target.value || '0'), 6, 260),
                        );
                        setLinkedMeasurementId('');
                      }}
                      className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit Row */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-sky-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              {isSaving
                ? 'Saving to Portfolio...'
                : photosDataUrls.length > 0
                  ? `Save ${photosDataUrls.length} ${photosDataUrls.length === 1 ? 'Photo' : 'Photos'} & Memory`
                  : 'Save Milestone Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
