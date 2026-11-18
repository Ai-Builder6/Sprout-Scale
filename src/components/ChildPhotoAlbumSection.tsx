import React, { useMemo, useState } from 'react';
import {
  Camera,
  Check,
  CloudUpload,
  Download,
  Image as ImageIcon,
  Ruler,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  ChildPhotoRecord,
  ChildProfile,
  formatAgeLabel,
  formatFeetInches,
  formatHumanDate,
  formatMetricHeight,
  formatPounds,
  formatTotalInches,
} from '../types';

type AlbumFilter = 'all' | 'wall' | 'avatar';

interface ChildPhotoAlbumSectionProps {
  childProfile: ChildProfile;
  photos: ChildPhotoRecord[];
  accessToken: string | null;
  isSignedIn: boolean;
  onOpenAvatarStudio: () => void;
  onOpenWallEstimator: () => void;
  onUseAsAvatar: (photo: ChildPhotoRecord) => Promise<void>;
  onBackupToDrive: (photo: ChildPhotoRecord) => Promise<void>;
  onDeletePhoto: (photo: ChildPhotoRecord) => Promise<void>;
  onSignInForDrive: () => void;
}

export const ChildPhotoAlbumSection: React.FC<ChildPhotoAlbumSectionProps> = ({
  childProfile,
  photos,
  accessToken,
  isSignedIn,
  onOpenAvatarStudio,
  onOpenWallEstimator,
  onUseAsAvatar,
  onBackupToDrive,
  onDeletePhoto,
  onSignInForDrive,
}) => {
  const [filter, setFilter] = useState<AlbumFilter>('all');
  const [lightboxPhoto, setLightboxPhoto] = useState<ChildPhotoRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);

  const wallCount = useMemo(
    () => photos.filter((p) => p.kind === 'wall').length,
    [photos],
  );
  const avatarCount = useMemo(
    () => photos.filter((p) => p.kind === 'avatar').length,
    [photos],
  );

  const filteredPhotos = useMemo(() => {
    if (filter === 'all') return photos;
    return photos.filter((p) => p.kind === filter);
  }, [photos, filter]);

  const handleDownloadPhoto = (photo: ChildPhotoRecord) => {
    if (!photo.localDataUrl) return;
    const safeChild = childProfile.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Child';
    const kindLabel = photo.kind === 'wall' ? 'wall_check_in' : 'portrait';
    const link = document.createElement('a');
    link.href = photo.localDataUrl;
    link.download = `SproutScale_${safeChild}_${kindLabel}_${photo.capturedDate}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSetAvatar = async (photo: ChildPhotoRecord) => {
    setBusyPhotoId(photo.id);
    try {
      await onUseAsAvatar(photo);
    } finally {
      setBusyPhotoId(null);
    }
  };

  const handleDriveBackup = async (photo: ChildPhotoRecord) => {
    setBusyPhotoId(photo.id);
    try {
      await onBackupToDrive(photo);
    } finally {
      setBusyPhotoId(null);
    }
  };

  const handleConfirmDelete = async (photo: ChildPhotoRecord) => {
    setBusyPhotoId(photo.id);
    try {
      await onDeletePhoto(photo);
      if (lightboxPhoto?.id === photo.id) {
        setLightboxPhoto(null);
      }
      setConfirmDeleteId(null);
    } finally {
      setBusyPhotoId(null);
    }
  };

  return (
    <section
      id="photo-album"
      aria-labelledby="photo-album-heading"
      className="bg-white border-2 border-amber-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5"
    >
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-sky-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-sky-700 shrink-0" aria-hidden="true" />
            <h2
              id="photo-album-heading"
              className="text-xl sm:text-2xl font-bold tracking-tight text-indigo-950"
            >
              {childProfile.name}’s Saved Photos
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
            Every camera shot, avatar portrait, and wall height picture you take for{' '}
            <strong className="text-indigo-950">{childProfile.name}</strong> is automatically
            saved here so you never lose a keepsake moment.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenAvatarStudio}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" aria-hidden="true" />
            Take / Upload Portrait
          </button>
          <button
            type="button"
            onClick={onOpenWallEstimator}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Ruler className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
            Take Wall Photo
          </button>
        </div>
      </div>

      {/* Filter Tabs + Cloud Backup Context */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter saved photos"
          className="inline-flex items-center gap-1 p-1 bg-sky-100 rounded-lg"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filter === 'all'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-sky-900 hover:text-indigo-950'
            }`}
          >
            All Photos ({photos.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'wall'}
            onClick={() => setFilter('wall')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filter === 'wall'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-sky-900 hover:text-indigo-950'
            }`}
          >
            Wall Check-Ins ({wallCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'avatar'}
            onClick={() => setFilter('avatar')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filter === 'avatar'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-sky-900 hover:text-indigo-950'
            }`}
          >
            Portraits ({avatarCount})
          </button>
        </div>

        {!accessToken && (
          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
            <span>Photos save automatically on this device.</span>
            <button
              type="button"
              onClick={onSignInForDrive}
              className="font-bold text-sky-800 hover:text-indigo-950 hover:underline whitespace-nowrap cursor-pointer"
            >
              {isSignedIn ? 'Reconnect Google Drive to back up copies' : 'Sign in with Google to back up to Drive'}
            </button>
          </div>
        )}
      </div>

      {/* Empty State or Photo Grid */}
      {filteredPhotos.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/50 p-8 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center">
            <Camera className="w-6 h-6 text-amber-800" aria-hidden="true" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-sm font-bold text-indigo-950">
              {photos.length === 0
                ? `No saved pictures for ${childProfile.name} yet`
                : `No ${filter === 'wall' ? 'wall check-in' : 'portrait'} photos yet`}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Snap a live camera photo or upload from your phone in the Avatar Photo Studio or
              Wall Photo Ruler — every picture is kept safely in {childProfile.name}’s album.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPhotos.map((photo) => {
            const isBusy = busyPhotoId === photo.id;
            const isConfirmingDelete = confirmDeleteId === photo.id;
            const kindText = photo.kind === 'wall' ? 'Wall Check-In' : 'Portrait';

            return (
              <article
                key={photo.id}
                className="bg-slate-50/70 border border-sky-200 rounded-xl overflow-hidden flex flex-col justify-between transition-shadow hover:shadow-sm"
              >
                {/* Photo Thumbnail */}
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(photo)}
                  disabled={!photo.localDataUrl}
                  aria-label={`View full size ${kindText} photo of ${childProfile.name} from ${formatHumanDate(photo.capturedDate)}`}
                  className="relative aspect-[4/3] w-full bg-slate-900 overflow-hidden group cursor-pointer disabled:cursor-default"
                >
                  {photo.localDataUrl ? (
                    <img
                      src={photo.localDataUrl}
                      alt={`${childProfile.name} ${kindText} taken ${formatHumanDate(photo.capturedDate)}`}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 px-4 text-center text-slate-300 text-xs">
                      <ImageIcon className="w-6 h-6 text-slate-400" aria-hidden="true" />
                      <span>
                        {photo.driveFileId
                          ? 'Backed up in Google Drive — connect Drive to view on this device'
                          : 'Saved on original device'}
                      </span>
                    </div>
                  )}
                </button>

                {/* Photo Details & Actions */}
                <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold text-slate-600">
                      <span
                        className={
                          photo.kind === 'wall'
                            ? 'font-bold text-emerald-800'
                            : 'font-bold text-sky-800'
                        }
                      >
                        {kindText}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatHumanDate(photo.capturedDate)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatAgeLabel(photo.ageMonths)}</span>
                    </div>

                    {photo.heightCm > 0 && (
                      <p className="text-xs font-mono font-bold tabular-nums text-indigo-950">
                        <span>{formatFeetInches(photo.heightCm)}</span>{' '}
                        <span className="text-sky-800">({formatTotalInches(photo.heightCm)})</span>
                        {photo.weightKg > 0 && (
                          <>
                            <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
                            <span className="text-rose-700">{formatPounds(photo.weightKg)}</span>
                          </>
                        )}
                        <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                          {formatMetricHeight(photo.heightCm)}
                        </span>
                      </p>
                    )}

                    {photo.caption && (
                      <p className="text-xs text-slate-700 leading-snug line-clamp-2">
                        {photo.caption}
                      </p>
                    )}

                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      {photo.driveFileId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                          <span className="text-emerald-800 font-medium">Backed up to Google Drive</span>
                        </>
                      ) : (
                        <span>Saved in device album</span>
                      )}
                    </p>
                  </div>

                  {/* Card Footer Action Row */}
                  {isConfirmingDelete ? (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                      <span className="text-[11px] font-semibold text-rose-800">
                        Delete photo?
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleConfirmDelete(photo)}
                          className="px-2.5 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-md cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-200">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {photo.localDataUrl && (
                          <button
                            type="button"
                            onClick={() => handleDownloadPhoto(photo)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-sky-900 bg-sky-100 hover:bg-sky-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            Save JPG
                          </button>
                        )}
                        {photo.localDataUrl && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleSetAvatar(photo)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 bg-amber-300 hover:bg-amber-400 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            Use Avatar
                          </button>
                        )}
                        {photo.localDataUrl && !photo.driveFileId && accessToken && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDriveBackup(photo)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <CloudUpload className="w-3.5 h-3.5" aria-hidden="true" />
                            {isBusy ? 'Saving...' : 'Drive'}
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        aria-label={`Delete photo from ${formatHumanDate(photo.capturedDate)}`}
                        onClick={() => setConfirmDeleteId(photo.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
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

      {/* Full-Size Photo Lightbox Modal */}
      {lightboxPhoto && lightboxPhoto.localDataUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Full-size photo of ${childProfile.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4"
        >
          <div className="bg-white border-2 border-amber-300 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-sky-100">
              <div className="min-w-0">
                <p className="text-sm font-bold text-indigo-950 truncate">
                  {childProfile.name} ·{' '}
                  {lightboxPhoto.kind === 'wall' ? 'Wall Height Photo' : 'Portrait'} ·{' '}
                  {formatHumanDate(lightboxPhoto.capturedDate)}
                </p>
                <p className="text-xs text-slate-600">
                  {formatAgeLabel(lightboxPhoto.ageMonths)}
                  {lightboxPhoto.heightCm > 0
                    ? ` · ${formatFeetInches(lightboxPhoto.heightCm)} (${formatTotalInches(lightboxPhoto.heightCm)} · ${formatMetricHeight(lightboxPhoto.heightCm)})`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close full-size photo"
                onClick={() => setLightboxPhoto(null)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:bg-sky-50 hover:text-indigo-950 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="bg-slate-950 flex items-center justify-center max-h-[68vh] overflow-hidden">
              <img
                src={lightboxPhoto.localDataUrl}
                alt={`${childProfile.name} full-size photo`}
                className="max-h-[68vh] w-auto object-contain"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-t border-sky-100">
              <p className="text-xs text-slate-700">
                {lightboxPhoto.caption || 'Saved in SproutScale photo album'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPhoto(lightboxPhoto)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-sky-900 bg-sky-100 hover:bg-sky-200 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Download JPG
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSetAvatar(lightboxPhoto);
                    setLightboxPhoto(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Use as Avatar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
