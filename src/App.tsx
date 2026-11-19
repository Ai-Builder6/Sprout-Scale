/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Cake,
  Camera,
  ChartLine,
  Image as ImageIcon,
  LogOut,
  Plus,
  Ruler,
  Share2,
  SlidersHorizontal,
  Smartphone,
} from 'lucide-react';
import {
  clearAccessToken,
  db,
  googleSignIn,
  handleFirestoreError,
  initAuth,
  logout,
  OperationType,
} from './firebase';
import {
  AccessoryId,
  BiologicalSex,
  calculateExactAgeFromDob,
  CHARACTER_PALETTES,
  ChildPhotoKind,
  ChildPhotoRecord,
  ChildProfile,
  clampNumber,
  DEMO_CHILD,
  DEMO_MEASUREMENTS,
  formatFeetInches,
  formatHumanDate,
  formatMetricHeight,
  formatPounds,
  formatTotalInches,
  getLocalTodayIso,
  GrowthMeasurement,
  HAIR_COLOR_PRESETS,
  HairStyle,
  PaletteId,
  sanitizeBiologicalSex,
  sanitizeHexColor,
  sanitizeId,
  SKIN_TONE_PRESETS,
  VALIDATION_BOUNDS,
} from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GrowthWallStage } from './components/GrowthWallStage';
import {
  ControlDeckTab,
  MeasurementControlDeck,
} from './components/MeasurementControlDeck';
import { GrowthTimelineSection } from './components/GrowthTimelineSection';
import { ChildPhotoAlbumSection } from './components/ChildPhotoAlbumSection';
import { HowToMeasureSection } from './components/HowToMeasureSection';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { GoogleDriveVaultSection } from './components/GoogleDriveVaultSection';
import { ChildAvatarPhotoModal } from './components/ChildAvatarPhotoModal';
import { WallPhotoHeightEstimatorModal } from './components/WallPhotoHeightEstimatorModal';
import { AddChildModal, NewChildCreationPayload } from './components/AddChildModal';
import {
  MobileAppDownloadModal,
  OfflineIndicator,
  PWAInstallActionStrip,
} from './components/MobileAppDownloadModal';
import { usePWAInstall } from './hooks/usePWAInstall';
import {
  compressPhotoToStorageJpeg,
  cropPortraitToDataUrl,
  deleteAllLocalPhotosForChild,
  deleteLocalPhoto,
  getLocalAvatarDataUrl,
  listLocalPhotosForChild,
  removeLocalAvatarDataUrl,
  SavedLocalPhotoRecord,
  saveLocalAvatarDataUrl,
  savePhotoToLocalAlbum,
  updateLocalPhotoRecord,
} from './services/avatarPhotoService';
import {
  downloadDriveImageAsDataUrl,
  GrowthBackupPayload,
  uploadChildAvatarToDrive,
  uploadChildPhotoToDrive,
} from './services/googleDriveService';

const GUEST_CHILDREN_STORAGE_KEY = 'sproutscale_guest_children_v1';
const GUEST_MEASUREMENTS_STORAGE_KEY = 'sproutscale_guest_measurements_v1';
const SELECTED_CHILD_STORAGE_KEY = 'sproutscale_selected_child_id_v1';

function loadStoredGuestChildren(): ChildProfile[] {
  try {
    const raw = window.localStorage.getItem(GUEST_CHILDREN_STORAGE_KEY);
    if (!raw) return [DEMO_CHILD];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter(
        (c): c is ChildProfile => Boolean(c && typeof c.id === 'string' && typeof c.name === 'string'),
      );
    }
  } catch {
    // Ignore storage read errors
  }
  return [DEMO_CHILD];
}

function loadStoredGuestMeasurements(): Record<string, GrowthMeasurement[]> {
  try {
    const raw = window.localStorage.getItem(GUEST_MEASUREMENTS_STORAGE_KEY);
    if (!raw) return { [DEMO_CHILD.id]: DEMO_MEASUREMENTS };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, GrowthMeasurement[]>;
    }
  } catch {
    // Ignore storage read errors
  }
  return { [DEMO_CHILD.id]: DEMO_MEASUREMENTS };
}

function loadStoredSelectedChildId(): string {
  try {
    const saved = window.localStorage.getItem(SELECTED_CHILD_STORAGE_KEY);
    if (saved && saved.length > 0) return saved;
  } catch {
    // Ignore storage read errors
  }
  return DEMO_CHILD.id;
}

function getTodayIsoDate(): string {
  return getLocalTodayIso();
}

function SproutScaleWorkspace() {
  // Firebase Auth & In-Memory Google Workspace Token state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsDriveAuth, setNeedsDriveAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Guest Playground state (persisted in localStorage so multiple children never reset!)
  const [demoChildren, setDemoChildren] = useState<ChildProfile[]>(loadStoredGuestChildren);
  const [demoMeasurementsMap, setDemoMeasurementsMap] = useState<
    Record<string, GrowthMeasurement[]>
  >(loadStoredGuestMeasurements);

  // Cloud Firestore state isolated strictly per childId so sibling data never bleeds across children!
  const [cloudChildren, setCloudChildren] = useState<ChildProfile[]>([]);
  const [cloudMeasurementsByChild, setCloudMeasurementsByChild] = useState<
    Record<string, GrowthMeasurement[]>
  >({});
  const [cloudPhotosByChild, setCloudPhotosByChild] = useState<
    Record<string, ChildPhotoRecord[]>
  >({});
  const [localPhotosByChild, setLocalPhotosByChild] = useState<
    Record<string, SavedLocalPhotoRecord[]>
  >({});
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);

  // Active child & UI controls
  const [selectedChildId, setSelectedChildId] = useState<string>(loadStoredSelectedChildId);
  const [activeDeckTab, setActiveDeckTab] = useState<ControlDeckTab>('measure');
  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Refs that prevent Firestore onSnapshot from ever snapping back to the first child
  const selectedChildIdRef = useRef<string>(selectedChildId);
  const pendingChildIdRef = useRef<string | null>(null);
  const demoChildrenRef = useRef<ChildProfile[]>(demoChildren);
  const demoMeasurementsMapRef = useRef<Record<string, GrowthMeasurement[]>>(demoMeasurementsMap);

  // Synchronously update selectedChildIdRef + localStorage + React state together
  const selectChildProfile = (nextChildId: string) => {
    selectedChildIdRef.current = nextChildId;
    setSelectedChildId(nextChildId);
    try {
      window.localStorage.setItem(SELECTED_CHILD_STORAGE_KEY, nextChildId);
    } catch {
      // Ignore storage write errors
    }
  };

  useEffect(() => {
    selectedChildIdRef.current = selectedChildId;
    try {
      window.localStorage.setItem(SELECTED_CHILD_STORAGE_KEY, selectedChildId);
    } catch {
      // Ignore storage write errors
    }
  }, [selectedChildId]);

  useEffect(() => {
    demoChildrenRef.current = demoChildren;
    try {
      window.localStorage.setItem(GUEST_CHILDREN_STORAGE_KEY, JSON.stringify(demoChildren));
    } catch {
      // Ignore storage write errors
    }
  }, [demoChildren]);

  useEffect(() => {
    demoMeasurementsMapRef.current = demoMeasurementsMap;
    try {
      window.localStorage.setItem(
        GUEST_MEASUREMENTS_STORAGE_KEY,
        JSON.stringify(demoMeasurementsMap),
      );
    } catch {
      // Ignore storage write errors
    }
  }, [demoMeasurementsMap]);

  // Live Interactive Measurement Draft (drives the growing character on the wall in real time!)
  const [draftHeightCm, setDraftHeightCm] = useState<number>(116.5);
  const [draftWeightKg, setDraftWeightKg] = useState<number>(21.0);
  const [draftAgeMonths, setDraftAgeMonths] = useState<number>(72);
  const [draftDate, setDraftDate] = useState<string>(getTodayIsoDate());
  const [draftNote, setDraftNote] = useState<string>('');

  // Growth Timelapse Playback state ("Play Growth from Age 2")
  const [isPlayingTimelapse, setIsPlayingTimelapse] = useState<boolean>(false);
  const timelapseTimerRef = useRef<number | null>(null);

  // Realistic Child Photo Avatar cache & Studio / Wall Photo Guesstimator / Mobile App Download modal state
  const [avatarPhotoMap, setAvatarPhotoMap] = useState<Record<string, string>>({});
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState<boolean>(false);
  const [isWallEstimatorOpen, setIsWallEstimatorOpen] = useState<boolean>(false);
  const [isMobileAppModalOpen, setIsMobileAppModalOpen] = useState<boolean>(false);
  const [mobileNavActive, setMobileNavActive] = useState<
    'wall' | 'measure' | 'ruler' | 'history' | 'app'
  >('wall');

  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();

  // If someone opens the shared download link (?install=1) and hasn't installed yet, open the installer sheet
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('install') === '1' && !isInstalled) {
      setIsMobileAppModalOpen(true);
    }
  }, [isInstalled]);

  // Active children list & measurements depending on Auth state
  const activeChildrenList = user ? cloudChildren : demoChildren;
  const activeChild: ChildProfile = useMemo(() => {
    const found = activeChildrenList.find((c) => c.id === selectedChildId);
    return found ?? activeChildrenList[0] ?? DEMO_CHILD;
  }, [activeChildrenList, selectedChildId]);

  const activeAvatarPhotoUrl = avatarPhotoMap[activeChild.id] ?? null;

  const activeChildLiveAge = useMemo(
    () => (activeChild.birthDate ? calculateExactAgeFromDob(activeChild.birthDate) : null),
    [activeChild.birthDate],
  );

  const activeMeasurements: GrowthMeasurement[] = useMemo(() => {
    if (user) {
      return (cloudMeasurementsByChild[activeChild.id] ?? []).filter(
        (m) => m.childId === activeChild.id,
      );
    }
    return demoMeasurementsMap[activeChild.id] ?? [];
  }, [user, cloudMeasurementsByChild, demoMeasurementsMap, activeChild.id]);

  // Merge Firestore photo metadata with IndexedDB local image data strictly for activeChild
  const activePhotos: ChildPhotoRecord[] = useMemo(() => {
    const childLocalPhotos = localPhotosByChild[activeChild.id] ?? [];
    const childCloudPhotos = cloudPhotosByChild[activeChild.id] ?? [];

    const localById = new Map<string, SavedLocalPhotoRecord>();
    for (const lp of childLocalPhotos) {
      if (lp.childId === activeChild.id) {
        localById.set(lp.id, lp);
      }
    }

    const mergedMap = new Map<string, ChildPhotoRecord>();

    if (user) {
      for (const cp of childCloudPhotos) {
        if (cp.childId !== activeChild.id) continue;
        const match = localById.get(cp.id);
        mergedMap.set(cp.id, {
          ...cp,
          localDataUrl: match?.dataUrl,
        });
      }
    }

    for (const lp of childLocalPhotos) {
      if (lp.childId !== activeChild.id) continue;
      if (!mergedMap.has(lp.id)) {
        mergedMap.set(lp.id, {
          id: lp.id,
          ownerId: user ? user.uid : 'demo_family',
          childId: lp.childId,
          kind: lp.kind,
          capturedDate: lp.capturedDate,
          ageMonths: lp.ageMonths,
          heightCm: lp.heightCm,
          weightKg: lp.weightKg,
          caption: lp.caption,
          driveFileId: lp.driveFileId,
          createdAtMs: lp.createdAtMs,
          localDataUrl: lp.dataUrl,
        });
      }
    }

    const merged = Array.from(mergedMap.values());
    merged.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
    return merged;
  }, [user, cloudPhotosByChild, localPhotosByChild, activeChild.id]);

  // Latest recorded milestone for active child (fallback to Age 2 baseline or DOB age)
  const latestMilestone = useMemo(() => {
    if (activeMeasurements.length === 0) {
      const dobMonths = activeChild.birthDate
        ? calculateExactAgeFromDob(activeChild.birthDate)?.totalMonths
        : undefined;
      return {
        heightCm: activeChild.ageTwoHeightCm,
        weightKg: activeChild.ageTwoWeightKg,
        ageMonths: dobMonths ?? 24,
      };
    }
    const sorted = [...activeMeasurements].sort((a, b) => b.ageMonths - a.ageMonths);
    return sorted[0];
  }, [activeMeasurements, activeChild]);

  // Sync draft sliders whenever active child or latest milestone changes (unless playing timelapse)
  useEffect(() => {
    if (!isPlayingTimelapse) {
      setDraftHeightCm(latestMilestone.heightCm);
      setDraftWeightKg(latestMilestone.weightKg);
      const hasOnlyAgeTwoSeed =
        activeMeasurements.length === 0 ||
        (activeMeasurements.length === 1 &&
          activeMeasurements[0].ageMonths === 24 &&
          activeMeasurements[0].id.includes('24'));
      if (activeChild.birthDate && hasOnlyAgeTwoSeed) {
        const calc = calculateExactAgeFromDob(activeChild.birthDate, draftDate);
        setDraftAgeMonths(calc ? calc.totalMonths : latestMilestone.ageMonths);
      } else {
        setDraftAgeMonths(latestMilestone.ageMonths);
      }
    }
  }, [
    activeChild.id,
    activeChild.birthDate,
    activeMeasurements.length,
    draftDate,
    latestMilestone.heightCm,
    latestMilestone.weightKg,
    latestMilestone.ageMonths,
    isPlayingTimelapse,
  ]);

  // Load cached portrait photos from IndexedDB (and Google Drive when fileId is present)
  useEffect(() => {
    let cancelled = false;

    const syncPortraits = async () => {
      for (const kid of activeChildrenList) {
        if (avatarPhotoMap[kid.id]) continue;

        const cachedLocal = await getLocalAvatarDataUrl(kid.id);
        if (cancelled) return;

        if (cachedLocal) {
          setAvatarPhotoMap((prev) => (prev[kid.id] ? prev : { ...prev, [kid.id]: cachedLocal }));
          continue;
        }

        if (kid.avatarDriveFileId && accessToken) {
          try {
            const downloaded = await downloadDriveImageAsDataUrl(
              accessToken,
              kid.avatarDriveFileId,
            );
            if (cancelled) return;
            await saveLocalAvatarDataUrl(kid.id, downloaded);
            setAvatarPhotoMap((prev) => ({ ...prev, [kid.id]: downloaded }));
          } catch {
            // Keep illustrated fallback if Drive photo is unavailable or requires re-auth
          }
        }
      }
    };

    void syncPortraits();
    return () => {
      cancelled = true;
    };
  }, [activeChildrenList, accessToken, avatarPhotoMap]);

  // 1. Initialize Firebase Auth & In-Memory OAuth Token state
  useEffect(() => {
    const seedInitialProfileIfEmpty = async (currentUser: User) => {
      if (!currentUser.emailVerified) return;
      const childrenPath = 'children';
      try {
        const existingSnap = await getDocs(
          query(collection(db, childrenPath), where('ownerId', '==', currentUser.uid)),
        );
        if (existingSnap.empty) {
          // Migrate any locally created children from Playground mode instead of resetting to a single default
          const localKids =
            demoChildrenRef.current.length > 0 ? demoChildrenRef.current : [DEMO_CHILD];
          let firstMigratedId: string | null = null;

          for (let idx = 0; idx < localKids.length; idx += 1) {
            const kid = localKids[idx];
            const childId = sanitizeId(`child_${currentUser.uid.slice(0, 12)}_${idx + 1}`);
            if (!firstMigratedId) firstMigratedId = childId;

            await setDoc(doc(db, 'children', childId), {
              ownerId: currentUser.uid,
              name: kid.name.slice(0, VALIDATION_BOUNDS.NAME_MAX_LEN) || DEMO_CHILD.name,
              birthDate: VALIDATION_BOUNDS.DATE_PATTERN.test(kid.birthDate) ? kid.birthDate : '',
              sex: sanitizeBiologicalSex(kid.sex),
              ageTwoHeightCm: clampNumber(
                kid.ageTwoHeightCm,
                VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MIN,
                VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MAX,
              ),
              ageTwoWeightKg: clampNumber(
                kid.ageTwoWeightKg,
                VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MIN,
                VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MAX,
              ),
              paletteId: kid.paletteId || 'meadow',
              accessoryId: kid.accessoryId || 'sprout',
              hairStyle: kid.hairStyle || 'curls',
              skinTone: sanitizeHexColor(kid.skinTone, SKIN_TONE_PRESETS[1].hex),
              hairColor: sanitizeHexColor(kid.hairColor, HAIR_COLOR_PRESETS[1].hex),
              avatarDriveFileId: '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            const localMs = demoMeasurementsMapRef.current[kid.id] ?? [];
            if (localMs.length > 0) {
              for (let mIdx = 0; mIdx < localMs.length; mIdx += 1) {
                const m = localMs[mIdx];
                const mId = sanitizeId(`m_${childId}_${mIdx}_${m.ageMonths}m`);
                await setDoc(doc(db, 'children', childId, 'measurements', mId), {
                  ownerId: currentUser.uid,
                  childId,
                  ageMonths: Math.round(
                    clampNumber(
                      m.ageMonths,
                      VALIDATION_BOUNDS.AGE_MONTHS_MIN,
                      VALIDATION_BOUNDS.AGE_MONTHS_MAX,
                    ),
                  ),
                  heightCm: Number(
                    clampNumber(
                      m.heightCm,
                      VALIDATION_BOUNDS.HEIGHT_CM_MIN,
                      VALIDATION_BOUNDS.HEIGHT_CM_MAX,
                    ).toFixed(1),
                  ),
                  weightKg: Number(
                    clampNumber(
                      m.weightKg,
                      VALIDATION_BOUNDS.WEIGHT_KG_MIN,
                      VALIDATION_BOUNDS.WEIGHT_KG_MAX,
                    ).toFixed(1),
                  ),
                  recordedDate: VALIDATION_BOUNDS.DATE_PATTERN.test(m.recordedDate)
                    ? m.recordedDate
                    : getTodayIsoDate(),
                  note: String(m.note ?? '').slice(0, VALIDATION_BOUNDS.NOTE_MAX_LEN),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
            } else {
              const baselineMId = sanitizeId(`m_${childId}_24m`);
              await setDoc(doc(db, 'children', childId, 'measurements', baselineMId), {
                ownerId: currentUser.uid,
                childId,
                ageMonths: 24,
                heightCm: kid.ageTwoHeightCm,
                weightKg: kid.ageTwoWeightKg,
                recordedDate: getTodayIsoDate(),
                note: 'Age 2 starting height & weight baseline',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          }

          if (firstMigratedId) {
            pendingChildIdRef.current = firstMigratedId;
            selectChildProfile(firstMigratedId);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, childrenPath);
      }
    };

    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setAccessToken(token);
        setNeedsDriveAuth(false);
        setIsAuthReady(true);
        void seedInitialProfileIfEmpty(authedUser);
      },
      (maybeUser) => {
        setUser(maybeUser);
        setAccessToken(null);
        setNeedsDriveAuth(true);
        setIsAuthReady(true);
        if (maybeUser) {
          void seedInitialProfileIfEmpty(maybeUser);
        }
      },
    );

    return () => unsubscribe();
  }, []);

  // 2. Attach real-time onSnapshot listener for user's ChildProfiles
  // IMPORTANT: Do NOT include selectedChildId in dependencies — prevents snap-back to first child!
  useEffect(() => {
    if (!isAuthReady || !user) {
      setCloudChildren([]);
      return;
    }

    setIsLoadingCloud(true);
    const childrenPath = 'children';
    const q = query(collection(db, childrenPath), where('ownerId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCloudChildren((prev) => {
          const prevCreatedMap = new Map<string, number>();
          for (const existingKid of prev) {
            if (existingKid.createdAtMs) {
              prevCreatedMap.set(existingKid.id, existingKid.createdAtMs);
            }
          }

          const loaded: ChildProfile[] = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            const rawBirthDate = String(d.birthDate ?? '');
            const rawDriveFileId = String(d.avatarDriveFileId ?? '');
            const createdAtField = d.createdAt as { toMillis?: () => number } | undefined;
            const createdAtMs =
              createdAtField && typeof createdAtField.toMillis === 'function'
                ? createdAtField.toMillis()
                : prevCreatedMap.get(docSnap.id) ?? Date.now();
            return {
              id: docSnap.id,
              ownerId: String(d.ownerId ?? user.uid),
              name: String(d.name ?? 'Sprout'),
              birthDate: VALIDATION_BOUNDS.DATE_PATTERN.test(rawBirthDate) ? rawBirthDate : '',
              sex: sanitizeBiologicalSex(d.sex),
              ageTwoHeightCm: Number(d.ageTwoHeightCm ?? 86.5),
              ageTwoWeightKg: Number(d.ageTwoWeightKg ?? 12.5),
              paletteId: (d.paletteId as PaletteId) ?? 'meadow',
              accessoryId: (d.accessoryId as AccessoryId) ?? 'sprout',
              hairStyle: (d.hairStyle as HairStyle) ?? 'curls',
              skinTone: sanitizeHexColor(
                typeof d.skinTone === 'string' ? d.skinTone : undefined,
                SKIN_TONE_PRESETS[1].hex,
              ),
              hairColor: sanitizeHexColor(
                typeof d.hairColor === 'string' ? d.hairColor : undefined,
                HAIR_COLOR_PRESETS[1].hex,
              ),
              avatarDriveFileId:
                rawDriveFileId.length > 0 &&
                rawDriveFileId.length <= VALIDATION_BOUNDS.ID_MAX_LEN &&
                VALIDATION_BOUNDS.ID_PATTERN.test(rawDriveFileId)
                  ? rawDriveFileId
                  : '',
              createdAtMs,
            };
          });

          // Stable chronological order so siblings never jump around
          loaded.sort((a, b) => {
            const timeDiff = (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0);
            return timeDiff !== 0 ? timeDiff : a.id.localeCompare(b.id);
          });

          const pendingId = pendingChildIdRef.current;
          if (pendingId) {
            if (loaded.some((c) => c.id === pendingId)) {
              if (!snapshot.metadata.hasPendingWrites) {
                pendingChildIdRef.current = null;
              }
              selectChildProfile(pendingId);
            }
          } else if (
            loaded.length > 0 &&
            !loaded.some((c) => c.id === selectedChildIdRef.current)
          ) {
            selectChildProfile(loaded[0].id);
          }

          return loaded;
        });

        setIsLoadingCloud(false);
      },
      (error) => {
        setIsLoadingCloud(false);
        handleFirestoreError(error, OperationType.LIST, childrenPath);
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // 3. Attach real-time onSnapshot listener for active child's GrowthMeasurements (stored per childId!)
  useEffect(() => {
    if (!isAuthReady || !user || !activeChild?.id || cloudChildren.length === 0) {
      return;
    }
    const targetChildId = activeChild.id;
    const targetAgeTwoHeight = activeChild.ageTwoHeightCm;
    const targetAgeTwoWeight = activeChild.ageTwoWeightKg;

    if (!cloudChildren.some((c) => c.id === targetChildId)) {
      return;
    }

    const measurementsPath = `children/${targetChildId}/measurements`;
    const q = query(
      collection(db, 'children', targetChildId, 'measurements'),
      where('ownerId', '==', user.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: GrowthMeasurement[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            ownerId: String(d.ownerId ?? user.uid),
            childId: String(d.childId ?? targetChildId),
            ageMonths: Number(d.ageMonths ?? 24),
            heightCm: Number(d.heightCm ?? targetAgeTwoHeight),
            weightKg: Number(d.weightKg ?? targetAgeTwoWeight),
            recordedDate: String(d.recordedDate ?? getTodayIsoDate()),
            note: String(d.note ?? ''),
          };
        });
        loaded.sort((a, b) => a.ageMonths - b.ageMonths);
        setCloudMeasurementsByChild((prev) => ({
          ...prev,
          [targetChildId]: loaded,
        }));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, measurementsPath);
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, user, activeChild.id, activeChild.ageTwoHeightCm, activeChild.ageTwoWeightKg, cloudChildren]);

  // 4. Load active child's local Saved Photos from IndexedDB (stored per childId!)
  useEffect(() => {
    let cancelled = false;
    const targetChildId = activeChild.id;
    const loadLocalAlbum = async () => {
      const records = await listLocalPhotosForChild(targetChildId);
      if (!cancelled) {
        setLocalPhotosByChild((prev) => ({
          ...prev,
          [targetChildId]: records,
        }));
      }
    };
    void loadLocalAlbum();
    return () => {
      cancelled = true;
    };
  }, [activeChild.id]);

  // 5. Attach real-time onSnapshot listener for active child's Saved Photos metadata in Firestore
  useEffect(() => {
    if (!isAuthReady || !user || !activeChild?.id || cloudChildren.length === 0) {
      return;
    }
    const targetChildId = activeChild.id;
    if (!cloudChildren.some((c) => c.id === targetChildId)) {
      return;
    }

    const photosPath = `children/${targetChildId}/photos`;
    const q = query(
      collection(db, 'children', targetChildId, 'photos'),
      where('ownerId', '==', user.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: ChildPhotoRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const createdAtField = d.createdAt as { toMillis?: () => number } | undefined;
          const createdAtMs =
            createdAtField && typeof createdAtField.toMillis === 'function'
              ? createdAtField.toMillis()
              : Date.now();
          const kindVal: ChildPhotoKind = d.kind === 'wall' ? 'wall' : 'avatar';
          return {
            id: docSnap.id,
            ownerId: String(d.ownerId ?? user.uid),
            childId: String(d.childId ?? targetChildId),
            kind: kindVal,
            capturedDate: String(d.capturedDate ?? getTodayIsoDate()),
            ageMonths: Number(d.ageMonths ?? 24),
            heightCm: Number(d.heightCm ?? 0),
            weightKg: Number(d.weightKg ?? 0),
            caption: String(d.caption ?? ''),
            driveFileId: String(d.driveFileId ?? ''),
            createdAtMs,
          };
        });
        loaded.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setCloudPhotosByChild((prev) => ({
          ...prev,
          [targetChildId]: loaded,
        }));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, photosPath);
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, user, activeChild.id, cloudChildren]);

  // 6. Hydrate any cloud-backed Drive photos that aren't yet cached in IndexedDB on this device
  useEffect(() => {
    const targetChildId = activeChild.id;
    const childCloudPhotos = cloudPhotosByChild[targetChildId] ?? [];
    const childLocalPhotos = localPhotosByChild[targetChildId] ?? [];
    if (!accessToken || childCloudPhotos.length === 0) return;

    let cancelled = false;
    const localIdSet = new Set(childLocalPhotos.map((p) => p.id));

    const hydrateFromDrive = async () => {
      let hydratedAny = false;
      for (const cp of childCloudPhotos) {
        if (cancelled) return;
        if (!cp.driveFileId || localIdSet.has(cp.id)) continue;
        try {
          const dataUrl = await downloadDriveImageAsDataUrl(accessToken, cp.driveFileId);
          if (cancelled) return;
          await savePhotoToLocalAlbum({
            id: cp.id,
            childId: cp.childId,
            kind: cp.kind,
            dataUrl,
            capturedDate: cp.capturedDate,
            ageMonths: cp.ageMonths,
            heightCm: cp.heightCm,
            weightKg: cp.weightKg,
            caption: cp.caption,
            driveFileId: cp.driveFileId,
            createdAtMs: cp.createdAtMs,
          });
          hydratedAny = true;
        } catch {
          // Skip photo if Drive download fails or requires re-auth
        }
      }
      if (hydratedAny && !cancelled) {
        const refreshed = await listLocalPhotosForChild(targetChildId);
        if (!cancelled) {
          setLocalPhotosByChild((prev) => ({
            ...prev,
            [targetChildId]: refreshed,
          }));
        }
      }
    };

    void hydrateFromDrive();
    return () => {
      cancelled = true;
    };
  }, [accessToken, cloudPhotosByChild, localPhotosByChild, activeChild.id]);

  // Timelapse Playback Cleanup
  useEffect(() => {
    return () => {
      if (timelapseTimerRef.current !== null) {
        window.clearInterval(timelapseTimerRef.current);
      }
    };
  }, []);

  const handleToggleTimelapse = () => {
    if (isPlayingTimelapse) {
      if (timelapseTimerRef.current !== null) {
        window.clearInterval(timelapseTimerRef.current);
        timelapseTimerRef.current = null;
      }
      setIsPlayingTimelapse(false);
      return;
    }

    // Build chronological frames starting at Age 2 up through all milestones
    const sorted = [...activeMeasurements].sort((a, b) => a.ageMonths - b.ageMonths);
    const frames: { ageMonths: number; heightCm: number; weightKg: number }[] = [
      {
        ageMonths: 24,
        heightCm: activeChild.ageTwoHeightCm,
        weightKg: activeChild.ageTwoWeightKg,
      },
      ...sorted
        .filter((m) => m.ageMonths > 24)
        .map((m) => ({
          ageMonths: m.ageMonths,
          heightCm: m.heightCm,
          weightKg: m.weightKg,
        })),
    ];

    // If only Age 2 exists, demonstrate a smooth simulated growth preview to current draft or +20 cm
    if (frames.length === 1) {
      frames.push(
        {
          ageMonths: 36,
          heightCm: Number((activeChild.ageTwoHeightCm + 8.5).toFixed(1)),
          weightKg: Number((activeChild.ageTwoWeightKg + 2.1).toFixed(1)),
        },
        {
          ageMonths: 48,
          heightCm: Number((activeChild.ageTwoHeightCm + 16.0).toFixed(1)),
          weightKg: Number((activeChild.ageTwoWeightKg + 4.0).toFixed(1)),
        },
        {
          ageMonths: 60,
          heightCm: Number((activeChild.ageTwoHeightCm + 23.0).toFixed(1)),
          weightKg: Number((activeChild.ageTwoWeightKg + 6.2).toFixed(1)),
        },
      );
    }

    setIsPlayingTimelapse(true);
    let idx = 0;
    setDraftAgeMonths(frames[0].ageMonths);
    setDraftHeightCm(frames[0].heightCm);
    setDraftWeightKg(frames[0].weightKg);

    timelapseTimerRef.current = window.setInterval(() => {
      idx += 1;
      if (idx >= frames.length) {
        if (timelapseTimerRef.current !== null) {
          window.clearInterval(timelapseTimerRef.current);
          timelapseTimerRef.current = null;
        }
        setIsPlayingTimelapse(false);
        return;
      }
      setDraftAgeMonths(frames[idx].ageMonths);
      setDraftHeightCm(frames[idx].heightCm);
      setDraftWeightKg(frames[idx].weightKg);
    }, 950);
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsDriveAuth(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in was cancelled.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('Could not complete Google sign-in. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setAccessToken(null);
    setNeedsDriveAuth(true);
    pendingChildIdRef.current = null;
    setCloudChildren([]);
    setCloudMeasurementsByChild({});
    setCloudPhotosByChild({});
    selectChildProfile(demoChildrenRef.current[0]?.id ?? DEMO_CHILD.id);
    setStatusBanner(null);
  };

  const handleImportBackupPayload = async (payload: GrowthBackupPayload) => {
    const incomingList = Array.isArray(payload.measurements) ? payload.measurements : [];
    if (user) {
      for (let i = 0; i < incomingList.length; i += 1) {
        const item = incomingList[i];
        const safeAgeMonths = Math.round(
          clampNumber(
            Number(item.ageMonths ?? 24),
            VALIDATION_BOUNDS.AGE_MONTHS_MIN,
            VALIDATION_BOUNDS.AGE_MONTHS_MAX,
          ),
        );
        const safeHeightCm = Number(
          clampNumber(
            Number(item.heightCm ?? activeChild.ageTwoHeightCm),
            VALIDATION_BOUNDS.HEIGHT_CM_MIN,
            VALIDATION_BOUNDS.HEIGHT_CM_MAX,
          ).toFixed(1),
        );
        const safeWeightKg = Number(
          clampNumber(
            Number(item.weightKg ?? activeChild.ageTwoWeightKg),
            VALIDATION_BOUNDS.WEIGHT_KG_MIN,
            VALIDATION_BOUNDS.WEIGHT_KG_MAX,
          ).toFixed(1),
        );
        const rawDate = String(item.recordedDate ?? '');
        const safeDate = VALIDATION_BOUNDS.DATE_PATTERN.test(rawDate)
          ? rawDate
          : getTodayIsoDate();
        const safeNote = String(item.note ?? '')
          .trim()
          .slice(0, VALIDATION_BOUNDS.NOTE_MAX_LEN);

        const measurementId = sanitizeId(`m_imp_${safeAgeMonths}_${Date.now()}_${i}`);
        const path = `children/${activeChild.id}/measurements/${measurementId}`;
        try {
          await setDoc(
            doc(db, 'children', activeChild.id, 'measurements', measurementId),
            {
              ownerId: user.uid,
              childId: activeChild.id,
              ageMonths: safeAgeMonths,
              heightCm: safeHeightCm,
              weightKg: safeWeightKg,
              recordedDate: safeDate,
              note: safeNote,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    } else {
      const sanitizedEntries: GrowthMeasurement[] = incomingList.map((item, i) => ({
        id: sanitizeId(`demo_imp_${Date.now()}_${i}`),
        ownerId: 'demo_family',
        childId: activeChild.id,
        ageMonths: Math.round(
          clampNumber(
            Number(item.ageMonths ?? 24),
            VALIDATION_BOUNDS.AGE_MONTHS_MIN,
            VALIDATION_BOUNDS.AGE_MONTHS_MAX,
          ),
        ),
        heightCm: Number(
          clampNumber(
            Number(item.heightCm ?? activeChild.ageTwoHeightCm),
            VALIDATION_BOUNDS.HEIGHT_CM_MIN,
            VALIDATION_BOUNDS.HEIGHT_CM_MAX,
          ).toFixed(1),
        ),
        weightKg: Number(
          clampNumber(
            Number(item.weightKg ?? activeChild.ageTwoWeightKg),
            VALIDATION_BOUNDS.WEIGHT_KG_MIN,
            VALIDATION_BOUNDS.WEIGHT_KG_MAX,
          ).toFixed(1),
        ),
        recordedDate: VALIDATION_BOUNDS.DATE_PATTERN.test(String(item.recordedDate ?? ''))
          ? String(item.recordedDate)
          : getTodayIsoDate(),
        note: String(item.note ?? '')
          .trim()
          .slice(0, VALIDATION_BOUNDS.NOTE_MAX_LEN),
      }));
      setDemoMeasurementsMap((prev) => ({
        ...prev,
        [activeChild.id]: sanitizedEntries,
      }));
    }
    showTransientBanner(
      'success',
      `Imported ${incomingList.length} milestone(s) onto ${activeChild.name}’s Growth Wall!`,
    );
  };

  const showTransientBanner = (type: 'success' | 'error', message: string) => {
    setStatusBanner({ type, message });
    window.setTimeout(() => {
      setStatusBanner((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Mark Height & Weight Handler (Blueprint-validated!)
  const handleMarkMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const safeAgeMonths = Math.round(
      clampNumber(
        draftAgeMonths,
        VALIDATION_BOUNDS.AGE_MONTHS_MIN,
        VALIDATION_BOUNDS.AGE_MONTHS_MAX,
      ),
    );
    const safeHeightCm = Number(
      clampNumber(
        draftHeightCm,
        VALIDATION_BOUNDS.HEIGHT_CM_MIN,
        VALIDATION_BOUNDS.HEIGHT_CM_MAX,
      ).toFixed(1),
    );
    const safeWeightKg = Number(
      clampNumber(
        draftWeightKg,
        VALIDATION_BOUNDS.WEIGHT_KG_MIN,
        VALIDATION_BOUNDS.WEIGHT_KG_MAX,
      ).toFixed(1),
    );
    const safeDate = VALIDATION_BOUNDS.DATE_PATTERN.test(draftDate)
      ? draftDate
      : getTodayIsoDate();
    const safeNote = draftNote.trim().slice(0, VALIDATION_BOUNDS.NOTE_MAX_LEN);

    try {
      if (user) {
        const targetChildId = activeChild.id;
        const measurementId = sanitizeId(`m_${Date.now()}`);
        const path = `children/${targetChildId}/measurements/${measurementId}`;
        const optimisticM: GrowthMeasurement = {
          id: measurementId,
          ownerId: user.uid,
          childId: targetChildId,
          ageMonths: safeAgeMonths,
          heightCm: safeHeightCm,
          weightKg: safeWeightKg,
          recordedDate: safeDate,
          note: safeNote,
        };
        setCloudMeasurementsByChild((prev) => ({
          ...prev,
          [targetChildId]: [...(prev[targetChildId] ?? []), optimisticM].sort(
            (a, b) => a.ageMonths - b.ageMonths,
          ),
        }));

        try {
          await setDoc(doc(db, 'children', targetChildId, 'measurements', measurementId), {
            ownerId: user.uid,
            childId: targetChildId,
            ageMonths: safeAgeMonths,
            heightCm: safeHeightCm,
            weightKg: safeWeightKg,
            recordedDate: safeDate,
            note: safeNote,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
        setDraftNote('');
        showTransientBanner(
          'success',
          `Marked ${activeChild.name} at ${formatFeetInches(safeHeightCm)} (${formatTotalInches(safeHeightCm)}) & ${formatPounds(safeWeightKg)} on the wall!`,
        );
      } else {
        // Playground session save
        const newEntry: GrowthMeasurement = {
          id: sanitizeId(`demo_m_${Date.now()}`),
          ownerId: 'demo_family',
          childId: activeChild.id,
          ageMonths: safeAgeMonths,
          heightCm: safeHeightCm,
          weightKg: safeWeightKg,
          recordedDate: safeDate,
          note: safeNote,
        };
        setDemoMeasurementsMap((prev) => ({
          ...prev,
          [activeChild.id]: [...(prev[activeChild.id] ?? []), newEntry],
        }));
        setDraftNote('');
        showTransientBanner(
          'success',
          `Marked ${formatFeetInches(safeHeightCm)} (${formatTotalInches(safeHeightCm)}) & ${formatPounds(safeWeightKg)} on ${activeChild.name}’s wall! Sign in to save across devices.`,
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDraftDateChange = (nextDate: string) => {
    setDraftDate(nextDate);
    if (activeChild.birthDate && VALIDATION_BOUNDS.DATE_PATTERN.test(nextDate)) {
      const calc = calculateExactAgeFromDob(activeChild.birthDate, nextDate);
      if (calc) {
        setIsPlayingTimelapse(false);
        setDraftAgeMonths(calc.totalMonths);
      }
    }
  };

  const handleApplyAvatarPhoto = async ({
    croppedDataUrl,
    sampledSkinHex,
  }: {
    croppedDataUrl: string;
    sampledSkinHex: string;
  }) => {
    const safeSkinTone = sanitizeHexColor(
      sampledSkinHex,
      activeChild.skinTone || SKIN_TONE_PRESETS[1].hex,
    );

    setAvatarPhotoMap((prev) => ({
      ...prev,
      [activeChild.id]: croppedDataUrl,
    }));
    await saveLocalAvatarDataUrl(activeChild.id, croppedDataUrl);

    if (user) {
      let uploadedDriveFileId = activeChild.avatarDriveFileId || '';
      if (accessToken) {
        try {
          const rawFileId = await uploadChildAvatarToDrive(
            accessToken,
            activeChild.id,
            activeChild.name,
            croppedDataUrl,
          );
          if (
            rawFileId.length > 0 &&
            rawFileId.length <= VALIDATION_BOUNDS.ID_MAX_LEN &&
            VALIDATION_BOUNDS.ID_PATTERN.test(rawFileId)
          ) {
            uploadedDriveFileId = rawFileId;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('AUTH_REQUIRED')) {
            clearAccessToken();
            setAccessToken(null);
            setNeedsDriveAuth(true);
          }
        }
      }

      const path = `children/${activeChild.id}`;
      try {
        await updateDoc(doc(db, 'children', activeChild.id), {
          skinTone: safeSkinTone,
          accessoryId: 'none',
          avatarDriveFileId: uploadedDriveFileId,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    } else {
      setDemoChildren((prev) =>
        prev.map((c) =>
          c.id === activeChild.id
            ? { ...c, skinTone: safeSkinTone, accessoryId: 'none' }
            : c,
        ),
      );
    }

    showTransientBanner(
      'success',
      `Framed ${activeChild.name}’s real photo onto their growing avatar!`,
    );
  };

  const handleRemoveAvatarPhoto = async () => {
    setAvatarPhotoMap((prev) => {
      const next = { ...prev };
      delete next[activeChild.id];
      return next;
    });
    await removeLocalAvatarDataUrl(activeChild.id);

    if (user) {
      const path = `children/${activeChild.id}`;
      try {
        await updateDoc(doc(db, 'children', activeChild.id), {
          avatarDriveFileId: '',
          skinTone: sanitizeHexColor(activeChild.skinTone, SKIN_TONE_PRESETS[1].hex),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    } else {
      setDemoChildren((prev) =>
        prev.map((c) => (c.id === activeChild.id ? { ...c, avatarDriveFileId: '' } : c)),
      );
    }

    showTransientBanner('success', `Switched ${activeChild.name} to illustrated face.`);
  };

  // Automatically save every camera shot / upload into the child's Saved Photos Album
  const handleSaveCapturedPhoto = async ({
    dataUrl,
    kind,
    caption,
    heightCmOverride,
    existingPhotoId,
  }: {
    dataUrl: string;
    kind: ChildPhotoKind;
    caption: string;
    heightCmOverride?: number;
    existingPhotoId?: string | null;
  }): Promise<string | null> => {
    const targetChild = activeChild;
    const safeCaption = caption.trim().slice(0, VALIDATION_BOUNDS.CAPTION_MAX_LEN);
    const safeAgeMonths = Math.round(
      clampNumber(
        draftAgeMonths,
        VALIDATION_BOUNDS.AGE_MONTHS_MIN,
        VALIDATION_BOUNDS.AGE_MONTHS_MAX,
      ),
    );
    const safeHeightCm = Number(
      clampNumber(
        heightCmOverride ?? (kind === 'wall' ? draftHeightCm : 0),
        0,
        VALIDATION_BOUNDS.HEIGHT_CM_MAX,
      ).toFixed(1),
    );
    const safeWeightKg = Number(
      clampNumber(
        kind === 'wall' ? draftWeightKg : 0,
        0,
        VALIDATION_BOUNDS.WEIGHT_KG_MAX,
      ).toFixed(1),
    );

    // Update existing saved wall photo (e.g. once AI guesstimate / ruler inches complete)
    if (existingPhotoId) {
      await updateLocalPhotoRecord(existingPhotoId, {
        caption: safeCaption,
        heightCm: safeHeightCm,
        weightKg: safeWeightKg,
        ageMonths: safeAgeMonths,
      });
      setLocalPhotosByChild((prev) => ({
        ...prev,
        [targetChild.id]: (prev[targetChild.id] ?? []).map((p) =>
          p.id === existingPhotoId
            ? {
                ...p,
                caption: safeCaption,
                heightCm: safeHeightCm,
                weightKg: safeWeightKg,
                ageMonths: safeAgeMonths,
              }
            : p,
        ),
      }));
      if (user) {
        try {
          await updateDoc(doc(db, 'children', targetChild.id, 'photos', existingPhotoId), {
            caption: safeCaption,
            heightCm: safeHeightCm,
            weightKg: safeWeightKg,
            ageMonths: safeAgeMonths,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Ignore non-fatal metadata enrichment error if offline
        }
      }
      return existingPhotoId;
    }

    const photoId = sanitizeId(`photo_${kind}_${Date.now()}`);
    const capturedDate = getTodayIsoDate();
    const createdAtMs = Date.now();
    const compressedJpeg = await compressPhotoToStorageJpeg(dataUrl, 1200, 0.85);

    const localRecord: SavedLocalPhotoRecord = {
      id: photoId,
      childId: targetChild.id,
      kind,
      dataUrl: compressedJpeg,
      capturedDate,
      ageMonths: safeAgeMonths,
      heightCm: safeHeightCm,
      weightKg: safeWeightKg,
      caption: safeCaption,
      driveFileId: '',
      createdAtMs,
    };

    // Save locally to IndexedDB immediately so the picture is never lost
    await savePhotoToLocalAlbum(localRecord);
    setLocalPhotosByChild((prev) => ({
      ...prev,
      [targetChild.id]: [
        localRecord,
        ...(prev[targetChild.id] ?? []).filter((p) => p.id !== photoId),
      ],
    }));

    // Optionally back up to Google Drive if authorized
    let uploadedDriveFileId = '';
    if (accessToken) {
      try {
        const rawFileId = await uploadChildPhotoToDrive(accessToken, {
          childId: targetChild.id,
          childName: targetChild.name,
          kind,
          capturedDate,
          jpegDataUrl: compressedJpeg,
        });
        if (
          rawFileId.length > 0 &&
          rawFileId.length <= VALIDATION_BOUNDS.ID_MAX_LEN &&
          VALIDATION_BOUNDS.ID_PATTERN.test(rawFileId)
        ) {
          uploadedDriveFileId = rawFileId;
          await updateLocalPhotoRecord(photoId, { driveFileId: uploadedDriveFileId });
          setLocalPhotosByChild((prev) => ({
            ...prev,
            [targetChild.id]: (prev[targetChild.id] ?? []).map((p) =>
              p.id === photoId ? { ...p, driveFileId: uploadedDriveFileId } : p,
            ),
          }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('AUTH_REQUIRED')) {
          clearAccessToken();
          setAccessToken(null);
          setNeedsDriveAuth(true);
        }
      }
    }

    // Store lightweight metadata ONLY (never raw base64!) in Firestore when signed in
    if (user) {
      const photoPath = `children/${targetChild.id}/photos/${photoId}`;
      try {
        await setDoc(doc(db, 'children', targetChild.id, 'photos', photoId), {
          ownerId: user.uid,
          childId: targetChild.id,
          kind,
          capturedDate,
          ageMonths: safeAgeMonths,
          heightCm: safeHeightCm,
          weightKg: safeWeightKg,
          caption: safeCaption,
          driveFileId: uploadedDriveFileId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, photoPath);
      }
    }

    return photoId;
  };

  const handleUseAlbumPhotoAsAvatar = async (photo: ChildPhotoRecord) => {
    if (!photo.localDataUrl) return;
    try {
      const processed = await cropPortraitToDataUrl(photo.localDataUrl, {
        zoom: 1.25,
        offsetX: 0,
        offsetY: 0,
      });
      await handleApplyAvatarPhoto(processed);
    } catch {
      showTransientBanner('error', 'Could not apply this photo to the avatar.');
    }
  };

  const handleBackupPhotoToDrive = async (photo: ChildPhotoRecord) => {
    if (!accessToken || !photo.localDataUrl) return;
    try {
      const rawFileId = await uploadChildPhotoToDrive(accessToken, {
        childId: activeChild.id,
        childName: activeChild.name,
        kind: photo.kind,
        capturedDate: photo.capturedDate,
        jpegDataUrl: photo.localDataUrl,
      });
      if (
        rawFileId.length > 0 &&
        rawFileId.length <= VALIDATION_BOUNDS.ID_MAX_LEN &&
        VALIDATION_BOUNDS.ID_PATTERN.test(rawFileId)
      ) {
        await updateLocalPhotoRecord(photo.id, { driveFileId: rawFileId });
        setLocalPhotosByChild((prev) => ({
          ...prev,
          [activeChild.id]: (prev[activeChild.id] ?? []).map((p) =>
            p.id === photo.id ? { ...p, driveFileId: rawFileId } : p,
          ),
        }));
        if (user) {
          const photoPath = `children/${activeChild.id}/photos/${photo.id}`;
          try {
            await updateDoc(doc(db, 'children', activeChild.id, 'photos', photo.id), {
              driveFileId: rawFileId,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, photoPath);
          }
        }
        showTransientBanner('success', `Backed up ${activeChild.name}’s photo to Google Drive!`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('AUTH_REQUIRED')) {
        clearAccessToken();
        setAccessToken(null);
        setNeedsDriveAuth(true);
        showTransientBanner('error', 'Please reconnect Google Drive to back up this photo.');
      } else {
        showTransientBanner('error', 'Could not back up photo to Google Drive right now.');
      }
    }
  };

  const handleDeleteSavedPhoto = async (photo: ChildPhotoRecord) => {
    await deleteLocalPhoto(photo.id);
    setLocalPhotosByChild((prev) => ({
      ...prev,
      [activeChild.id]: (prev[activeChild.id] ?? []).filter((p) => p.id !== photo.id),
    }));
    if (user) {
      const photoPath = `children/${activeChild.id}/photos/${photo.id}`;
      try {
        await deleteDoc(doc(db, 'children', activeChild.id, 'photos', photo.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, photoPath);
      }
    }
    showTransientBanner('success', `Removed photo from ${activeChild.name}’s album.`);
  };

  const handleApplyWallPhotoEstimate = ({
    inches,
    heightCm,
    sourceLabel,
  }: {
    inches: number;
    heightCm: number;
    sourceLabel: string;
  }) => {
    setIsPlayingTimelapse(false);
    setDraftHeightCm(heightCm);
    setActiveDeckTab('measure');
    showTransientBanner(
      'success',
      `Applied ${formatFeetInches(heightCm)} (${inches.toFixed(1)} in · ${formatMetricHeight(heightCm)}) from ${sourceLabel} — photo saved to ${activeChild.name}’s album!`,
    );
  };

  const handleSaveCharacterProfile = async (updates: {
    name: string;
    birthDate: string;
    sex: BiologicalSex;
    ageTwoHeightCm: number;
    ageTwoWeightKg: number;
    paletteId: PaletteId;
    accessoryId: AccessoryId;
    hairStyle: HairStyle;
    skinTone: string;
    hairColor: string;
  }) => {
    setIsSaving(true);
    const targetChildId = activeChild.id;
    const safeName =
      updates.name.trim().slice(0, VALIDATION_BOUNDS.NAME_MAX_LEN) ||
      activeChild.name ||
      'Sprout';
    const safeBirthDate = VALIDATION_BOUNDS.DATE_PATTERN.test(updates.birthDate)
      ? updates.birthDate
      : '';
    const safeSex = sanitizeBiologicalSex(updates.sex);
    const safeSkinTone = sanitizeHexColor(updates.skinTone, SKIN_TONE_PRESETS[1].hex);
    const safeHairColor = sanitizeHexColor(updates.hairColor, HAIR_COLOR_PRESETS[1].hex);
    const safeAgeTwoHeightCm = clampNumber(
      Number(updates.ageTwoHeightCm.toFixed(1)),
      VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MIN,
      VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MAX,
    );
    const safeAgeTwoWeightKg = clampNumber(
      Number(updates.ageTwoWeightKg.toFixed(1)),
      VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MIN,
      VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MAX,
    );

    try {
      if (user) {
        // Optimistically update active child immediately so UI reflects changes on frame 0
        setCloudChildren((prev) =>
          prev.map((c) =>
            c.id === targetChildId
              ? {
                  ...c,
                  name: safeName,
                  birthDate: safeBirthDate,
                  sex: safeSex,
                  ageTwoHeightCm: safeAgeTwoHeightCm,
                  ageTwoWeightKg: safeAgeTwoWeightKg,
                  paletteId: updates.paletteId,
                  accessoryId: updates.accessoryId,
                  hairStyle: updates.hairStyle,
                  skinTone: safeSkinTone,
                  hairColor: safeHairColor,
                }
              : c,
          ),
        );

        const path = `children/${targetChildId}`;
        try {
          await updateDoc(doc(db, 'children', targetChildId), {
            name: safeName,
            birthDate: safeBirthDate,
            sex: safeSex,
            ageTwoHeightCm: safeAgeTwoHeightCm,
            ageTwoWeightKg: safeAgeTwoWeightKg,
            paletteId: updates.paletteId,
            accessoryId: updates.accessoryId,
            hairStyle: updates.hairStyle,
            skinTone: safeSkinTone,
            hairColor: safeHairColor,
            updatedAt: serverTimestamp(),
          });

          // Keep any explicit 24-month baseline measurement in sync when Age 2 baseline changes
          const existingAge2 = (cloudMeasurementsByChild[targetChildId] ?? []).find(
            (m) => m.ageMonths === 24 && m.id.includes('_24m'),
          );
          if (existingAge2) {
            await updateDoc(
              doc(db, 'children', targetChildId, 'measurements', existingAge2.id),
              {
                heightCm: safeAgeTwoHeightCm,
                weightKg: safeAgeTwoWeightKg,
                updatedAt: serverTimestamp(),
              },
            );
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        setDemoChildren((prev) =>
          prev.map((c) =>
            c.id === targetChildId
              ? {
                  ...c,
                  ...updates,
                  name: safeName,
                  birthDate: safeBirthDate,
                  sex: safeSex,
                  ageTwoHeightCm: safeAgeTwoHeightCm,
                  ageTwoWeightKg: safeAgeTwoWeightKg,
                  skinTone: safeSkinTone,
                  hairColor: safeHairColor,
                }
              : c,
          ),
        );
        setDemoMeasurementsMap((prev) => ({
          ...prev,
          [targetChildId]: (prev[targetChildId] ?? []).map((m) =>
            m.ageMonths === 24 && m.id.includes('_24')
              ? {
                  ...m,
                  heightCm: safeAgeTwoHeightCm,
                  weightKg: safeAgeTwoWeightKg,
                }
              : m,
          ),
        }));
      }

      if (safeBirthDate) {
        const calc = calculateExactAgeFromDob(safeBirthDate, draftDate);
        if (calc) {
          setDraftAgeMonths(calc.totalMonths);
        }
      }
      showTransientBanner('success', `Saved ${safeName}’s info, age & avatar!`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewChild = async (newChild: NewChildCreationPayload) => {
    setIsSaving(true);
    const safeName =
      newChild.name.trim().slice(0, VALIDATION_BOUNDS.NAME_MAX_LEN) || 'Sprout';
    const safeBirthDate = VALIDATION_BOUNDS.DATE_PATTERN.test(newChild.birthDate)
      ? newChild.birthDate
      : '';
    const safeSex = sanitizeBiologicalSex(newChild.sex);
    const safeSkinTone = sanitizeHexColor(newChild.skinTone, SKIN_TONE_PRESETS[1].hex);
    const safeHairColor = sanitizeHexColor(newChild.hairColor, HAIR_COLOR_PRESETS[1].hex);
    const todayIso = getTodayIsoDate();

    const safeAgeTwoHeightCm = clampNumber(
      Number(newChild.ageTwoHeightCm.toFixed(1)),
      VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MIN,
      VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MAX,
    );
    const safeAgeTwoWeightKg = clampNumber(
      Number(newChild.ageTwoWeightKg.toFixed(1)),
      VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MIN,
      VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MAX,
    );
    const safeCurrentHeightCm = clampNumber(
      Number(newChild.currentHeightCm.toFixed(1)),
      VALIDATION_BOUNDS.HEIGHT_CM_MIN,
      VALIDATION_BOUNDS.HEIGHT_CM_MAX,
    );
    const safeCurrentWeightKg = clampNumber(
      Number(newChild.currentWeightKg.toFixed(1)),
      VALIDATION_BOUNDS.WEIGHT_KG_MIN,
      VALIDATION_BOUNDS.WEIGHT_KG_MAX,
    );
    const safeCurrentAgeMonths = clampNumber(
      Math.round(newChild.currentAgeMonths),
      VALIDATION_BOUNDS.AGE_MONTHS_MIN,
      VALIDATION_BOUNDS.AGE_MONTHS_MAX,
    );

    const includeAgeTwoBaselineMark = safeCurrentAgeMonths >= 24;
    const shouldCreateSeparateCurrentMark =
      !includeAgeTwoBaselineMark ||
      safeCurrentAgeMonths !== 24 ||
      Math.abs(safeCurrentHeightCm - safeAgeTwoHeightCm) >= 0.2 ||
      Math.abs(safeCurrentWeightKg - safeAgeTwoWeightKg) >= 0.2;

    try {
      if (user) {
        const childId = sanitizeId(`child_${Date.now()}`);
        const childPath = `children/${childId}`;

        // Upload optional initial avatar photo to Google Drive if authorized
        let uploadedAvatarDriveId = '';
        if (newChild.initialAvatarDataUrl) {
          await saveLocalAvatarDataUrl(childId, newChild.initialAvatarDataUrl);
          setAvatarPhotoMap((prev) => ({
            ...prev,
            [childId]: newChild.initialAvatarDataUrl as string,
          }));
          if (accessToken) {
            try {
              const rawId = await uploadChildAvatarToDrive(
                accessToken,
                childId,
                safeName,
                newChild.initialAvatarDataUrl,
              );
              if (
                rawId.length > 0 &&
                rawId.length <= VALIDATION_BOUNDS.ID_MAX_LEN &&
                VALIDATION_BOUNDS.ID_PATTERN.test(rawId)
              ) {
                uploadedAvatarDriveId = rawId;
              }
            } catch {
              // Keep local avatar if Drive upload unavailable
            }
          }
        }

        const optimisticChild: ChildProfile = {
          id: childId,
          ownerId: user.uid,
          name: safeName,
          birthDate: safeBirthDate,
          sex: safeSex,
          ageTwoHeightCm: safeAgeTwoHeightCm,
          ageTwoWeightKg: safeAgeTwoWeightKg,
          paletteId: newChild.paletteId,
          accessoryId: newChild.accessoryId,
          hairStyle: newChild.hairStyle,
          skinTone: safeSkinTone,
          hairColor: safeHairColor,
          avatarDriveFileId: uploadedAvatarDriveId,
          createdAtMs: Date.now(),
        };

        const baselineMId = sanitizeId(`m_${childId}_24m`);
        const currentMId = sanitizeId(`m_${childId}_cur_${safeCurrentAgeMonths}m`);
        const initialMeasurements: GrowthMeasurement[] = [];

        if (includeAgeTwoBaselineMark) {
          initialMeasurements.push({
            id: baselineMId,
            ownerId: user.uid,
            childId,
            ageMonths: 24,
            heightCm: safeAgeTwoHeightCm,
            weightKg: safeAgeTwoWeightKg,
            recordedDate: todayIso,
            note: 'Age 2 starting height & weight',
          });
        }

        if (shouldCreateSeparateCurrentMark) {
          initialMeasurements.push({
            id: currentMId,
            ownerId: user.uid,
            childId,
            ageMonths: safeCurrentAgeMonths,
            heightCm: safeCurrentHeightCm,
            weightKg: safeCurrentWeightKg,
            recordedDate: todayIso,
            note: `${safeName}’s initial check-in`,
          });
        }

        // Lock pendingChildIdRef and populate isolated child state BEFORE awaiting Firestore!
        pendingChildIdRef.current = childId;
        setCloudChildren((prev) => [...prev.filter((c) => c.id !== childId), optimisticChild]);
        setCloudMeasurementsByChild((prev) => ({
          ...prev,
          [childId]: initialMeasurements,
        }));
        setCloudPhotosByChild((prev) => ({
          ...prev,
          [childId]: [],
        }));
        selectChildProfile(childId);
        setDraftHeightCm(safeCurrentHeightCm);
        setDraftWeightKg(safeCurrentWeightKg);
        setDraftAgeMonths(safeCurrentAgeMonths);
        setDraftDate(todayIso);
        setDraftNote('');

        try {
          await setDoc(doc(db, 'children', childId), {
            ownerId: user.uid,
            name: safeName,
            birthDate: safeBirthDate,
            sex: safeSex,
            ageTwoHeightCm: safeAgeTwoHeightCm,
            ageTwoWeightKg: safeAgeTwoWeightKg,
            paletteId: newChild.paletteId,
            accessoryId: newChild.accessoryId,
            hairStyle: newChild.hairStyle,
            skinTone: safeSkinTone,
            hairColor: safeHairColor,
            avatarDriveFileId: uploadedAvatarDriveId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          if (includeAgeTwoBaselineMark) {
            await setDoc(doc(db, 'children', childId, 'measurements', baselineMId), {
              ownerId: user.uid,
              childId,
              ageMonths: 24,
              heightCm: safeAgeTwoHeightCm,
              weightKg: safeAgeTwoWeightKg,
              recordedDate: todayIso,
              note: 'Age 2 starting height & weight',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          if (shouldCreateSeparateCurrentMark) {
            await setDoc(doc(db, 'children', childId, 'measurements', currentMId), {
              ownerId: user.uid,
              childId,
              ageMonths: safeCurrentAgeMonths,
              heightCm: safeCurrentHeightCm,
              weightKg: safeCurrentWeightKg,
              recordedDate: todayIso,
              note: `${safeName}’s initial check-in`,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          // Also save initial uploaded photo to the new child's Saved Photos Album
          const rawAlbumPhoto = newChild.initialRawPhotoDataUrl || newChild.initialAvatarDataUrl;
          if (rawAlbumPhoto) {
            const photoId = sanitizeId(`photo_avatar_${Date.now()}`);
            const compressed = await compressPhotoToStorageJpeg(rawAlbumPhoto, 1200, 0.85);
            const localPhotoRec: SavedLocalPhotoRecord = {
              id: photoId,
              childId,
              kind: 'avatar',
              dataUrl: compressed,
              capturedDate: todayIso,
              ageMonths: safeCurrentAgeMonths,
              heightCm: safeCurrentHeightCm,
              weightKg: safeCurrentWeightKg,
              caption: `${safeName} portrait photo`,
              driveFileId: uploadedAvatarDriveId,
              createdAtMs: Date.now(),
            };
            await savePhotoToLocalAlbum(localPhotoRec);
            setLocalPhotosByChild((prev) => ({
              ...prev,
              [childId]: [localPhotoRec],
            }));
            await setDoc(doc(db, 'children', childId, 'photos', photoId), {
              ownerId: user.uid,
              childId,
              kind: 'avatar',
              capturedDate: todayIso,
              ageMonths: safeCurrentAgeMonths,
              heightCm: safeCurrentHeightCm,
              weightKg: safeCurrentWeightKg,
              caption: `${safeName} portrait photo`.slice(0, VALIDATION_BOUNDS.CAPTION_MAX_LEN),
              driveFileId: uploadedAvatarDriveId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          pendingChildIdRef.current = null;
          handleFirestoreError(err, OperationType.CREATE, childPath);
        }
      } else {
        const childId = sanitizeId(`demo_child_${Date.now()}`);
        if (newChild.initialAvatarDataUrl) {
          await saveLocalAvatarDataUrl(childId, newChild.initialAvatarDataUrl);
          setAvatarPhotoMap((prev) => ({
            ...prev,
            [childId]: newChild.initialAvatarDataUrl as string,
          }));
        }

        const rawAlbumPhoto = newChild.initialRawPhotoDataUrl || newChild.initialAvatarDataUrl;
        if (rawAlbumPhoto) {
          const photoId = sanitizeId(`photo_avatar_${Date.now()}`);
          const compressed = await compressPhotoToStorageJpeg(rawAlbumPhoto, 1200, 0.85);
          const localPhotoRec: SavedLocalPhotoRecord = {
            id: photoId,
            childId,
            kind: 'avatar',
            dataUrl: compressed,
            capturedDate: todayIso,
            ageMonths: safeCurrentAgeMonths,
            heightCm: safeCurrentHeightCm,
            weightKg: safeCurrentWeightKg,
            caption: `${safeName} portrait photo`,
            driveFileId: '',
            createdAtMs: Date.now(),
          };
          await savePhotoToLocalAlbum(localPhotoRec);
          setLocalPhotosByChild((prev) => ({
            ...prev,
            [childId]: [localPhotoRec],
          }));
        }

        const created: ChildProfile = {
          id: childId,
          ownerId: 'demo_family',
          name: safeName,
          birthDate: safeBirthDate,
          sex: safeSex,
          ageTwoHeightCm: safeAgeTwoHeightCm,
          ageTwoWeightKg: safeAgeTwoWeightKg,
          paletteId: newChild.paletteId,
          accessoryId: newChild.accessoryId,
          hairStyle: newChild.hairStyle,
          skinTone: safeSkinTone,
          hairColor: safeHairColor,
          avatarDriveFileId: '',
          createdAtMs: Date.now(),
        };

        const initialDemoMarks: GrowthMeasurement[] = [];

        if (includeAgeTwoBaselineMark) {
          initialDemoMarks.push({
            id: sanitizeId(`demo_m_${childId}_24`),
            ownerId: 'demo_family',
            childId,
            ageMonths: 24,
            heightCm: safeAgeTwoHeightCm,
            weightKg: safeAgeTwoWeightKg,
            recordedDate: todayIso,
            note: 'Age 2 starting height & weight',
          });
        }

        if (shouldCreateSeparateCurrentMark) {
          initialDemoMarks.push({
            id: sanitizeId(`demo_m_${childId}_cur`),
            ownerId: 'demo_family',
            childId,
            ageMonths: safeCurrentAgeMonths,
            heightCm: safeCurrentHeightCm,
            weightKg: safeCurrentWeightKg,
            recordedDate: todayIso,
            note: `${safeName}’s initial check-in`,
          });
        }

        setDemoChildren((prev) => [...prev, created]);
        setDemoMeasurementsMap((prev) => ({
          ...prev,
          [childId]: initialDemoMarks,
        }));
        selectChildProfile(childId);
        setDraftHeightCm(safeCurrentHeightCm);
        setDraftWeightKg(safeCurrentWeightKg);
        setDraftAgeMonths(safeCurrentAgeMonths);
        setDraftDate(todayIso);
        setDraftNote('');
      }

      setIsAddChildModalOpen(false);
      setActiveDeckTab('measure');
      showTransientBanner('success', `Added ${safeName} and switched to their Growth Wall!`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteChild = async (childIdToDelete: string) => {
    if (activeChildrenList.length <= 1) return;
    const target = activeChildrenList.find((c) => c.id === childIdToDelete);
    const remaining = activeChildrenList.filter((c) => c.id !== childIdToDelete);
    const fallbackChildId = remaining[0]?.id ?? DEMO_CHILD.id;

    setIsSaving(true);
    try {
      await removeLocalAvatarDataUrl(childIdToDelete);
      await deleteAllLocalPhotosForChild(childIdToDelete);
      setAvatarPhotoMap((prev) => {
        const next = { ...prev };
        delete next[childIdToDelete];
        return next;
      });
      setLocalPhotosByChild((prev) => {
        const next = { ...prev };
        delete next[childIdToDelete];
        return next;
      });

      if (user) {
        const childPath = `children/${childIdToDelete}`;
        setCloudChildren(remaining);
        setCloudMeasurementsByChild((prev) => {
          const next = { ...prev };
          delete next[childIdToDelete];
          return next;
        });
        setCloudPhotosByChild((prev) => {
          const next = { ...prev };
          delete next[childIdToDelete];
          return next;
        });

        try {
          const mSnap = await getDocs(
            query(
              collection(db, 'children', childIdToDelete, 'measurements'),
              where('ownerId', '==', user.uid),
            ),
          );
          for (const mDoc of mSnap.docs) {
            await deleteDoc(doc(db, 'children', childIdToDelete, 'measurements', mDoc.id));
          }
          const pSnap = await getDocs(
            query(
              collection(db, 'children', childIdToDelete, 'photos'),
              where('ownerId', '==', user.uid),
            ),
          );
          for (const pDoc of pSnap.docs) {
            await deleteDoc(doc(db, 'children', childIdToDelete, 'photos', pDoc.id));
          }
          await deleteDoc(doc(db, 'children', childIdToDelete));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, childPath);
        }
        pendingChildIdRef.current = fallbackChildId;
        selectChildProfile(fallbackChildId);
      } else {
        setDemoChildren(remaining);
        setDemoMeasurementsMap((prev) => {
          const next = { ...prev };
          delete next[childIdToDelete];
          return next;
        });
        selectChildProfile(fallbackChildId);
      }

      showTransientBanner(
        'success',
        `Removed ${target?.name ?? 'child'}’s profile.`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMeasurement = async (measurementId: string) => {
    if (measurementId === 'synthetic_age_2') return;
    if (user) {
      const targetChildId = activeChild.id;
      setCloudMeasurementsByChild((prev) => ({
        ...prev,
        [targetChildId]: (prev[targetChildId] ?? []).filter((m) => m.id !== measurementId),
      }));
      const path = `children/${targetChildId}/measurements/${measurementId}`;
      try {
        await deleteDoc(doc(db, 'children', targetChildId, 'measurements', measurementId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
      showTransientBanner('success', 'Removed wall measurement.');
    } else {
      setDemoMeasurementsMap((prev) => ({
        ...prev,
        [activeChild.id]: (prev[activeChild.id] ?? []).filter((m) => m.id !== measurementId),
      }));
      showTransientBanner('success', 'Removed playground measurement.');
    }
  };

  const handleInspectMilestone = (m: GrowthMeasurement) => {
    if (isPlayingTimelapse && timelapseTimerRef.current !== null) {
      window.clearInterval(timelapseTimerRef.current);
      timelapseTimerRef.current = null;
      setIsPlayingTimelapse(false);
    }
    setDraftHeightCm(m.heightCm);
    setDraftWeightKg(m.weightKg);
    setDraftAgeMonths(m.ageMonths);
    const stageEl = document.getElementById('measure');
    if (stageEl) {
      stageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const isPreviewDirty =
    Math.abs(draftHeightCm - latestMilestone.heightCm) > 0.05 ||
    Math.abs(draftWeightKg - latestMilestone.weightKg) > 0.05 ||
    draftAgeMonths !== latestMilestone.ageMonths;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-amber-50/80 to-emerald-50/80 text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract (md:sticky keeps mobile sticky budget strictly on bottom tab bar <= 15%) */}
      <header className="md:sticky md:top-0 z-30 bg-white/95 backdrop-blur-xs border-b-2 border-amber-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 py-3">
          {/* Zone 1: Single Wordmark Element */}
          <a
            href="#measure"
            className="text-xl font-bold tracking-tight text-indigo-950 font-display whitespace-nowrap shrink-0"
          >
            SproutScale
          </a>

          {/* Zone 2: 5 Concise Single-Line Navigation Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-700"
          >
            <a
              href="#measure"
              onClick={() => setActiveDeckTab('measure')}
              className="hover:text-sky-700 hover:underline decoration-2 decoration-amber-400 underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Growth Wall
            </a>
            <button
              type="button"
              onClick={() => setIsWallEstimatorOpen(true)}
              className="hover:text-sky-700 hover:underline decoration-2 decoration-amber-400 underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Photo Ruler
            </button>
            <a
              href="#timeline"
              className="hover:text-sky-700 hover:underline decoration-2 decoration-amber-400 underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Milestones
            </a>
            <a
              href="#drive-vault"
              className="hover:text-sky-700 hover:underline decoration-2 decoration-amber-400 underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Google Drive
            </a>
            <button
              type="button"
              onClick={() => setIsMobileAppModalOpen(true)}
              className="hover:text-sky-700 hover:underline decoration-2 decoration-amber-400 underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isInstalled ? 'Share App' : 'Download App'}
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            {!user ? (
              <GoogleSignInButton
                onClick={() => void handleGoogleSignIn()}
                disabled={isLoggingIn}
                compact
              />
            ) : (
              <a
                href="#measure"
                onClick={() => setActiveDeckTab('measure')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Mark Measurement
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container (1440px Desktop Presence via max-w-7xl) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-12">
        {/* Hero Intro & Sibling Switcher Workspace Bar */}
        <section id="measure" className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-indigo-950 [text-wrap:balance]">
                Watch how tall they’ve grown since turning two.
              </h1>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                Enter your child’s date of birth, frame their real photo or camera picture onto
                their lifelike avatar, and mark height and weight beside their 2-year-old self.
              </p>

              {/* Unboxed Child Info & Calculated Age Summary Line */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5 text-xs text-slate-700">
                <span className="font-bold text-indigo-950">{activeChild.name}</span>
                <span aria-hidden="true">·</span>
                {activeChildLiveAge ? (
                  <>
                    <span className="inline-flex items-center gap-1 font-semibold text-sky-900">
                      <Cake className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-hidden="true" />
                      Age {activeChildLiveAge.formattedExactAge}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      Born {formatHumanDate(activeChild.birthDate)}
                    </span>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveDeckTab('character')}
                    className="font-bold text-sky-800 hover:underline cursor-pointer"
                  >
                    Enter Date of Birth to auto-calculate age
                  </button>
                )}
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setIsPhotoModalOpen(true)}
                  className="inline-flex items-center gap-1 font-bold text-sky-800 hover:text-indigo-950 hover:underline cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                  {activeAvatarPhotoUrl ? 'Update Child Photo' : 'Take / Upload Child Photo'}
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setIsWallEstimatorOpen(true)}
                  className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:text-indigo-950 hover:underline cursor-pointer"
                >
                  <Ruler className="w-3.5 h-3.5" aria-hidden="true" />
                  Guesstimate Inches from Wall Photo
                </button>
                <span aria-hidden="true">·</span>
                <a
                  href="#photo-album"
                  className="inline-flex items-center gap-1 font-bold text-indigo-800 hover:text-sky-800 hover:underline whitespace-nowrap"
                >
                  <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  Saved Photos ({activePhotos.length})
                </a>
              </div>
            </div>

            {/* Child Switcher, Mobile App Install/Share & Account Sync Controls */}
            <div className="flex flex-col sm:items-end gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <div
                  role="group"
                  aria-label="Select child profile"
                  className="flex flex-wrap items-center gap-1.5 p-1 bg-sky-200/80 rounded-lg border border-sky-300/70"
                >
                  {activeChildrenList.map((kid) => {
                    const isSelected = kid.id === activeChild.id;
                    const kidThumb = avatarPhotoMap[kid.id] ?? null;
                    const kidAgeShort = kid.birthDate
                      ? calculateExactAgeFromDob(kid.birthDate)?.formattedShortAge
                      : null;
                    const accentHex =
                      CHARACTER_PALETTES[kid.paletteId]?.accentHex ?? '#0284c7';

                    return (
                      <button
                        key={kid.id}
                        type="button"
                        onClick={() => {
                          if (isPlayingTimelapse && timelapseTimerRef.current !== null) {
                            window.clearInterval(timelapseTimerRef.current);
                            timelapseTimerRef.current = null;
                            setIsPlayingTimelapse(false);
                          }
                          pendingChildIdRef.current = null;
                          setDraftNote('');
                          selectChildProfile(kid.id);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 shadow-xs'
                            : 'text-indigo-950/85 hover:text-indigo-950 hover:bg-white/70'
                        }`}
                      >
                        {kidThumb ? (
                          <img
                            src={kidThumb}
                            alt=""
                            aria-hidden="true"
                            className="w-4 h-4 rounded-full object-cover border border-white/80 shrink-0"
                          />
                        ) : (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            aria-hidden="true"
                            className="shrink-0"
                          >
                            <circle cx="5" cy="5" r="4.5" fill={accentHex} />
                          </svg>
                        )}
                        <span>{kid.name}</span>
                        {kidAgeShort && (
                          <span className="font-mono tabular-nums text-[10px] opacity-75">
                            · {kidAgeShort}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setIsAddChildModalOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    Add Child
                  </button>
                </div>

                <PWAInstallActionStrip
                  isInstallable={isInstallable}
                  isInstalled={isInstalled}
                  isIOS={isIOS}
                  onDirectInstall={install}
                  onOpenDownloadModal={() => setIsMobileAppModalOpen(true)}
                />
              </div>

              {user ? (
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <span>Saved to {user.displayName?.split(' ')[0] ?? 'Family'}</span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 font-bold text-indigo-950 hover:text-sky-700 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-700">
                  <span>Interactive Playground</span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="font-bold text-sky-800 hover:text-indigo-950 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Sign in with Google to keep records
                  </button>
                </div>
              )}
            </div>
          </div>

          {authError && (
            <div
              role="alert"
              className="px-4 py-3 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-xl"
            >
              {authError}
            </div>
          )}

          {isLoadingCloud ? (
            <div className="bg-white border-2 border-sky-200 rounded-2xl p-12 text-center shadow-xs">
              <p className="text-sm font-semibold text-indigo-950">
                Loading your family’s growth wall...
              </p>
            </div>
          ) : (
            /* Two-Zone Educational & Interactive Sandbox Layout (65% Stage / 35% Control Deck) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-8 flex flex-col">
                <GrowthWallStage
                  childProfile={activeChild}
                  avatarPhotoUrl={activeAvatarPhotoUrl}
                  measurements={activeMeasurements}
                  activeHeightCm={draftHeightCm}
                  activeWeightKg={draftWeightKg}
                  activeAgeMonths={draftAgeMonths}
                  isPreviewDirty={isPreviewDirty}
                  onSelectMilestoneOnWall={handleInspectMilestone}
                  isPlayingTimelapse={isPlayingTimelapse}
                  onToggleTimelapse={handleToggleTimelapse}
                  onOpenPhotoStudio={() => setIsPhotoModalOpen(true)}
                  onOpenWallHeightEstimator={() => setIsWallEstimatorOpen(true)}
                />
              </div>

              <div id="control-deck-panel" className="lg:col-span-4 flex flex-col">
                <MeasurementControlDeck
                  activeTab={activeDeckTab}
                  onTabChange={setActiveDeckTab}
                  childProfile={activeChild}
                  avatarPhotoUrl={activeAvatarPhotoUrl}
                  draftHeightCm={draftHeightCm}
                  draftWeightKg={draftWeightKg}
                  draftAgeMonths={draftAgeMonths}
                  draftDate={draftDate}
                  draftNote={draftNote}
                  isPreviewDirty={isPreviewDirty}
                  isSaving={isSaving}
                  statusBanner={statusBanner}
                  onChangeDraftHeight={(cm) => {
                    setIsPlayingTimelapse(false);
                    setDraftHeightCm(cm);
                  }}
                  onChangeDraftWeight={(kg) => {
                    setIsPlayingTimelapse(false);
                    setDraftWeightKg(kg);
                  }}
                  onChangeDraftAgeMonths={(mos) => {
                    setIsPlayingTimelapse(false);
                    setDraftAgeMonths(mos);
                  }}
                  onChangeDraftDate={handleDraftDateChange}
                  onChangeDraftNote={setDraftNote}
                  onResetDraft={() => {
                    setDraftHeightCm(latestMilestone.heightCm);
                    setDraftWeightKg(latestMilestone.weightKg);
                    setDraftAgeMonths(latestMilestone.ageMonths);
                  }}
                  onSubmitMeasurement={handleMarkMeasurement}
                  onOpenPhotoStudio={() => setIsPhotoModalOpen(true)}
                  onOpenWallHeightEstimator={() => setIsWallEstimatorOpen(true)}
                  onRemoveAvatarPhoto={handleRemoveAvatarPhoto}
                  onSaveCharacterProfile={handleSaveCharacterProfile}
                  onOpenAddChildModal={() => setIsAddChildModalOpen(true)}
                  totalChildrenCount={activeChildrenList.length}
                  onDeleteChild={handleDeleteChild}
                />
              </div>
            </div>
          )}
        </section>

        {/* Section 2: Growth Trajectory Curve & Wall Marks Table */}
        <GrowthTimelineSection
          childProfile={activeChild}
          measurements={activeMeasurements}
          avatarPhotoUrl={activeAvatarPhotoUrl}
          onInspectMilestone={handleInspectMilestone}
          onDeleteMeasurement={handleDeleteMeasurement}
        />

        {/* Section 3: Saved Photos Album (All Camera Portraits & Wall Height Check-In Pictures) */}
        <ChildPhotoAlbumSection
          childProfile={activeChild}
          photos={activePhotos}
          accessToken={accessToken}
          isSignedIn={Boolean(user)}
          onOpenAvatarStudio={() => setIsPhotoModalOpen(true)}
          onOpenWallEstimator={() => setIsWallEstimatorOpen(true)}
          onUseAsAvatar={handleUseAlbumPhotoAsAvatar}
          onBackupToDrive={handleBackupPhotoToDrive}
          onDeletePhoto={handleDeleteSavedPhoto}
          onSignInForDrive={() => void handleGoogleSignIn()}
        />

        {/* Section 4: Google Drive Keepsake Vault & Google Picker */}
        <GoogleDriveVaultSection
          childProfile={activeChild}
          measurements={activeMeasurements}
          accessToken={accessToken}
          needsDriveAuth={needsDriveAuth}
          isSigningIn={isLoggingIn}
          onSignInForDrive={handleGoogleSignIn}
          onRequireReauth={() => {
            clearAccessToken();
            setAccessToken(null);
            setNeedsDriveAuth(true);
          }}
          onImportBackupPayload={handleImportBackupPayload}
        />

        {/* Section 5: Home Measuring Guide */}
        <HowToMeasureSection
          onOpenWallHeightEstimator={() => setIsWallEstimatorOpen(true)}
        />
      </main>

      {/* Clean Quiet Footer (extra bottom padding on mobile for thumb-zone tab bar) */}
      <footer className="border-t-2 border-amber-200 bg-white/95 pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <p className="font-medium text-indigo-950">
            SproutScale — Family Height &amp; Weight Growth Wall
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href="#measure" className="hover:text-sky-700 transition-colors whitespace-nowrap">
              Growth Wall
            </a>
            <a href="#timeline" className="hover:text-sky-700 transition-colors whitespace-nowrap">
              Milestones
            </a>
            <a href="#photo-album" className="hover:text-sky-700 transition-colors whitespace-nowrap">
              Saved Photos
            </a>
            <a href="#drive-vault" className="hover:text-sky-700 transition-colors whitespace-nowrap">
              Google Drive
            </a>
            <a href="#how-to-measure" className="hover:text-sky-700 transition-colors whitespace-nowrap">
              Measuring Tips
            </a>
            <button
              type="button"
              onClick={() => setIsMobileAppModalOpen(true)}
              className="font-semibold text-sky-800 hover:text-indigo-950 transition-colors whitespace-nowrap cursor-pointer"
            >
              {isInstalled ? 'Share App Link' : 'Download Mobile App'}
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile Thumb-Zone Bottom Tab Bar (<768px only, 56px height <= 15% sticky cap) */}
      <nav
        aria-label="Mobile app bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-amber-200 grid grid-cols-5 items-center px-1"
      >
        <button
          type="button"
          onClick={() => {
            setMobileNavActive('wall');
            document.getElementById('measure')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer ${
            mobileNavActive === 'wall' ? 'text-sky-700 font-bold' : 'text-slate-600'
          }`}
        >
          <Smartphone className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] leading-none whitespace-nowrap">Wall</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileNavActive('measure');
            setActiveDeckTab('measure');
            document
              .getElementById('control-deck-panel')
              ?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer ${
            mobileNavActive === 'measure' ? 'text-sky-700 font-bold' : 'text-slate-600'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] leading-none whitespace-nowrap">Measure</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileNavActive('ruler');
            setIsWallEstimatorOpen(true);
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer ${
            mobileNavActive === 'ruler' ? 'text-emerald-700 font-bold' : 'text-slate-600'
          }`}
        >
          <Ruler className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] leading-none whitespace-nowrap">Photo Ruler</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileNavActive('history');
            document.getElementById('timeline')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer ${
            mobileNavActive === 'history' ? 'text-sky-700 font-bold' : 'text-slate-600'
          }`}
        >
          <ChartLine className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] leading-none whitespace-nowrap">History</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileNavActive('app');
            setIsMobileAppModalOpen(true);
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer ${
            mobileNavActive === 'app' ? 'text-amber-700 font-bold' : 'text-slate-600'
          }`}
        >
          <Share2 className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] leading-none whitespace-nowrap">
            {isInstalled ? 'Share App' : 'Get App'}
          </span>
        </button>
      </nav>

      {/* Non-intrusive Offline Connectivity Indicator */}
      <OfflineIndicator />

      {/* Realistic Child Photo Studio Modal (Camera + Device Upload + Google Drive Picker) */}
      <ChildAvatarPhotoModal
        isOpen={isPhotoModalOpen}
        childName={activeChild.name}
        currentAvatarUrl={activeAvatarPhotoUrl}
        paletteId={activeChild.paletteId}
        accessoryId={activeChild.accessoryId}
        hairStyle={activeChild.hairStyle}
        skinTone={activeChild.skinTone || SKIN_TONE_PRESETS[1].hex}
        hairColor={activeChild.hairColor || HAIR_COLOR_PRESETS[1].hex}
        accessToken={accessToken}
        onClose={() => setIsPhotoModalOpen(false)}
        onApplyPhoto={(res) => void handleApplyAvatarPhoto(res)}
        onSaveCapturedPhoto={handleSaveCapturedPhoto}
      />

      {/* Wall Photo Height Guesstimator Modal (AI Vision + Reference Object Inches Ruler) */}
      <WallPhotoHeightEstimatorModal
        isOpen={isWallEstimatorOpen}
        childName={activeChild.name}
        ageMonths={draftAgeMonths}
        accessToken={accessToken}
        onClose={() => setIsWallEstimatorOpen(false)}
        onApplyEstimatedInches={handleApplyWallPhotoEstimate}
        onSaveCapturedPhoto={handleSaveCapturedPhoto}
      />

      {/* Download & Share Mobile App Modal (One-Tap PWA Install + Shareable Link + QR Code) */}
      <MobileAppDownloadModal
        isOpen={isMobileAppModalOpen}
        onClose={() => setIsMobileAppModalOpen(false)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        isAndroid={isAndroid}
        onTriggerInstall={install}
      />

      {/* Dedicated Multi-Child Profile Creator Modal */}
      <AddChildModal
        isOpen={isAddChildModalOpen}
        existingChildren={activeChildrenList}
        isSaving={isSaving}
        onClose={() => setIsAddChildModalOpen(false)}
        onCreateChild={handleCreateNewChild}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SproutScaleWorkspace />
    </ErrorBoundary>
  );
}
