import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  Image,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { ChildProfile, GrowthMeasurement } from '../types';
import {
  deleteDriveFile,
  downloadDriveGrowthBackup,
  DriveFileSummary,
  GrowthBackupPayload,
  listSproutScaleDriveFiles,
  openGoogleDrivePicker,
  overwriteDriveBackupFile,
  PickedDriveItem,
  saveGrowthBackupToDrive,
  saveKeepsakeChartToDrive,
} from '../services/googleDriveService';
import { GoogleSignInButton } from './GoogleSignInButton';

interface GoogleDriveVaultSectionProps {
  childProfile: ChildProfile;
  measurements: GrowthMeasurement[];
  accessToken: string | null;
  needsDriveAuth: boolean;
  isSigningIn: boolean;
  onSignInForDrive: () => Promise<void>;
  onRequireReauth: () => void;
  onImportBackupPayload: (payload: GrowthBackupPayload) => Promise<void>;
}

type PendingDriveConfirm =
  | {
      kind: 'delete';
      file: DriveFileSummary;
    }
  | {
      kind: 'overwrite';
      file: DriveFileSummary;
    };

function formatFileSize(bytesStr?: string): string {
  if (!bytesStr) return 'Drive file';
  const bytes = Number(bytesStr);
  if (Number.isNaN(bytes) || bytes <= 0) return 'Drive file';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatModifiedDate(iso?: string): string {
  if (!iso) return 'Recently';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Recently';
  return d.toISOString().slice(0, 10);
}

export const GoogleDriveVaultSection: React.FC<GoogleDriveVaultSectionProps> = ({
  childProfile,
  measurements,
  accessToken,
  needsDriveAuth,
  isSigningIn,
  onSignInForDrive,
  onRequireReauth,
  onImportBackupPayload,
}) => {
  const [driveFiles, setDriveFiles] = useState<DriveFileSummary[]>([]);
  const [pickedAttachments, setPickedAttachments] = useState<PickedDriveItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Mandatory explicit user confirmation modal state for destructive / mutating Drive calls
  const [pendingConfirm, setPendingConfirm] = useState<PendingDriveConfirm | null>(
    null,
  );

  const handleDriveError = useCallback(
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Google Drive action failed.';
      if (msg.includes('AUTH_REQUIRED')) {
        onRequireReauth();
        setFeedback({
          type: 'error',
          message: 'Please sign in with Google to authorize Google Drive access.',
        });
      } else {
        setFeedback({ type: 'error', message: msg });
      }
    },
    [onRequireReauth],
  );

  const refreshDriveFiles = useCallback(async () => {
    if (!accessToken) {
      setDriveFiles([]);
      return;
    }
    setIsLoadingFiles(true);
    try {
      const files = await listSproutScaleDriveFiles(accessToken);
      setDriveFiles(files);
    } catch (err) {
      handleDriveError(err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [accessToken, handleDriveError]);

  useEffect(() => {
    if (accessToken && !needsDriveAuth) {
      void refreshDriveFiles();
    } else {
      setDriveFiles([]);
    }
  }, [accessToken, needsDriveAuth, refreshDriveFiles]);

  const handleSaveNewBackup = async () => {
    if (!accessToken) {
      onRequireReauth();
      return;
    }
    setActiveAction('save-backup');
    setFeedback(null);
    try {
      const created = await saveGrowthBackupToDrive(
        accessToken,
        childProfile,
        measurements,
      );
      setFeedback({
        type: 'success',
        message: `Saved "${created.name}" to your Google Drive.`,
      });
      await refreshDriveFiles();
    } catch (err) {
      handleDriveError(err);
    } finally {
      setActiveAction(null);
    }
  };

  const handleSaveKeepsakeSvg = async () => {
    if (!accessToken) {
      onRequireReauth();
      return;
    }
    setActiveAction('save-poster');
    setFeedback(null);
    try {
      const created = await saveKeepsakeChartToDrive(
        accessToken,
        childProfile,
        measurements,
      );
      setFeedback({
        type: 'success',
        message: `Saved printable keepsake poster "${created.name}" to Google Drive.`,
      });
      await refreshDriveFiles();
    } catch (err) {
      handleDriveError(err);
    } finally {
      setActiveAction(null);
    }
  };

  const handlePickBackupViaPicker = async () => {
    if (!accessToken) {
      onRequireReauth();
      return;
    }
    setActiveAction('pick-backup');
    setFeedback(null);
    try {
      const picked = await openGoogleDrivePicker(accessToken, {
        includeUploadView: false,
        title: 'Pick a SproutScale Growth Backup (.json) from Google Drive',
      });
      if (!picked) {
        return;
      }
      const payload = await downloadDriveGrowthBackup(accessToken, picked.id);
      await onImportBackupPayload(payload);
      setFeedback({
        type: 'success',
        message: `Imported ${payload.measurements.length} growth milestones from "${picked.name}".`,
      });
    } catch (err) {
      handleDriveError(err);
    } finally {
      setActiveAction(null);
    }
  };

  const handlePickOrUploadAttachment = async () => {
    if (!accessToken) {
      onRequireReauth();
      return;
    }
    setActiveAction('pick-attachment');
    setFeedback(null);
    try {
      const picked = await openGoogleDrivePicker(accessToken, {
        includeUploadView: true,
        title: 'Select or Upload a Checkup Record or Milestone Photo in Google Drive',
      });
      if (!picked) {
        return;
      }
      setPickedAttachments((prev) => {
        const withoutDup = prev.filter((item) => item.id !== picked.id);
        return [picked, ...withoutDup];
      });
      setFeedback({
        type: 'success',
        message: `Linked "${picked.name}" from Google Drive to this session.`,
      });
      await refreshDriveFiles();
    } catch (err) {
      handleDriveError(err);
    } finally {
      setActiveAction(null);
    }
  };

  const handleImportFromVaultRow = async (file: DriveFileSummary) => {
    if (!accessToken) {
      onRequireReauth();
      return;
    }
    setActiveAction(`import-${file.id}`);
    setFeedback(null);
    try {
      const payload = await downloadDriveGrowthBackup(accessToken, file.id);
      await onImportBackupPayload(payload);
      setFeedback({
        type: 'success',
        message: `Restored ${payload.measurements.length} milestones from "${file.name}".`,
      });
    } catch (err) {
      handleDriveError(err);
    } finally {
      setActiveAction(null);
    }
  };

  const executeConfirmedDriveMutation = async () => {
    if (!pendingConfirm || !accessToken) {
      setPendingConfirm(null);
      return;
    }

    const target = pendingConfirm;
    setPendingConfirm(null);
    setFeedback(null);

    if (target.kind === 'delete') {
      setActiveAction(`delete-${target.file.id}`);
      try {
        await deleteDriveFile(accessToken, target.file.id);
        setDriveFiles((prev) => prev.filter((f) => f.id !== target.file.id));
        setPickedAttachments((prev) => prev.filter((f) => f.id !== target.file.id));
        setFeedback({
          type: 'success',
          message: `Deleted "${target.file.name}" from Google Drive.`,
        });
      } catch (err) {
        handleDriveError(err);
      } finally {
        setActiveAction(null);
      }
    } else if (target.kind === 'overwrite') {
      setActiveAction(`overwrite-${target.file.id}`);
      try {
        const updated = await overwriteDriveBackupFile(
          accessToken,
          target.file.id,
          childProfile,
          measurements,
        );
        setFeedback({
          type: 'success',
          message: `Updated "${updated.name}" in Google Drive with ${childProfile.name}’s latest milestones.`,
        });
        await refreshDriveFiles();
      } catch (err) {
        handleDriveError(err);
      } finally {
        setActiveAction(null);
      }
    }
  };

  return (
    <section id="drive-vault" className="space-y-6 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-indigo-950 dark:text-white">
            Google Drive Keepsake Vault &amp; Picker
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 max-w-2xl">
            Export {childProfile.name}’s Age 2-to-today growth records and printable SVG
            posters to your Google Drive, or use Google Picker to import backups and attach
            checkup files.
          </p>
        </div>

        {!needsDriveAuth && accessToken && (
          <button
            type="button"
            onClick={() => void refreshDriveFiles()}
            disabled={isLoadingFiles}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-sky-900 dark:text-sky-200 bg-white dark:bg-slate-900 border-2 border-sky-200 dark:border-slate-700 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh Drive Files
          </button>
        )}
      </div>

      {feedback && (
        <div
          role="status"
          className={`px-4 py-3 rounded-xl text-xs font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-200 border-red-200 dark:border-red-800'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {needsDriveAuth || !accessToken ? (
        /* Auth Required Card with Official "Sign in with Google" Button */
        <div className="bg-white dark:bg-slate-900 border-2 border-amber-200 dark:border-slate-700 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xs">
          <div className="space-y-2 max-w-xl">
            <h3 className="text-lg font-bold text-indigo-950 dark:text-white">
              Connect Google Drive &amp; Google Picker
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Sign in with Google to save {childProfile.name}’s growth backups and
              printable keepsake charts to your Google Drive, or browse files with Google
              Picker.
            </p>
            <div className="text-xs text-sky-800 dark:text-sky-300 font-medium pt-0.5">
              <span>JSON Growth Backups</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>Printable SVG Growth Posters</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>Google Picker File Selector</span>
            </div>
          </div>

          <GoogleSignInButton
            onClick={() => void onSignInForDrive()}
            disabled={isSigningIn}
            label={isSigningIn ? 'Connecting...' : 'Sign in with Google'}
          />
        </div>
      ) : (
        /* Connected Google Drive & Picker Workspace */
        <div className="bg-white dark:bg-slate-900 border-2 border-sky-200 dark:border-slate-700 rounded-2xl p-5 sm:p-6 space-y-6 shadow-xs">
          {/* Action Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => void handleSaveNewBackup()}
              disabled={activeAction !== null}
              className="h-11 px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
              {activeAction === 'save-backup'
                ? 'Saving Backup...'
                : 'Save Backup (.json) to Drive'}
            </button>

            <button
              type="button"
              onClick={() => void handleSaveKeepsakeSvg()}
              disabled={activeAction !== null}
              className="h-11 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Image className="w-4 h-4 shrink-0" aria-hidden="true" />
              {activeAction === 'save-poster'
                ? 'Creating Poster...'
                : 'Save Keepsake Poster (.svg)'}
            </button>

            <button
              type="button"
              onClick={() => void handlePickBackupViaPicker()}
              disabled={activeAction !== null}
              className="h-11 px-4 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
              {activeAction === 'pick-backup'
                ? 'Opening Picker...'
                : 'Pick Backup via Google Picker'}
            </button>

            <button
              type="button"
              onClick={() => void handlePickOrUploadAttachment()}
              disabled={activeAction !== null}
              className="h-11 px-4 py-2.5 text-xs font-bold text-indigo-950 dark:text-sky-200 bg-sky-100 dark:bg-slate-800 hover:bg-sky-200 dark:hover:bg-slate-700 disabled:opacity-60 rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-sky-700 dark:text-sky-400 shrink-0" aria-hidden="true" />
              {activeAction === 'pick-attachment'
                ? 'Opening Picker...'
                : 'Pick or Upload Checkup File'}
            </button>
          </div>

          {/* Linked Checkup / Keepsake Files Picked via Google Picker */}
          {pickedAttachments.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Selected via Google Picker in This Session
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pickedAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="py-2.5 flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">
                        {att.name}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        <span>{att.mimeType}</span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span>Selected via Google Picker</span>
                      </p>
                    </div>
                    {att.url && (
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 whitespace-nowrap shrink-0"
                      >
                        Open in Drive
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SproutScale Files Stored in Google Drive */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Saved SproutScale Files in Your Google Drive
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {driveFiles.length} {driveFiles.length === 1 ? 'file' : 'files'}
              </span>
            </div>

            {isLoadingFiles ? (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Loading your SproutScale files from Google Drive...
              </p>
            ) : driveFiles.length === 0 ? (
              <div className="py-6 text-center space-y-1">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  No SproutScale exports saved in your Google Drive yet
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click “Save Backup (.json) to Drive” or “Save Keepsake Poster (.svg)” above
                  to store your first growth file.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <th className="py-2.5 pr-4">File Name</th>
                      <th className="py-2.5 px-4">Details</th>
                      <th className="py-2.5 pl-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {driveFiles.map((file) => {
                      const isJson =
                        file.mimeType === 'application/json' ||
                        file.name.toLowerCase().endsWith('.json');
                      return (
                        <tr
                          key={file.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileSpreadsheet
                                className="w-4 h-4 text-slate-400 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="font-semibold text-slate-900 dark:text-white truncate max-w-xs">
                                {file.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            <span>{isJson ? 'JSON Backup' : 'SVG Poster'}</span>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span>{formatModifiedDate(file.modifiedTime)}</span>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span>{formatFileSize(file.size)}</span>
                          </td>
                          <td className="py-3 pl-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-3">
                              {isJson && (
                                <>
                                  <button
                                    type="button"
                                    disabled={activeAction !== null}
                                    onClick={() => void handleImportFromVaultRow(file)}
                                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                    Import
                                  </button>

                                  <button
                                    type="button"
                                    disabled={activeAction !== null}
                                    onClick={() =>
                                      setPendingConfirm({ kind: 'overwrite', file })
                                    }
                                    className="font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    Update
                                  </button>
                                </>
                              )}

                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-300 hover:text-sky-800 dark:hover:text-white whitespace-nowrap shrink-0"
                                >
                                  Open
                                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                </a>
                              )}

                              <button
                                type="button"
                                disabled={activeAction !== null}
                                aria-label={`Delete ${file.name} from Google Drive`}
                                onClick={() =>
                                  setPendingConfirm({ kind: 'delete', file })
                                }
                                className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 disabled:opacity-50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mandatory Explicit Confirmation Modal for Mutating / Destructive Google Drive Operations */}
      {pendingConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="drive-confirm-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-4 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  pendingConfirm.kind === 'delete' ? 'text-red-600' : 'text-amber-600'
                }`}
                aria-hidden="true"
              />
              <div className="space-y-1.5">
                <h3
                  id="drive-confirm-dialog-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  {pendingConfirm.kind === 'delete'
                    ? `Delete "${pendingConfirm.file.name}" from Google Drive?`
                    : `Update contents of "${pendingConfirm.file.name}"?`}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {pendingConfirm.kind === 'delete'
                    ? `This will permanently delete 1 file ("${pendingConfirm.file.name}") from your Google Drive. This action cannot be undone.`
                    : `This will overwrite "${pendingConfirm.file.name}" in your Google Drive with ${childProfile.name}’s latest Age 2 baseline and ${measurements.length} recorded growth milestone(s).`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void executeConfirmedDriveMutation()}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  pendingConfirm.kind === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {pendingConfirm.kind === 'delete' ? 'Delete File' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
