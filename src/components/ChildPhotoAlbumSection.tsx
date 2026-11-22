import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  ArrowUpRight,
  BookOpen,
  CalendarPlus,
  Camera,
  Check,
  CloudUpload,
  Download,
  Edit3,
  Grid,
  Image as ImageIcon,
  Plus,
  Ruler,
  Share2,
  Star,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  calculateExactAgeFromDob,
  ChildPhotoKind,
  ChildPhotoRecord,
  ChildProfile,
  EVENT_CATEGORY_LABELS,
  formatAgeLabel,
  formatFeetInches,
  formatHeightDelta,
  formatHumanDate,
  formatMetricHeight,
  formatMetricWeight,
  formatPounds,
  formatTotalInches,
  GrowthMeasurement,
  MilestoneEventRecord,
  PHOTO_KIND_LABELS,
  VALIDATION_BOUNDS,
} from '../types';
import { InitialMemoryModalContext } from './AddPortfolioMemoryModal';
import { SocialShareInitialContext } from './SocialShareConnectorModal';

type PortfolioViewMode = 'timeline' | 'grid';
type GalleryFilter = 'all' | 'favorites' | 'wall' | 'milestones' | 'avatar';

export interface PhotoDetailsPatch {
  eventTitle: string;
  caption: string;
  capturedDate: string;
  kind: ChildPhotoKind;
}

interface ChildPhotoAlbumSectionProps {
  childProfile: ChildProfile;
  photos: ChildPhotoRecord[];
  events: MilestoneEventRecord[];
  measurements: GrowthMeasurement[];
  accessToken: string | null;
  isSignedIn: boolean;
  isSyncingBatch?: boolean;
  onOpenAddMemoryModal: (initialContext?: InitialMemoryModalContext) => void;
  onOpenAvatarStudio: () => void;
  onOpenWallEstimator: () => void;
  onUseAsAvatar: (photo: ChildPhotoRecord) => Promise<void>;
  onToggleFavoritePhoto: (photo: ChildPhotoRecord) => Promise<void>;
  onUpdatePhotoDetails: (
    photo: ChildPhotoRecord,
    updates: PhotoDetailsPatch,
  ) => Promise<void>;
  onBackupToDrive: (photo: ChildPhotoRecord) => Promise<void>;
  onSyncAllPhotosToDrive: () => Promise<void>;
  onDeletePhoto: (photo: ChildPhotoRecord) => Promise<void>;
  onDeleteEvent: (event: MilestoneEventRecord) => Promise<void>;
  onInspectMilestone?: (measurement: GrowthMeasurement) => void;
  onOpenSocialShare?: (context?: SocialShareInitialContext) => void;
  onSignInForDrive: () => void;
}

interface SyncedTimelineChapter {
  dateKey: string;
  sortTimestamp: number;
  ageMonths: number;
  photos: ChildPhotoRecord[];
  events: MilestoneEventRecord[];
  measurements: GrowthMeasurement[];
  bestHeightCm: number;
  bestWeightKg: number;
}

export const ChildPhotoAlbumSection: React.FC<ChildPhotoAlbumSectionProps> = ({
  childProfile,
  photos,
  events,
  measurements,
  accessToken,
  isSignedIn,
  isSyncingBatch = false,
  onOpenAddMemoryModal,
  onOpenAvatarStudio,
  onOpenWallEstimator,
  onUseAsAvatar,
  onToggleFavoritePhoto,
  onUpdatePhotoDetails,
  onBackupToDrive,
  onSyncAllPhotosToDrive,
  onDeletePhoto,
  onDeleteEvent,
  onInspectMilestone,
  onOpenSocialShare,
  onSignInForDrive,
}) => {
  const [viewMode, setViewMode] = useState<PortfolioViewMode>('timeline');
  const [sortAscending, setSortAscending] = useState<boolean>(false);
  const [filter, setFilter] = useState<GalleryFilter>('all');

  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  const [isEditingLightbox, setIsEditingLightbox] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editCaption, setEditCaption] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editKind, setEditKind] = useState<ChildPhotoKind>('milestone');

  const [confirmDeletePhotoId, setConfirmDeletePhotoId] = useState<string | null>(null);
  const [confirmDeleteEventId, setConfirmDeleteEventId] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const lightboxPhoto = useMemo(
    () => photos.find((p) => p.id === lightboxPhotoId) ?? null,
    [photos, lightboxPhotoId],
  );

  // Counts for Gallery filters & Cloud Sync status
  const favoriteCount = useMemo(
    () => photos.filter((p) => Boolean(p.isFavorite)).length,
    [photos],
  );
  const wallCount = useMemo(
    () => photos.filter((p) => p.kind === 'wall').length,
    [photos],
  );
  const milestonePhotosCount = useMemo(
    () =>
      photos.filter(
        (p) =>
          p.kind === 'milestone' ||
          p.kind === 'event' ||
          p.kind === 'school' ||
          p.kind === 'family',
      ).length,
    [photos],
  );
  const avatarCount = useMemo(
    () => photos.filter((p) => p.kind === 'avatar').length,
    [photos],
  );
  const unsyncedLocalPhotos = useMemo(
    () => photos.filter((p) => Boolean(p.localDataUrl) && !p.driveFileId),
    [photos],
  );
  const cloudBackedPhotosCount = useMemo(
    () => photos.filter((p) => Boolean(p.driveFileId)).length,
    [photos],
  );

  const filteredPhotos = useMemo(() => {
    const base = (() => {
      switch (filter) {
        case 'favorites':
          return photos.filter((p) => Boolean(p.isFavorite));
        case 'wall':
          return photos.filter((p) => p.kind === 'wall');
        case 'milestones':
          return photos.filter(
            (p) =>
              p.kind === 'milestone' ||
              p.kind === 'event' ||
              p.kind === 'school' ||
              p.kind === 'family',
          );
        case 'avatar':
          return photos.filter((p) => p.kind === 'avatar');
        default:
          return photos;
      }
    })();

    const copy = [...base];
    copy.sort((a, b) => {
      const dateCmp = a.capturedDate.localeCompare(b.capturedDate);
      if (dateCmp !== 0) {
        return sortAscending ? dateCmp : -dateCmp;
      }
      return sortAscending
        ? (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0)
        : (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);
    });
    return copy;
  }, [photos, filter, sortAscending]);

  // Chronological Storybook Chapters combining Photos + Milestone Events + Growth Measurements by Date
  const timelineChapters = useMemo<SyncedTimelineChapter[]>(() => {
    const map = new Map<string, SyncedTimelineChapter>();

    const ensureBucket = (dateIso: string, fallbackAgeMonths: number) => {
      const safeKey = VALIDATION_BOUNDS.DATE_PATTERN.test(dateIso)
        ? dateIso
        : 'Undated';
      let bucket = map.get(safeKey);
      if (!bucket) {
        const parsedTs = VALIDATION_BOUNDS.DATE_PATTERN.test(safeKey)
          ? Date.parse(`${safeKey}T12:00:00`)
          : 0;
        bucket = {
          dateKey: safeKey,
          sortTimestamp: Number.isNaN(parsedTs) ? 0 : parsedTs,
          ageMonths: fallbackAgeMonths,
          photos: [],
          events: [],
          measurements: [],
          bestHeightCm: 0,
          bestWeightKg: 0,
        };
        map.set(safeKey, bucket);
      }
      return bucket;
    };

    for (const m of measurements) {
      const b = ensureBucket(m.recordedDate, m.ageMonths);
      b.measurements.push(m);
      b.ageMonths = m.ageMonths;
      if (m.heightCm > 0) b.bestHeightCm = m.heightCm;
      if (m.weightKg > 0) b.bestWeightKg = m.weightKg;
    }

    for (const ev of events) {
      const b = ensureBucket(ev.eventDate, ev.ageMonths);
      b.events.push(ev);
      if (b.measurements.length === 0) {
        b.ageMonths = ev.ageMonths;
      }
      if (b.bestHeightCm === 0 && ev.heightCm > 0) b.bestHeightCm = ev.heightCm;
      if (b.bestWeightKg === 0 && ev.weightKg > 0) b.bestWeightKg = ev.weightKg;
    }

    for (const ph of photos) {
      const b = ensureBucket(ph.capturedDate, ph.ageMonths);
      b.photos.push(ph);
      if (b.measurements.length === 0 && b.events.length === 0) {
        b.ageMonths = ph.ageMonths;
      }
      if (b.bestHeightCm === 0 && ph.heightCm > 0) b.bestHeightCm = ph.heightCm;
      if (b.bestWeightKg === 0 && ph.weightKg > 0) b.bestWeightKg = ph.weightKg;
    }

    const list = Array.from(map.values());
    list.sort((a, b) => {
      if (a.sortTimestamp !== b.sortTimestamp) {
        return sortAscending
          ? a.sortTimestamp - b.sortTimestamp
          : b.sortTimestamp - a.sortTimestamp;
      }
      return sortAscending ? a.ageMonths - b.ageMonths : b.ageMonths - a.ageMonths;
    });

    return list;
  }, [photos, events, measurements, sortAscending]);

  const openLightbox = (photo: ChildPhotoRecord, startEditing = false) => {
    setLightboxPhotoId(photo.id);
    setEditTitle(photo.eventTitle || '');
    setEditCaption(photo.caption || '');
    setEditDate(photo.capturedDate);
    setEditKind(photo.kind);
    setIsEditingLightbox(startEditing);
  };

  const closeLightbox = () => {
    setLightboxPhotoId(null);
    setIsEditingLightbox(false);
  };

  const handleDownloadPhoto = (photo: ChildPhotoRecord) => {
    if (!photo.localDataUrl) return;
    const safeChild = childProfile.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Child';
    const link = document.createElement('a');
    link.href = photo.localDataUrl;
    link.download = `SproutScale_${safeChild}_${photo.kind}_${photo.capturedDate}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSetAvatar = async (photo: ChildPhotoRecord) => {
    setBusyItemId(photo.id);
    try {
      await onUseAsAvatar(photo);
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDriveBackup = async (photo: ChildPhotoRecord) => {
    setBusyItemId(photo.id);
    try {
      await onBackupToDrive(photo);
    } finally {
      setBusyItemId(null);
    }
  };

  const handleSavePhotoEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lightboxPhoto) return;
    setBusyItemId(lightboxPhoto.id);
    try {
      await onUpdatePhotoDetails(lightboxPhoto, {
        eventTitle: editTitle,
        caption: editCaption,
        capturedDate: editDate,
        kind: editKind,
      });
      setIsEditingLightbox(false);
    } finally {
      setBusyItemId(null);
    }
  };

  const handleConfirmDeletePhoto = async (photo: ChildPhotoRecord) => {
    setBusyItemId(photo.id);
    try {
      await onDeletePhoto(photo);
      if (lightboxPhotoId === photo.id) {
        closeLightbox();
      }
      setConfirmDeletePhotoId(null);
    } finally {
      setBusyItemId(null);
    }
  };

  const handleConfirmDeleteEvent = async (ev: MilestoneEventRecord) => {
    setBusyItemId(ev.id);
    try {
      await onDeleteEvent(ev);
      setConfirmDeleteEventId(null);
    } finally {
      setBusyItemId(null);
    }
  };

  return (
    <section
      id="photo-album"
      aria-labelledby="photo-album-heading"
      className="bg-white dark:bg-slate-900 border-2 border-amber-200 dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6"
    >
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-sky-100 dark:border-slate-800 pb-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-700 dark:text-sky-400 shrink-0" aria-hidden="true" />
            <h2
              id="photo-album-heading"
              className="text-xl sm:text-2xl font-bold tracking-tight text-indigo-950 dark:text-white"
            >
              {childProfile.name}’s Growth Portfolio, Gallery &amp; Events
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            A chronological keepsake portfolio of{' '}
            <strong className="text-indigo-950 dark:text-white">{childProfile.name}</strong> growing up —
            gallery pictures, birthdays, school firsts, and wall check-ins synced with exact
            dates, ages, and measurements in Firestore.
          </p>

          {/* Unboxed Summary Metrics Strip (Zero Static Pills) */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
            <span className="font-semibold text-indigo-950 dark:text-white">
              {photos.length} {photos.length === 1 ? 'Photo' : 'Photos'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-sky-900 dark:text-sky-300">
              {events.length} {events.length === 1 ? 'Milestone Event' : 'Milestone Events'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {measurements.length} {measurements.length === 1 ? 'Wall Mark' : 'Wall Marks'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-sans">
              {isSignedIn
                ? `Firestore Synced (${cloudBackedPhotosCount}/${photos.length} Drive JPEGs)`
                : 'Device Playground (Sign in for Firestore Cloud Sync)'}
            </span>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenAddMemoryModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add Photos / Event
          </button>

          <button
            type="button"
            onClick={onOpenWallEstimator}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-emerald-950 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/70 hover:bg-emerald-200 dark:hover:bg-emerald-900/70 border border-emerald-300 dark:border-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Ruler className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            Fridge / Wall Photo
          </button>

          <button
            type="button"
            onClick={onOpenAvatarStudio}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-sky-950 dark:text-sky-200 bg-sky-100 dark:bg-sky-950/70 hover:bg-sky-200 dark:hover:bg-sky-900/70 border border-sky-200 dark:border-sky-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
            Portrait
          </button>

          {onOpenSocialShare && (
            <button
              type="button"
              onClick={() => onOpenSocialShare()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-indigo-950 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
              Share FB / IG
            </button>
          )}

          {unsyncedLocalPhotos.length > 0 && (
            <button
              type="button"
              disabled={isSyncingBatch}
              onClick={() => {
                if (accessToken) {
                  void onSyncAllPhotosToDrive();
                } else {
                  onSignInForDrive();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-indigo-950 dark:text-sky-200 bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 border border-sky-300 dark:border-slate-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
              {isSyncingBatch
                ? 'Syncing Cloud Photos...'
                : accessToken
                  ? `Sync ${unsyncedLocalPhotos.length} ${unsyncedLocalPhotos.length === 1 ? 'Photo' : 'Photos'} to Cloud`
                  : `Sign In to Sync ${unsyncedLocalPhotos.length} ${unsyncedLocalPhotos.length === 1 ? 'Photo' : 'Photos'}`}
            </button>
          )}
        </div>
      </div>

      {/* View Mode Switcher & Sort Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Primary Segmented View Toggle */}
          <div
            role="tablist"
            aria-label="Portfolio display mode"
            className="inline-flex items-center gap-1 p-1 bg-sky-100 dark:bg-slate-800 rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'timeline'}
              onClick={() => setViewMode('timeline')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'timeline'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-sky-950 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              Storybook Timeline ({timelineChapters.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-sky-950 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" aria-hidden="true" />
              Photo Gallery ({photos.length})
            </button>
          </div>

          {/* Secondary Category Filter when in Photo Gallery Grid mode */}
          {viewMode === 'grid' && (
            <div
              role="group"
              aria-label="Filter gallery photos"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
            >
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-indigo-950 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-indigo-950 dark:hover:text-white'
                }`}
              >
                All ({photos.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('favorites')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === 'favorites'
                    ? 'bg-white dark:bg-slate-700 text-indigo-950 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-indigo-950 dark:hover:text-white'
                }`}
              >
                Favorites ({favoriteCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('milestones')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === 'milestones'
                    ? 'bg-white dark:bg-slate-700 text-indigo-950 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-indigo-950 dark:hover:text-white'
                }`}
              >
                Events &amp; Firsts ({milestonePhotosCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('wall')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === 'wall'
                    ? 'bg-white dark:bg-slate-700 text-indigo-950 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-indigo-950 dark:hover:text-white'
                }`}
              >
                Wall / Fridge ({wallCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('avatar')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === 'avatar'
                    ? 'bg-white dark:bg-slate-700 text-indigo-950 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-indigo-950 dark:hover:text-white'
                }`}
              >
                Portraits ({avatarCount})
              </button>
            </div>
          )}
        </div>

        {/* Chronological Order Toggle */}
        <button
          type="button"
          onClick={() => setSortAscending((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-900 dark:text-sky-200 bg-slate-50 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowDownUp className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
          {sortAscending
            ? `Order: Age 2 → Now (Watch ${childProfile.name} Grow)`
            : 'Order: Newest Moments First'}
        </button>
      </div>

      {/* ===================================================================== */}
      {/* VIEW 1: CHRONOLOGICAL STORYBOOK TIMELINE (PHOTOS + EVENTS + MARKS)    */}
      {/* ===================================================================== */}
      {viewMode === 'timeline' && (
        <div className="space-y-4">
          {timelineChapters.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-sky-200 dark:border-slate-700 bg-sky-50/50 dark:bg-slate-800/40 p-8 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center">
                <CalendarPlus className="w-6 h-6 text-amber-800 dark:text-amber-300" aria-hidden="true" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-sm font-bold text-indigo-950 dark:text-white">
                  Start {childProfile.name}’s Growth Portfolio
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Upload photos from birthdays, school firsts, and fridge height check-ins —
                  every memory is automatically organized by date, age, and height/weight.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenAddMemoryModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Add First Photo or Event
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-50/40 dark:bg-slate-900/40">
              {timelineChapters.map((chapter) => {
                const exactAgeAtDate =
                  childProfile.birthDate &&
                  VALIDATION_BOUNDS.DATE_PATTERN.test(chapter.dateKey)
                    ? calculateExactAgeFromDob(childProfile.birthDate, chapter.dateKey)
                    : null;

                const primaryMeasurement = chapter.measurements[0] ?? null;
                const heightDeltaCm =
                  chapter.bestHeightCm > 0
                    ? chapter.bestHeightCm - childProfile.ageTwoHeightCm
                    : 0;

                return (
                  <article
                    key={chapter.dateKey}
                    className="p-4 sm:p-5 bg-white dark:bg-slate-900 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors space-y-3.5"
                  >
                    {/* Chapter Top Bar: Date · Exact Age · Synced Measurements · Quick Add Photo */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-mono font-bold tabular-nums text-indigo-950 dark:text-white text-sm">
                            {formatHumanDate(chapter.dateKey)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-sky-900 dark:text-sky-300">
                            {exactAgeAtDate
                              ? `Age ${exactAgeAtDate.formattedExactAge}`
                              : formatAgeLabel(chapter.ageMonths)}
                          </span>
                          {chapter.photos.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                {chapter.photos.length}{' '}
                                {chapter.photos.length === 1 ? 'photo' : 'photos'}
                              </span>
                            </>
                          )}
                          {chapter.events.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                {chapter.events.length}{' '}
                                {chapter.events.length === 1 ? 'event' : 'events'}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Synced Imperial-First Measurements on This Date */}
                        {chapter.bestHeightCm > 0 && (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-mono tabular-nums">
                            <span className="font-bold text-indigo-950">
                              {formatFeetInches(chapter.bestHeightCm)}{' '}
                              <span className="text-sky-800">
                                ({formatTotalInches(chapter.bestHeightCm)})
                              </span>
                            </span>
                            {chapter.bestWeightKg > 0 && (
                              <>
                                <span className="text-slate-400" aria-hidden="true">
                                  ·
                                </span>
                                <span className="font-bold text-rose-700">
                                  {formatPounds(chapter.bestWeightKg)}
                                </span>
                              </>
                            )}
                            {Math.abs(heightDeltaCm) >= 0.2 && (
                              <>
                                <span className="text-slate-400" aria-hidden="true">
                                  ·
                                </span>
                                <span className="font-semibold text-emerald-700">
                                  {formatHeightDelta(heightDeltaCm, 'imperial')} since Age 2
                                </span>
                              </>
                            )}
                            <span className="text-slate-400" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {formatMetricHeight(chapter.bestHeightCm)}
                              {chapter.bestWeightKg > 0
                                ? ` / ${formatMetricWeight(chapter.bestWeightKg)}`
                                : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {primaryMeasurement && onInspectMilestone && (
                          <button
                            type="button"
                            onClick={() => onInspectMilestone(primaryMeasurement)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:text-indigo-950 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Show on Wall
                            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            onOpenAddMemoryModal({
                              dateIso: VALIDATION_BOUNDS.DATE_PATTERN.test(chapter.dateKey)
                                ? chapter.dateKey
                                : undefined,
                              ageMonths: chapter.ageMonths,
                              heightCm:
                                chapter.bestHeightCm > 0 ? chapter.bestHeightCm : undefined,
                              weightKg:
                                chapter.bestWeightKg > 0 ? chapter.bestWeightKg : undefined,
                              linkedMeasurementId: primaryMeasurement?.id,
                              suggestedTitle:
                                chapter.events[0]?.title || primaryMeasurement?.note || '',
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          Add Photo / Note
                        </button>

                        {onOpenSocialShare && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenSocialShare({
                                photoId:
                                  chapter.photos.find((p) => Boolean(p.localDataUrl))?.id ??
                                  undefined,
                                dateIso: VALIDATION_BOUNDS.DATE_PATTERN.test(chapter.dateKey)
                                  ? chapter.dateKey
                                  : undefined,
                                ageMonths: chapter.ageMonths,
                                heightCm:
                                  chapter.bestHeightCm > 0 ? chapter.bestHeightCm : undefined,
                                weightKg:
                                  chapter.bestWeightKg > 0 ? chapter.bestWeightKg : undefined,
                                headline:
                                  chapter.events[0]?.title ||
                                  chapter.photos[0]?.eventTitle ||
                                  primaryMeasurement?.note ||
                                  '',
                                caption:
                                  chapter.events[0]?.story ||
                                  chapter.photos[0]?.caption ||
                                  primaryMeasurement?.note ||
                                  '',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5 text-rose-600" aria-hidden="true" />
                            Share Story
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Milestone Events Logged on This Date */}
                    {chapter.events.length > 0 && (
                      <div className="space-y-2">
                        {chapter.events.map((ev) => {
                          const isConfirmingEvDelete = confirmDeleteEventId === ev.id;
                          return (
                            <div
                              key={ev.id}
                              className="rounded-xl border border-amber-200/90 dark:border-amber-800/70 bg-amber-50/45 dark:bg-amber-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2"
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-amber-900 dark:text-amber-300">
                                  <span className="font-semibold">
                                    {EVENT_CATEGORY_LABELS[ev.category]}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <h3 className="text-sm font-bold text-indigo-950 dark:text-white">
                                    {ev.title}
                                  </h3>
                                </div>
                                {ev.story && (
                                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {ev.story}
                                  </p>
                                )}
                              </div>

                              <div className="shrink-0 self-end sm:self-start">
                                {isConfirmingEvDelete ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={busyItemId === ev.id}
                                      onClick={() => void handleConfirmDeleteEvent(ev)}
                                      className="px-2 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteEventId(null)}
                                      className="px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    aria-label={`Delete event ${ev.title}`}
                                    onClick={() => setConfirmDeleteEventId(ev.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Wall Measurement Notes (if no separate event duplicated the exact note) */}
                    {chapter.measurements
                      .filter(
                        (m) =>
                          Boolean(m.note) &&
                          !chapter.events.some((ev) => ev.story === m.note || ev.title === m.note),
                      )
                      .map((m) => (
                        <p key={m.id} className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            Wall Mark Note:
                          </span>{' '}
                          {m.note}
                        </p>
                      ))}

                    {/* Gallery Photos Synced on This Date */}
                    {chapter.photos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
                        {chapter.photos.map((photo) => (
                          <div
                            key={photo.id}
                            className="group relative rounded-xl overflow-hidden border border-sky-200 bg-slate-900 flex flex-col"
                          >
                            <button
                              type="button"
                              onClick={() => openLightbox(photo, false)}
                              disabled={!photo.localDataUrl}
                              aria-label={`View ${photo.eventTitle || PHOTO_KIND_LABELS[photo.kind]} photo from ${formatHumanDate(photo.capturedDate)}`}
                              className="relative aspect-[4/3] w-full overflow-hidden cursor-pointer disabled:cursor-default"
                            >
                              {photo.localDataUrl ? (
                                <img
                                  src={photo.localDataUrl}
                                  alt={
                                    photo.eventTitle ||
                                    photo.caption ||
                                    `${childProfile.name} ${PHOTO_KIND_LABELS[photo.kind]}`
                                  }
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-3 text-center text-slate-300 text-[11px]">
                                  <ImageIcon
                                    className="w-5 h-5 text-slate-400"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    {photo.driveFileId
                                      ? 'In Google Drive — connect Drive to view'
                                      : 'Saved on original device'}
                                  </span>
                                </div>
                              )}

                              {(photo.eventTitle || photo.caption) && photo.localDataUrl && (
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2.5 pt-5 pb-2 text-left">
                                  <p className="text-[11px] font-semibold text-white truncate">
                                    {photo.eventTitle || photo.caption}
                                  </p>
                                </div>
                              )}
                            </button>

                            <button
                              type="button"
                              aria-label={
                                photo.isFavorite
                                  ? 'Remove from portfolio favorites'
                                  : 'Star as portfolio favorite'
                              }
                              onClick={() => void onToggleFavoritePhoto(photo)}
                              className={`absolute top-2 right-2 w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                                photo.isFavorite
                                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                                  : 'bg-slate-950/60 text-white hover:bg-slate-950/85'
                              }`}
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${photo.isFavorite ? 'fill-slate-950' : ''}`}
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: MEDIA-FIRST PHOTO GALLERY GRID                                */}
      {/* ===================================================================== */}
      {viewMode === 'grid' && (
        <>
          {filteredPhotos.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-sky-200 dark:border-slate-700 bg-sky-50/50 dark:bg-slate-800/50 p-8 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700/60 flex items-center justify-center">
                <Camera className="w-6 h-6 text-amber-800 dark:text-amber-300" aria-hidden="true" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-sm font-bold text-indigo-950 dark:text-slate-100">
                  {photos.length === 0
                    ? `No gallery pictures saved for ${childProfile.name} yet`
                    : 'No photos match this gallery filter yet'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Upload multiple photos, snap a live camera shot, or capture a fridge height
                  check-in to build {childProfile.name}’s visual portfolio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenAddMemoryModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Add Photos to Gallery
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPhotos.map((photo) => {
                const isBusy = busyItemId === photo.id;
                const isConfirmingDelete = confirmDeletePhotoId === photo.id;
                const kindText = PHOTO_KIND_LABELS[photo.kind];

                return (
                  <article
                    key={photo.id}
                    className="bg-slate-50/70 dark:bg-slate-800/70 border border-sky-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col justify-between transition-shadow hover:shadow-sm"
                  >
                    {/* Photo Frame */}
                    <div className="relative aspect-[4/3] w-full bg-slate-900 overflow-hidden group">
                      <button
                        type="button"
                        onClick={() => openLightbox(photo, false)}
                        disabled={!photo.localDataUrl}
                        aria-label={`View full size ${kindText} photo of ${childProfile.name} from ${formatHumanDate(photo.capturedDate)}`}
                        className="w-full h-full cursor-pointer disabled:cursor-default"
                      >
                        {photo.localDataUrl ? (
                          <img
                            src={photo.localDataUrl}
                            alt={
                              photo.eventTitle ||
                              `${childProfile.name} ${kindText} taken ${formatHumanDate(photo.capturedDate)}`
                            }
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 px-4 text-center text-slate-300 text-xs">
                            <ImageIcon
                              className="w-6 h-6 text-slate-400"
                              aria-hidden="true"
                            />
                            <span>
                              {photo.driveFileId
                                ? 'Backed up in Google Drive — connect Drive to view on this device'
                                : 'Saved on original device'}
                            </span>
                          </div>
                        )}
                      </button>

                      {/* Star Favorite Button */}
                      <button
                        type="button"
                        aria-label={
                          photo.isFavorite
                            ? 'Remove from portfolio favorites'
                            : 'Star as portfolio favorite'
                        }
                        onClick={() => void onToggleFavoritePhoto(photo)}
                        className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                          photo.isFavorite
                            ? 'bg-amber-400 text-slate-950 shadow-xs'
                            : 'bg-slate-950/65 text-white hover:bg-slate-950/85'
                        }`}
                      >
                        <Star
                          className={`w-4 h-4 ${photo.isFavorite ? 'fill-slate-950' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        {/* Clean Unboxed Metadata Line */}
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          <span className="font-bold text-sky-900 dark:text-sky-300">{kindText}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatHumanDate(photo.capturedDate)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatAgeLabel(photo.ageMonths)}</span>
                        </div>

                        {photo.eventTitle && (
                          <h3 className="text-sm font-bold text-indigo-950 dark:text-slate-100 leading-snug">
                            {photo.eventTitle}
                          </h3>
                        )}

                        {photo.heightCm > 0 && (
                          <p className="text-xs font-mono font-bold tabular-nums text-indigo-950 dark:text-slate-100">
                            <span>{formatFeetInches(photo.heightCm)}</span>{' '}
                            <span className="text-sky-800 dark:text-sky-300">
                              ({formatTotalInches(photo.heightCm)})
                            </span>
                            {photo.weightKg > 0 && (
                              <>
                                <span
                                  className="mx-1.5 text-slate-400 dark:text-slate-500"
                                  aria-hidden="true"
                                >
                                  ·
                                </span>
                                <span className="text-rose-700 dark:text-rose-300">
                                  {formatPounds(photo.weightKg)}
                                </span>
                              </>
                            )}
                            <span className="ml-1.5 text-[11px] font-normal text-slate-400 dark:text-slate-500">
                              {formatMetricHeight(photo.heightCm)}
                            </span>
                          </p>
                        )}

                        {photo.caption && (
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug line-clamp-2">
                            {photo.caption}
                          </p>
                        )}

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          {photo.driveFileId ? (
                            <>
                              <Check
                                className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="text-emerald-800 dark:text-emerald-300 font-medium">
                                Synced in Firestore &amp; Google Drive
                              </span>
                            </>
                          ) : isSignedIn ? (
                            <span>Metadata in Firestore · Local JPEG</span>
                          ) : (
                            <span>Saved in device album</span>
                          )}
                        </p>
                      </div>

                      {/* Card Footer Action Row */}
                      {isConfirmingDelete ? (
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300">
                            Delete photo?
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleConfirmDeletePhoto(photo)}
                              className="px-2.5 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePhotoId(null)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {photo.localDataUrl && (
                              <button
                                type="button"
                                onClick={() => openLightbox(photo, true)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-100 bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" aria-hidden="true" />
                                Edit
                              </button>
                            )}
                            {photo.localDataUrl && onOpenSocialShare && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenSocialShare({
                                    photoId: photo.id,
                                    dateIso: photo.capturedDate,
                                    ageMonths: photo.ageMonths,
                                    heightCm: photo.heightCm > 0 ? photo.heightCm : undefined,
                                    weightKg: photo.weightKg > 0 ? photo.weightKg : undefined,
                                    headline: photo.eventTitle || '',
                                    caption: photo.caption || '',
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-900 dark:text-rose-200 bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 dark:hover:bg-rose-900/70 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Share2 className="w-3 h-3" aria-hidden="true" />
                                Share
                              </button>
                            )}
                            {photo.localDataUrl && (
                              <button
                                type="button"
                                onClick={() => handleDownloadPhoto(photo)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-sky-900 dark:text-sky-200 bg-sky-100 dark:bg-sky-950/60 hover:bg-sky-200 dark:hover:bg-sky-900/70 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                JPG
                              </button>
                            )}
                            {photo.localDataUrl && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleSetAvatar(photo)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 bg-amber-300 hover:bg-amber-400 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                                Avatar
                              </button>
                            )}
                            {photo.localDataUrl && !photo.driveFileId && accessToken && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleDriveBackup(photo)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-900 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900/70 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <CloudUpload className="w-3.5 h-3.5" aria-hidden="true" />
                                {isBusy ? 'Saving...' : 'Drive'}
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            aria-label={`Delete photo from ${formatHumanDate(photo.capturedDate)}`}
                            onClick={() => setConfirmDeletePhotoId(photo.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 dark:text-slate-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Full-Resolution Lightbox & Inline Photo Details Editor */}
      {lightboxPhoto && lightboxPhoto.localDataUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Full-size photo of ${childProfile.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-500/60 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl my-auto">
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-sky-100 dark:border-slate-800">
              <div className="min-w-0">
                <p className="text-sm font-bold text-indigo-950 dark:text-slate-100 truncate">
                  {lightboxPhoto.eventTitle ||
                    `${childProfile.name} · ${PHOTO_KIND_LABELS[lightboxPhoto.kind]}`}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                  {formatHumanDate(lightboxPhoto.capturedDate)} ·{' '}
                  {formatAgeLabel(lightboxPhoto.ageMonths)}
                  {lightboxPhoto.heightCm > 0
                    ? ` · ${formatFeetInches(lightboxPhoto.heightCm)} (${formatTotalInches(lightboxPhoto.heightCm)} · ${formatMetricHeight(lightboxPhoto.heightCm)})`
                    : ''}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void onToggleFavoritePhoto(lightboxPhoto)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    lightboxPhoto.isFavorite
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${lightboxPhoto.isFavorite ? 'fill-slate-950' : ''}`}
                    aria-hidden="true"
                  />
                  {lightboxPhoto.isFavorite ? 'Starred' : 'Favorite'}
                </button>
                <button
                  type="button"
                  aria-label="Close full-size photo"
                  onClick={closeLightbox}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-slate-800 hover:text-indigo-950 dark:hover:text-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="bg-slate-950 flex items-center justify-center max-h-[58vh] overflow-hidden">
              <img
                src={lightboxPhoto.localDataUrl}
                alt={lightboxPhoto.eventTitle || `${childProfile.name} full-size photo`}
                referrerPolicy="no-referrer"
                className="max-h-[58vh] w-auto object-contain"
              />
            </div>

            {isEditingLightbox ? (
              <form
                onSubmit={(e) => void handleSavePhotoEdits(e)}
                className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-sky-100 dark:border-slate-800 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1 space-y-1">
                    <label
                      htmlFor="lightbox-edit-date"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Photo Date
                    </label>
                    <input
                      id="lightbox-edit-date"
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="sm:col-span-1 space-y-1">
                    <label
                      htmlFor="lightbox-edit-kind"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Album Category
                    </label>
                    <select
                      id="lightbox-edit-kind"
                      value={editKind}
                      onChange={(e) => setEditKind(e.target.value as ChildPhotoKind)}
                      className="w-full h-9 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    >
                      {(Object.keys(PHOTO_KIND_LABELS) as ChildPhotoKind[]).map((k) => (
                        <option key={k} value={k}>
                          {PHOTO_KIND_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1 space-y-1">
                    <label
                      htmlFor="lightbox-edit-title"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Event / Moment Title
                    </label>
                    <input
                      id="lightbox-edit-title"
                      type="text"
                      maxLength={VALIDATION_BOUNDS.EVENT_TITLE_MAX_LEN}
                      placeholder="e.g., First Day of School"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="lightbox-edit-caption"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Memory Story / Caption
                  </label>
                  <input
                    id="lightbox-edit-caption"
                    type="text"
                    maxLength={VALIDATION_BOUNDS.CAPTION_MAX_LEN}
                    placeholder="Add a keepsake caption..."
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingLightbox(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busyItemId === lightboxPhoto.id}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    Save Details
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-sky-100 dark:border-slate-800">
                <p className="text-xs text-slate-700 dark:text-slate-300 max-w-md">
                  {lightboxPhoto.caption ||
                    'Saved in SproutScale portfolio — click Edit Details to add an event story.'}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {onOpenSocialShare && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = lightboxPhoto;
                        closeLightbox();
                        onOpenSocialShare({
                          photoId: target.id,
                          dateIso: target.capturedDate,
                          ageMonths: target.ageMonths,
                          heightCm: target.heightCm > 0 ? target.heightCm : undefined,
                          weightKg: target.weightKg > 0 ? target.weightKg : undefined,
                          headline: target.eventTitle || '',
                          caption: target.caption || '',
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-900 dark:text-rose-200 bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 dark:hover:bg-rose-900/70 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Share FB / IG
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditTitle(lightboxPhoto.eventTitle || '');
                      setEditCaption(lightboxPhoto.caption || '');
                      setEditDate(lightboxPhoto.capturedDate);
                      setEditKind(lightboxPhoto.kind);
                      setIsEditingLightbox(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPhoto(lightboxPhoto)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-sky-900 dark:text-sky-200 bg-sky-100 dark:bg-sky-950/60 hover:bg-sky-200 dark:hover:bg-sky-900/70 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    Download JPG
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleSetAvatar(lightboxPhoto);
                      closeLightbox();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    Use as Avatar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
