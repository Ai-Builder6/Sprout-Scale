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
  BookOpen,
  Cake,
  Camera,
  Check,
  Gamepad2,
  Image as ImageIcon,
  LogOut,
  Moon,
  Music,
  Pencil,
  Plus,
  Ruler,
  Share2,
  Smartphone,
  Sun,
  X,
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
  DEMO_EVENTS,
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
  MilestoneEventRecord,
  PaletteId,
  sanitizeBiologicalSex,
  sanitizeEventCategory,
  sanitizeHexColor,
  sanitizeId,
  sanitizePhotoKind,
  SKIN_TONE_PRESETS,
  VALIDATION_BOUNDS,
} from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GrowthWallStage } from './components/GrowthWallStage';
import {
  ControlDeckTab,
  MeasurementControlDeck,
} from './components/MeasurementControlDeck';
import {
  GrowthTimelineSection,
  MeasurementEditPayload,
} from './components/GrowthTimelineSection';
import {
  ChildPhotoAlbumSection,
  PhotoDetailsPatch,
  QuickLibraryPhotoItem,
} from './components/ChildPhotoAlbumSection';
import {
  AddPortfolioMemoryModal,
  CreatePortfolioMemoryPayload,
  InitialMemoryModalContext,
} from './components/AddPortfolioMemoryModal';
import {
  SocialShareConnectorModal,
  SocialShareInitialContext,
} from './components/SocialShareConnectorModal';
import { HowToMeasureSection } from './components/HowToMeasureSection';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { GoogleDriveVaultSection } from './components/GoogleDriveVaultSection';
import { WallPhotoHeightEstimatorModal } from './components/WallPhotoHeightEstimatorModal';
import { AddChildModal, NewChildCreationPayload } from './components/AddChildModal';
import {
  BaselineModalMode,
  EditAgeTwoBaselineModal,
  SaveAgeOneSpurtPayload,
} from './components/EditAgeTwoBaselineModal';
import { PhotoCheckInReminderCard } from './components/PhotoCheckInReminderCard';
import {
  MobileAppDownloadModal,
  OfflineIndicator,
  PWAInstallActionStrip,
} from './components/MobileAppDownloadModal';
import { KidsPlayroomPage } from './components/kidsGames/KidsPlayroomPage';
import { StorybookTimePage } from './components/StorybookTimePage';
import { DancePlayhousePage } from './components/DancePlayhousePage';
import {
  DeletionExecutionResult,
  LegalPageId,
  LegalSupportPages,
} from './components/LegalSupportPages';
import { LogoDownloadModal } from './components/LogoDownloadCard';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useThemeMode } from './hooks/useThemeMode';
import {
  clearAllLocalPhotoStorage,
  compressPhotoToStorageJpeg,
  deleteAllLocalPhotosForChild,
  deleteLocalPhoto,
  listLocalPhotosForChild,
  removeLocalAvatarDataUrl,
  SavedLocalPhotoRecord,
  savePhotoToLocalAlbum,
  updateLocalPhotoRecord,
} from './services/avatarPhotoService';
import {
  downloadDriveImageAsDataUrl,
  GrowthBackupPayload,
  uploadChildPhotoToDrive,
} from './services/googleDriveService';
import { useDefaultAppAvatar } from './services/defaultAvatarService';

const GUEST_CHILDREN_STORAGE_KEY = 'sproutscale_guest_children_v1';
const GUEST_MEASUREMENTS_STORAGE_KEY = 'sproutscale_guest_measurements_v1';
const GUEST_EVENTS_STORAGE_KEY = 'sproutscale_guest_events_v1';
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

function loadStoredGuestEvents(): Record<string, MilestoneEventRecord[]> {
  try {
    const raw = window.localStorage.getItem(GUEST_EVENTS_STORAGE_KEY);
    if (!raw) return { [DEMO_CHILD.id]: DEMO_EVENTS };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, MilestoneEventRecord[]>;
    }
  } catch {
    // Ignore storage read errors
  }
  return { [DEMO_CHILD.id]: DEMO_EVENTS };
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

type AppPageView = 'growth_wall' | 'playroom' | 'storybook' | 'playhouse' | LegalPageId;

function resolveAppViewFromPath(pathname: string): AppPageView {
  const normalized = pathname.replace(/\/+$/, '').toLowerCase();
  if (normalized === '/privacy') return 'privacy';
  if (normalized === '/terms') return 'terms';
  if (normalized === '/support') return 'support';
  if (normalized === '/contact' || normalized === '/contacts') return 'contact';
  if (normalized === '/data-deletion' || normalized === '/delete-data') return 'data-deletion';
  if (normalized === '/games' || normalized === '/playroom') return 'playroom';
  if (normalized === '/storybook' || normalized === '/stories') return 'storybook';
  if (normalized === '/playhouse' || normalized === '/dance') return 'playhouse';
  return 'growth_wall';
}

function getPathForAppView(view: AppPageView): string {
  switch (view) {
    case 'privacy':
      return '/privacy';
    case 'terms':
      return '/terms';
    case 'support':
      return '/support';
    case 'contact':
      return '/contact';
    case 'data-deletion':
      return '/data-deletion';
    case 'playroom':
      return '/games';
    case 'storybook':
      return '/storybook';
    case 'playhouse':
      return '/playhouse';
    default:
      return '/';
  }
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
  const [demoEventsMap, setDemoEventsMap] = useState<
    Record<string, MilestoneEventRecord[]>
  >(loadStoredGuestEvents);

  // Cloud Firestore state isolated strictly per childId so sibling data never bleeds across children!
  const [cloudChildren, setCloudChildren] = useState<ChildProfile[]>([]);
  const [cloudMeasurementsByChild, setCloudMeasurementsByChild] = useState<
    Record<string, GrowthMeasurement[]>
  >({});
  const [cloudPhotosByChild, setCloudPhotosByChild] = useState<
    Record<string, ChildPhotoRecord[]>
  >({});
  const [cloudEventsByChild, setCloudEventsByChild] = useState<
    Record<string, MilestoneEventRecord[]>
  >({});
  const [localPhotosByChild, setLocalPhotosByChild] = useState<
    Record<string, SavedLocalPhotoRecord[]>
  >({});
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isSyncingBatchPhotos, setIsSyncingBatchPhotos] = useState(false);

  // Active child, Page View Route & UI controls
  const [appView, setAppView] = useState<AppPageView>(() =>
    typeof window !== 'undefined' ? resolveAppViewFromPath(window.location.pathname) : 'growth_wall',
  );
  const [selectedChildId, setSelectedChildId] = useState<string>(loadStoredSelectedChildId);
  const [activeDeckTab, setActiveDeckTab] = useState<ControlDeckTab>('measure');
  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState<boolean>(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState<boolean>(false);
  const [memoryModalContext, setMemoryModalContext] =
    useState<InitialMemoryModalContext | null>(null);
  const [isSocialShareOpen, setIsSocialShareOpen] = useState<boolean>(false);
  const [socialShareContext, setSocialShareContext] =
    useState<SocialShareInitialContext | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Light / Dark Mode & Quick Inline Child Rename state
  const { isDark, toggleTheme } = useThemeMode();
  const [isRenamingChild, setIsRenamingChild] = useState<boolean>(false);
  const [quickRenameValue, setQuickRenameValue] = useState<string>('');
  const [isSavingRename, setIsSavingRename] = useState<boolean>(false);

  // Refs that prevent Firestore onSnapshot from ever snapping back to the first child
  const selectedChildIdRef = useRef<string>(selectedChildId);
  const pendingChildIdRef = useRef<string | null>(null);
  const demoChildrenRef = useRef<ChildProfile[]>(demoChildren);
  const demoMeasurementsMapRef = useRef<Record<string, GrowthMeasurement[]>>(demoMeasurementsMap);
  const demoEventsMapRef = useRef<Record<string, MilestoneEventRecord[]>>(demoEventsMap);

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

  const openAddMemoryModal = (ctx?: InitialMemoryModalContext) => {
    setMemoryModalContext(ctx ?? null);
    setIsMemoryModalOpen(true);
  };

  const openSocialShareModal = (ctx?: SocialShareInitialContext) => {
    setSocialShareContext(ctx ?? null);
    setIsSocialShareOpen(true);
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

  useEffect(() => {
    demoEventsMapRef.current = demoEventsMap;
    try {
      window.localStorage.setItem(
        GUEST_EVENTS_STORAGE_KEY,
        JSON.stringify(demoEventsMap),
      );
    } catch {
      // Ignore storage write errors
    }
  }, [demoEventsMap]);

  // Live Interactive Measurement Draft (drives the growing character on the wall in real time!)
  const [draftHeightCm, setDraftHeightCm] = useState<number>(116.5);
  const [draftWeightKg, setDraftWeightKg] = useState<number>(21.0);
  const [draftAgeMonths, setDraftAgeMonths] = useState<number>(72);
  const [draftDate, setDraftDate] = useState<string>(getTodayIsoDate());
  const [draftNote, setDraftNote] = useState<string>('');

  // Growth Timelapse Playback state ("Play Growth from Age 2")
  const [isPlayingTimelapse, setIsPlayingTimelapse] = useState<boolean>(false);
  const timelapseTimerRef = useRef<number | null>(null);

  // Illustrated SproutScale kid character & modal state
  const defaultAppAvatar = useDefaultAppAvatar();
  const [isWallEstimatorOpen, setIsWallEstimatorOpen] = useState<boolean>(false);
  const [ageTwoModalMode, setAgeTwoModalMode] = useState<BaselineModalMode | null>(null);
  const [isMobileAppModalOpen, setIsMobileAppModalOpen] = useState<boolean>(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState<boolean>(false);
  const [mobileNavActive, setMobileNavActive] = useState<
    'wall' | 'storybook' | 'playhouse' | 'games' | 'ruler' | 'app'
  >('wall');

  useEffect(() => {
    const handlePopState = () => {
      setAppView(resolveAppViewFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const pushAppPath = (view: AppPageView) => {
    const nextPath = getPathForAppView(view);
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  };

  const navigateToGrowthWall = (sectionId?: string) => {
    setAppView('growth_wall');
    pushAppPath('growth_wall');
    setMobileNavActive('wall');
    if (sectionId) {
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 40);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navigateToPlayroom = () => {
    setAppView('playroom');
    pushAppPath('playroom');
    setMobileNavActive('games');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToStorybook = () => {
    setAppView('storybook');
    pushAppPath('storybook');
    setMobileNavActive('storybook');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToPlayhouse = () => {
    setAppView('playhouse');
    pushAppPath('playhouse');
    setMobileNavActive('playhouse');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToLegalPage = (page: LegalPageId) => {
    setAppView(page);
    pushAppPath(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  const activeEvents: MilestoneEventRecord[] = useMemo(() => {
    if (user) {
      return (cloudEventsByChild[activeChild.id] ?? []).filter(
        (ev) => ev.childId === activeChild.id,
      );
    }
    return demoEventsMap[activeChild.id] ?? [];
  }, [user, cloudEventsByChild, demoEventsMap, activeChild.id]);

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
          eventTitle: cp.eventTitle ?? match?.eventTitle,
          linkedMeasurementId: cp.linkedMeasurementId ?? match?.linkedMeasurementId,
          isFavorite: cp.isFavorite ?? match?.isFavorite ?? false,
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
          kind: sanitizePhotoKind(lp.kind),
          capturedDate: lp.capturedDate,
          ageMonths: lp.ageMonths,
          heightCm: lp.heightCm,
          weightKg: lp.weightKg,
          caption: lp.caption,
          eventTitle: lp.eventTitle,
          linkedMeasurementId: lp.linkedMeasurementId,
          isFavorite: Boolean(lp.isFavorite),
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

  // Proactively remove any legacy cached local photo avatars so the SproutScale kid character is always shown
  useEffect(() => {
    for (const kid of activeChildrenList) {
      void removeLocalAvatarDataUrl(kid.id);
    }
  }, [activeChildrenList]);

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

            const localEvs = demoEventsMapRef.current[kid.id] ?? [];
            for (let evIdx = 0; evIdx < localEvs.length; evIdx += 1) {
              const ev = localEvs[evIdx];
              const evId = sanitizeId(`evt_${childId}_${evIdx}_${ev.ageMonths}m`);
              const safeTitle =
                String(ev.title ?? '')
                  .trim()
                  .slice(0, VALIDATION_BOUNDS.EVENT_TITLE_MAX_LEN) || 'Milestone Memory';
              await setDoc(doc(db, 'children', childId, 'events', evId), {
                ownerId: currentUser.uid,
                childId,
                title: safeTitle,
                category: sanitizeEventCategory(ev.category),
                eventDate: VALIDATION_BOUNDS.DATE_PATTERN.test(ev.eventDate)
                  ? ev.eventDate
                  : getTodayIsoDate(),
                ageMonths: Math.round(
                  clampNumber(
                    ev.ageMonths,
                    VALIDATION_BOUNDS.AGE_MONTHS_MIN,
                    VALIDATION_BOUNDS.AGE_MONTHS_MAX,
                  ),
                ),
                story: String(ev.story ?? '').slice(0, VALIDATION_BOUNDS.EVENT_STORY_MAX_LEN),
                heightCm: Number(
                  clampNumber(ev.heightCm ?? 0, 0, VALIDATION_BOUNDS.HEIGHT_CM_MAX).toFixed(1),
                ),
                weightKg: Number(
                  clampNumber(ev.weightKg ?? 0, 0, VALIDATION_BOUNDS.WEIGHT_KG_MAX).toFixed(1),
                ),
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
          const rawEventTitle = typeof d.eventTitle === 'string' ? d.eventTitle : '';
          const rawLinkedMId =
            typeof d.linkedMeasurementId === 'string' ? d.linkedMeasurementId : '';
          return {
            id: docSnap.id,
            ownerId: String(d.ownerId ?? user.uid),
            childId: String(d.childId ?? targetChildId),
            kind: sanitizePhotoKind(d.kind),
            capturedDate: String(d.capturedDate ?? getTodayIsoDate()),
            ageMonths: Number(d.ageMonths ?? 24),
            heightCm: Number(d.heightCm ?? 0),
            weightKg: Number(d.weightKg ?? 0),
            caption: String(d.caption ?? ''),
            eventTitle: rawEventTitle || undefined,
            linkedMeasurementId: rawLinkedMId || undefined,
            isFavorite: typeof d.isFavorite === 'boolean' ? d.isFavorite : false,
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

  // 6. Attach real-time onSnapshot listener for active child's Milestone Events in Firestore
  useEffect(() => {
    if (!isAuthReady || !user || !activeChild?.id || cloudChildren.length === 0) {
      return;
    }
    const targetChildId = activeChild.id;
    if (!cloudChildren.some((c) => c.id === targetChildId)) {
      return;
    }

    const eventsPath = `children/${targetChildId}/events`;
    const q = query(
      collection(db, 'children', targetChildId, 'events'),
      where('ownerId', '==', user.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: MilestoneEventRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const createdAtField = d.createdAt as { toMillis?: () => number } | undefined;
          const createdAtMs =
            createdAtField && typeof createdAtField.toMillis === 'function'
              ? createdAtField.toMillis()
              : Date.now();
          const rawLinkedMId =
            typeof d.linkedMeasurementId === 'string' ? d.linkedMeasurementId : '';
          const rawLinkedPhotoId =
            typeof d.linkedPhotoId === 'string' ? d.linkedPhotoId : '';
          return {
            id: docSnap.id,
            ownerId: String(d.ownerId ?? user.uid),
            childId: String(d.childId ?? targetChildId),
            title: String(d.title ?? 'Milestone Event'),
            category: sanitizeEventCategory(d.category),
            eventDate: String(d.eventDate ?? getTodayIsoDate()),
            ageMonths: Number(d.ageMonths ?? 24),
            story: String(d.story ?? ''),
            heightCm: Number(d.heightCm ?? 0),
            weightKg: Number(d.weightKg ?? 0),
            linkedMeasurementId: rawLinkedMId || undefined,
            linkedPhotoId: rawLinkedPhotoId || undefined,
            createdAtMs,
          };
        });
        loaded.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
        setCloudEventsByChild((prev) => ({
          ...prev,
          [targetChildId]: loaded,
        }));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, eventsPath);
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, user, activeChild.id, cloudChildren]);

  // 7. Hydrate any cloud-backed Drive photos that aren't yet cached in IndexedDB on this device
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
            eventTitle: cp.eventTitle,
            linkedMeasurementId: cp.linkedMeasurementId,
            isFavorite: cp.isFavorite,
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
    setCloudEventsByChild({});
    selectChildProfile(demoChildrenRef.current[0]?.id ?? DEMO_CHILD.id);
    setStatusBanner(null);
  };

  /**
   * Self-service complete user data deletion for Meta Ads & Privacy compliance.
   * Respects firestore.rules by deleting all subcollection docs BEFORE parent /children/{childId}.
   */
  const handleDeleteAllUserData = async (): Promise<DeletionExecutionResult> => {
    let deletedCloudChildren = 0;
    let deletedCloudDocs = 0;
    const signedOutEmail = user?.email ?? null;

    if (user) {
      const childrenSnap = await getDocs(
        query(collection(db, 'children'), where('ownerId', '==', user.uid)),
      );

      for (const childDoc of childrenSnap.docs) {
        const cid = childDoc.id;

        // 1. Delete subcollection documents first while parent child doc still exists (required by isParentChildOwner)
        for (const subCol of ['measurements', 'photos', 'events'] as const) {
          const subPath = `children/${cid}/${subCol}`;
          try {
            const subSnap = await getDocs(
              query(collection(db, 'children', cid, subCol), where('ownerId', '==', user.uid)),
            );
            for (const subDoc of subSnap.docs) {
              await deleteDoc(doc(db, 'children', cid, subCol, subDoc.id));
              deletedCloudDocs += 1;
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, subPath);
          }
        }

        // 2. Delete parent child profile document
        const childPath = `children/${cid}`;
        try {
          await deleteDoc(doc(db, 'children', cid));
          deletedCloudChildren += 1;
          deletedCloudDocs += 1;
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, childPath);
        }
      }
    }

    // 3. Clear IndexedDB saved photos & portrait caches
    await clearAllLocalPhotoStorage();

    // 4. Clear guest localStorage records & reset in-memory state
    try {
      window.localStorage.removeItem(GUEST_CHILDREN_STORAGE_KEY);
      window.localStorage.removeItem(GUEST_MEASUREMENTS_STORAGE_KEY);
      window.localStorage.removeItem(GUEST_EVENTS_STORAGE_KEY);
      window.localStorage.removeItem(SELECTED_CHILD_STORAGE_KEY);
    } catch {
      // Ignore storage access errors
    }

    setDemoChildren([DEMO_CHILD]);
    setDemoMeasurementsMap({ [DEMO_CHILD.id]: DEMO_MEASUREMENTS });
    setDemoEventsMap({ [DEMO_CHILD.id]: DEMO_EVENTS });
    setLocalPhotosByChild({});

    // 5. Disconnect any active server-side Meta (Facebook/Instagram) OAuth session
    let disconnectedMeta = false;
    try {
      await fetch('/api/meta/disconnect', { method: 'POST', credentials: 'include' });
      disconnectedMeta = true;
    } catch {
      // Best-effort disconnect
    }

    // 6. Sign out Firebase Auth session if signed in
    if (user) {
      await handleSignOut();
    }

    return {
      deletedCloudChildren,
      deletedCloudDocs,
      clearedLocalStorage: true,
      disconnectedMeta,
      signedOutEmail,
    };
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

  // Automatically save every camera shot / upload into the child's Saved Photos Library
  const handleSaveCapturedPhoto = async ({
    dataUrl,
    kind,
    caption,
    heightCmOverride,
    weightKgOverride,
    ageMonthsOverride,
    capturedDateOverride,
    existingPhotoId,
  }: {
    dataUrl: string;
    kind: ChildPhotoKind;
    caption: string;
    heightCmOverride?: number;
    weightKgOverride?: number;
    ageMonthsOverride?: number;
    capturedDateOverride?: string;
    existingPhotoId?: string | null;
  }): Promise<string | null> => {
    const targetChild = activeChild;
    const safeCaption = caption.trim().slice(0, VALIDATION_BOUNDS.CAPTION_MAX_LEN);
    const safeAgeMonths = Math.round(
      clampNumber(
        ageMonthsOverride ?? draftAgeMonths,
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
        weightKgOverride ?? (kind === 'wall' ? draftWeightKg : 0),
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
    const capturedDate =
      capturedDateOverride && VALIDATION_BOUNDS.DATE_PATTERN.test(capturedDateOverride)
        ? capturedDateOverride
        : getTodayIsoDate();
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
      setCloudPhotosByChild((prev) => ({
        ...prev,
        [activeChild.id]: (prev[activeChild.id] ?? []).filter((p) => p.id !== photo.id),
      }));
      const photoPath = `children/${activeChild.id}/photos/${photo.id}`;
      try {
        await deleteDoc(doc(db, 'children', activeChild.id, 'photos', photo.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, photoPath);
      }
    }
    showTransientBanner('success', `Removed photo from ${activeChild.name}’s portfolio.`);
  };

  // Toggle portfolio favorite star on any gallery photo (IndexedDB + Firestore sync)
  const handleToggleFavoritePhoto = async (photo: ChildPhotoRecord) => {
    const targetChildId = activeChild.id;
    const nextFav = !photo.isFavorite;

    await updateLocalPhotoRecord(photo.id, { isFavorite: nextFav });
    setLocalPhotosByChild((prev) => ({
      ...prev,
      [targetChildId]: (prev[targetChildId] ?? []).map((p) =>
        p.id === photo.id ? { ...p, isFavorite: nextFav } : p,
      ),
    }));

    if (user) {
      const existsInCloud = (cloudPhotosByChild[targetChildId] ?? []).some(
        (cp) => cp.id === photo.id,
      );
      setCloudPhotosByChild((prev) => ({
        ...prev,
        [targetChildId]: (prev[targetChildId] ?? []).map((p) =>
          p.id === photo.id ? { ...p, isFavorite: nextFav } : p,
        ),
      }));

      const photoPath = `children/${targetChildId}/photos/${photo.id}`;
      try {
        if (existsInCloud) {
          await updateDoc(doc(db, 'children', targetChildId, 'photos', photo.id), {
            isFavorite: nextFav,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'children', targetChildId, 'photos', photo.id), {
            ownerId: user.uid,
            childId: targetChildId,
            kind: sanitizePhotoKind(photo.kind),
            capturedDate: VALIDATION_BOUNDS.DATE_PATTERN.test(photo.capturedDate)
              ? photo.capturedDate
              : getTodayIsoDate(),
            ageMonths: Math.round(
              clampNumber(
                photo.ageMonths,
                VALIDATION_BOUNDS.AGE_MONTHS_MIN,
                VALIDATION_BOUNDS.AGE_MONTHS_MAX,
              ),
            ),
            heightCm: Number(
              clampNumber(photo.heightCm, 0, VALIDATION_BOUNDS.HEIGHT_CM_MAX).toFixed(1),
            ),
            weightKg: Number(
              clampNumber(photo.weightKg, 0, VALIDATION_BOUNDS.WEIGHT_KG_MAX).toFixed(1),
            ),
            caption: String(photo.caption ?? '').slice(0, VALIDATION_BOUNDS.CAPTION_MAX_LEN),
            eventTitle: String(photo.eventTitle ?? '').slice(
              0,
              VALIDATION_BOUNDS.EVENT_TITLE_MAX_LEN,
            ),
            linkedMeasurementId:
              photo.linkedMeasurementId &&
              VALIDATION_BOUNDS.ID_PATTERN.test(photo.linkedMeasurementId)
                ? photo.linkedMeasurementId.slice(0, VALIDATION_BOUNDS.ID_MAX_LEN)
                : '',
            isFavorite: nextFav,
            driveFileId:
              photo.driveFileId && VALIDATION_BOUNDS.ID_PATTERN.test(photo.driveFileId)
                ? photo.driveFileId.slice(0, VALIDATION_BOUNDS.ID_MAX_LEN)
                : '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, photoPath);
      }
    }
  };

  // Edit gallery photo title, caption, date, or category (synced with DOB age + Firestore)
  const handleUpdatePhotoDetails = async (
    photo: ChildPhotoRecord,
    updates: PhotoDetailsPatch,
  ) => {
    const targetChildId = activeChild.id;
    const safeKind = sanitizePhotoKind(updates.kind);
    const safeDate = VALIDATION_BOUNDS.DATE_PATTERN.test(updates.capturedDate)
      ? updates.capturedDate
      : photo.capturedDate;
    const safeEventTitle = updates.eventTitle
      .trim()
      .slice(0, VALIDATION_BOUNDS.EVENT_TITLE_MAX_LEN);
    const safeCaption = updates.caption
      .trim()
      .slice(0, VALIDATION_BOUNDS.CAPTION_MAX_LEN);

    const recomputedAge =
      activeChild.birthDate && safeDate !== photo.capturedDate
        ? calculateExactAgeFromDob(activeChild.birthDate, safeDate)?.totalMonths ??
          photo.ageMonths
        : photo.ageMonths;
    const safeAgeMonths = Math.round(
      clampNumber(
        recomputedAge,
        VALIDATION_BOUNDS.AGE_MONTHS_MIN,
        VALIDATION_BOUNDS.AGE_MONTHS_MAX,
      ),
    );

    await updateLocalPhotoRecord(photo.id, {
      kind: safeKind,
      capturedDate: safeDate,
      ageMonths: safeAgeMonths,
      eventTitle: safeEventTitle,
      caption: safeCaption,
    });
    setLocalPhotosByChild((prev) => ({
      ...prev,
      [targetChildId]: (prev[targetChildId] ?? []).map((p) =>
        p.id === photo.id
          ? {
              ...p,
              kind: safeKind,
              capturedDate: safeDate,
              ageMonths: safeAgeMonths,
              eventTitle: safeEventTitle,
              caption: safeCaption,
            }
          : p,
      ),
    }));

    if (user) {
      const existsInCloud = (cloudPhotosByChild[targetChildId] ?? []).some(
        (cp) => cp.id === photo.id,
      );
      setCloudPhotosByChild((prev) => ({
        ...prev,
        [targetChildId]: (prev[targetChildId] ?? []).map((p) =>
          p.id === photo.id
            ? {
                ...p,
                kind: safeKind,
                capturedDate: safeDate,
                ageMonths: safeAgeMonths,
                eventTitle: safeEventTitle || undefined,
                caption: safeCaption,
              }
            : p,
        ),
      }));

      const photoPath = `children/${targetChildId}/photos/${photo.id}`;
      try {
        if (existsInCloud) {
          await updateDoc(doc(db, 'children', targetChildId, 'photos', photo.id), {
            kind: safeKind,
            capturedDate: safeDate,
            ageMonths: safeAgeMonths,
            eventTitle: safeEventTitle,
            caption: safeCaption,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'children', targetChildId, 'photos', photo.id), {
            ownerId: user.uid,
            childId: targetChildId,
            kind: safeKind,
            capturedDate: safeDate,
            ageMonths: safeAgeMonths,
            heightCm: Number(
              clampNumber(photo.heightCm, 0, VALIDATION_BOUNDS.HEIGHT_CM_MAX).toFixed(1),
            ),
            weightKg: Number(
              clampNumber(photo.weightKg, 0, VALIDATION_BOUNDS.WEIGHT_KG_MAX).toFixed(1),
            ),
            caption: safeCaption,
            eventTitle: safeEventTitle,
            linkedMeasurementId:
              photo.linkedMeasurementId &&
              VALIDATION_BOUNDS.ID_PATTERN.test(photo.linkedMeasurementId)
                ? photo.linkedMeasurementId.slice(0, VALIDATION_BOUNDS.ID_MAX_LEN)
                : '',
            isFavorite: Boolean(photo.isFavorite),
            driveFileId:
              photo.driveFileId && VALIDATION_BOUNDS.ID_PATTERN.test(photo.driveFileId)
                ? photo.driveFileId.slice(0, VALIDATION_BOUNDS.ID_MAX_LEN)
                : '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, photoPath);
      }
    }

    showTransientBanner('success', `Updated ${activeChild.name}’s portfolio photo details!`);
  };

  // Batch sync all local device photos to Google Drive & Firestore gallery metadata
  const handleSyncAllPhotosToDrive = async () => {
    if (!accessToken) return;
    const unsynced = activePhotos.filter((p) => Boolean(p.localDataUrl) && !p.driveFileId);
    if (unsynced.length === 0) return;

    setIsSyncingBatchPhotos(true);
    const targetChild = activeChild;
    let syncedCount = 0;

    try {
      for (const photo of unsynced) {
        if (!photo.localDataUrl) continue;
        const rawFileId = await uploadChildPhotoToDrive(accessToken, {
          childId: targetChild.id,
          childName: targetChild.name,
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
            [targetChild.id]: (prev[targetChild.id] ?? []).map((p) =>
              p.id === photo.id ? { ...p, driveFileId: rawFileId } : p,
            ),
          }));

          if (user) {
            const existsInCloud = (cloudPhotosByChild[targetChild.id] ?? []).some(
              (cp) => cp.id === photo.id,
            );
            const photoPath = `children/${targetChild.id}/photos/${photo.id}`;
            try {
              if (existsInCloud) {
                await updateDoc(doc(db, 'children', targetChild.id, 'photos', photo.id), {
                  driveFileId: rawFileId,
                  updatedAt: serverTimestamp(),
                });
              } else {
                await setDoc(doc(db, 'children', targetChild.id, 'photos', photo.id), {
                  ownerId: user.uid,
                  childId: targetChild.id,
                  kind: sanitizePhotoKind(photo.kind),
                  capturedDate: VALIDATION_BOUNDS.DATE_PATTERN.test(photo.capturedDate)
                    ? photo.capturedDate
                    : getTodayIsoDate(),
                  ageMonths: Math.round(
                    clampNumber(
                      photo.ageMonths,
                      VALIDATION_BOUNDS.AGE_MONTHS_MIN,
                      VALIDATION_BOUNDS.AGE_MONTHS_MAX,
                    ),
                  ),
                  heightCm: Number(
                    clampNumber(photo.heightCm, 0, VALIDATION_BOUNDS.HEIGHT_CM_MAX).toFixed(1),
                  ),
                  weightKg: Number(
                    clampNumber(photo.weightKg, 0, VALIDATION_BOUNDS.WEIGHT_KG_MAX).toFixed(1),
                  ),
                  caption: String(photo.caption ?? '').slice(
                    0,
                    VALIDATION_BOUNDS.CAPTION_MAX_LEN,
                  ),
                  eventTitle: String(photo.eventTitle ?? '').slice(
                    0,
                    VALIDATION_BOUNDS.EVENT_TITLE_MAX_LEN,
                  ),
                  linkedMeasurementId:
                    photo.linkedMeasurementId &&
                    VALIDATION_BOUNDS.ID_PATTERN.test(photo.linkedMeasurementId)
                      ? photo.linkedMeasurementId.slice(0, VALIDATION_BOUNDS.ID_MAX_LEN)
                      : '',
                  isFavorite: Boolean(photo.isFavorite),
                  driveFileId: rawFileId,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, photoPath);
            }
          }
          syncedCount += 1;
        }
      }

      if (syncedCount > 0) {
        showTransientBanner(
          'success',
          `Synced ${syncedCount} gallery ${syncedCount === 1 ? 'photo' : 'photos'} to Firestore & Google Drive!`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('AUTH_REQUIRED')) {
        clearAccessToken();
        setAccessToken(null);
        setNeedsDriveAuth(true);
        showTransientBanner('error', 'Please reconnect Google Drive to finish cloud photo sync.');
      } else {
        showTransientBanner('error', 'Could not finish syncing all photos to Google Drive.');
      }
    } finally {
      setIsSyncingBatchPhotos(false);
    }
  };

  // Unified Portfolio Composer Handler: Saves multiple gallery photos + milestone event + optional wall mark
  const handleCreatePortfolioMemory = async (payload: CreatePortfolioMemoryPayload) => {
    setIsSaving(true);
    const targetChild = activeChild;

    const safeDate = VALIDATION_BOUNDS.DATE_PATTERN.test(payload.dateIso)
      ? payload.dateIso
      : getTodayIsoDate();
    const safeAgeMonths = Math.round(
      clampNumber(
        payload.ageMonths,
        VALIDATION_BOUNDS.AGE_MONTHS_MIN,
        VALIDATION_BOUNDS.AGE_MONTHS_MAX,
      ),
    );
    const safeKind = sanitizePhotoKind(payload.photoKind);
    const safeCategory = sanitizeEventCategory(payload.eventCategory);
    const safeTitle =
      payload.eventTitle.trim().slice(0, VALIDATION_BOUNDS.EVENT_TITLE_MAX_LEN) ||
      `${targetChild.name}’s Milestone`;
    const safeStory = payload.story
      .trim()
      .slice(0, VALIDATION_BOUNDS.EVENT_STORY_MAX_LEN);
    const safeCaption = payload.story
      .trim()
      .slice(0, VALIDATION_BOUNDS.CAPTION_MAX_LEN);

    const safePhotoHeightCm = payload.includeMeasurements
      ? Number(
          clampNumber(payload.heightCm, 0, VALIDATION_BOUNDS.HEIGHT_CM_MAX).toFixed(1),
        )
      : 0;
    const safePhotoWeightKg = payload.includeMeasurements
      ? Number(
          clampNumber(payload.weightKg, 0, VALIDATION_BOUNDS.WEIGHT_KG_MAX).toFixed(1),
        )
      : 0;

    let effectiveLinkedMId =
      payload.linkedMeasurementId &&
      VALIDATION_BOUNDS.ID_PATTERN.test(payload.linkedMeasurementId)
        ? payload.linkedMeasurementId.slice(0, VALIDATION_BOUNDS.ID_MAX_LEN)
        : '';

    try {
      // 1. Optionally create a synced GrowthMeasurement on the Growth Wall & Trajectory Chart
      if (payload.alsoSaveWallMeasurement && payload.includeMeasurements) {
        const wallH = Number(
          clampNumber(
            payload.heightCm,
            VALIDATION_BOUNDS.HEIGHT_CM_MIN,
            VALIDATION_BOUNDS.HEIGHT_CM_MAX,
          ).toFixed(1),
        );
        const wallW = Number(
          clampNumber(
            payload.weightKg,
            VALIDATION_BOUNDS.WEIGHT_KG_MIN,
            VALIDATION_BOUNDS.WEIGHT_KG_MAX,
          ).toFixed(1),
        );
        const wallNote = (safeStory || safeTitle).slice(0, VALIDATION_BOUNDS.NOTE_MAX_LEN);

        if (user) {
          const newMId = sanitizeId(`m_port_${Date.now()}`);
          effectiveLinkedMId = newMId;
          const mPath = `children/${targetChild.id}/measurements/${newMId}`;
          const optimisticM: GrowthMeasurement = {
            id: newMId,
            ownerId: user.uid,
            childId: targetChild.id,
            ageMonths: safeAgeMonths,
            heightCm: wallH,
            weightKg: wallW,
            recordedDate: safeDate,
            note: wallNote,
          };
          setCloudMeasurementsByChild((prev) => ({
            ...prev,
            [targetChild.id]: [...(prev[targetChild.id] ?? []), optimisticM].sort(
              (a, b) => a.ageMonths - b.ageMonths,
            ),
          }));

          try {
            await setDoc(doc(db, 'children', targetChild.id, 'measurements', newMId), {
              ownerId: user.uid,
              childId: targetChild.id,
              ageMonths: safeAgeMonths,
              heightCm: wallH,
              weightKg: wallW,
              recordedDate: safeDate,
              note: wallNote,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, mPath);
          }
        } else {
          const demoMId = sanitizeId(`demo_m_port_${Date.now()}`);
          effectiveLinkedMId = demoMId;
          const newDemoM: GrowthMeasurement = {
            id: demoMId,
            ownerId: 'demo_family',
            childId: targetChild.id,
            ageMonths: safeAgeMonths,
            heightCm: wallH,
            weightKg: wallW,
            recordedDate: safeDate,
            note: wallNote,
          };
          setDemoMeasurementsMap((prev) => ({
            ...prev,
            [targetChild.id]: [...(prev[targetChild.id] ?? []), newDemoM],
          }));
        }
      }

      // 2. Save all uploaded / captured gallery photos (IndexedDB + Google Drive + Firestore)
      let primarySavedPhotoId = '';
      const newlySavedLocalPhotos: SavedLocalPhotoRecord[] = [];

      for (let i = 0; i < payload.photosDataUrls.length; i += 1) {
        const rawDataUrl = payload.photosDataUrls[i];
        const photoId = sanitizeId(`photo_${safeKind}_${Date.now()}_${i}`);
        if (!primarySavedPhotoId) {
          primarySavedPhotoId = photoId;
        }
        const createdAtMs = Date.now() + i;
        const compressedJpeg = await compressPhotoToStorageJpeg(rawDataUrl, 1200, 0.85);

        let uploadedDriveId = '';
        if (accessToken) {
          try {
            const rawFileId = await uploadChildPhotoToDrive(accessToken, {
              childId: targetChild.id,
              childName: targetChild.name,
              kind: safeKind,
              capturedDate: safeDate,
              jpegDataUrl: compressedJpeg,
            });
            if (
              rawFileId.length > 0 &&
              rawFileId.length <= VALIDATION_BOUNDS.ID_MAX_LEN &&
              VALIDATION_BOUNDS.ID_PATTERN.test(rawFileId)
            ) {
              uploadedDriveId = rawFileId;
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

        const localRec: SavedLocalPhotoRecord = {
          id: photoId,
          childId: targetChild.id,
          kind: safeKind,
          dataUrl: compressedJpeg,
          capturedDate: safeDate,
          ageMonths: safeAgeMonths,
          heightCm: safePhotoHeightCm,
          weightKg: safePhotoWeightKg,
          caption: safeCaption,
          eventTitle: safeTitle,
          linkedMeasurementId: effectiveLinkedMId || undefined,
          isFavorite: Boolean(payload.isFavorite),
          driveFileId: uploadedDriveId,
          createdAtMs,
        };

        await savePhotoToLocalAlbum(localRec);
        newlySavedLocalPhotos.push(localRec);

        if (user) {
          const photoPath = `children/${targetChild.id}/photos/${photoId}`;
          try {
            await setDoc(doc(db, 'children', targetChild.id, 'photos', photoId), {
              ownerId: user.uid,
              childId: targetChild.id,
              kind: safeKind,
              capturedDate: safeDate,
              ageMonths: safeAgeMonths,
              heightCm: safePhotoHeightCm,
              weightKg: safePhotoWeightKg,
              caption: safeCaption,
              eventTitle: safeTitle,
              linkedMeasurementId: effectiveLinkedMId,
              isFavorite: Boolean(payload.isFavorite),
              driveFileId: uploadedDriveId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, photoPath);
          }
        }
      }

      if (newlySavedLocalPhotos.length > 0) {
        setLocalPhotosByChild((prev) => ({
          ...prev,
          [targetChild.id]: [
            ...newlySavedLocalPhotos,
            ...(prev[targetChild.id] ?? []),
          ],
        }));
      }

      // 3. Save MilestoneEventRecord when an event headline or text-only milestone is provided
      if (payload.createEventRecord) {
        if (user) {
          const eventId = sanitizeId(`evt_${Date.now()}`);
          const eventPath = `children/${targetChild.id}/events/${eventId}`;
          const optimisticEv: MilestoneEventRecord = {
            id: eventId,
            ownerId: user.uid,
            childId: targetChild.id,
            title: safeTitle,
            category: safeCategory,
            eventDate: safeDate,
            ageMonths: safeAgeMonths,
            story: safeStory,
            heightCm: safePhotoHeightCm,
            weightKg: safePhotoWeightKg,
            linkedMeasurementId: effectiveLinkedMId || undefined,
            linkedPhotoId: primarySavedPhotoId || undefined,
            createdAtMs: Date.now(),
          };
          setCloudEventsByChild((prev) => ({
            ...prev,
            [targetChild.id]: [optimisticEv, ...(prev[targetChild.id] ?? [])],
          }));

          try {
            await setDoc(doc(db, 'children', targetChild.id, 'events', eventId), {
              ownerId: user.uid,
              childId: targetChild.id,
              title: safeTitle,
              category: safeCategory,
              eventDate: safeDate,
              ageMonths: safeAgeMonths,
              story: safeStory,
              heightCm: safePhotoHeightCm,
              weightKg: safePhotoWeightKg,
              linkedMeasurementId: effectiveLinkedMId,
              linkedPhotoId: primarySavedPhotoId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, eventPath);
          }
        } else {
          const demoEv: MilestoneEventRecord = {
            id: sanitizeId(`demo_evt_${Date.now()}`),
            ownerId: 'demo_family',
            childId: targetChild.id,
            title: safeTitle,
            category: safeCategory,
            eventDate: safeDate,
            ageMonths: safeAgeMonths,
            story: safeStory,
            heightCm: safePhotoHeightCm,
            weightKg: safePhotoWeightKg,
            linkedMeasurementId: effectiveLinkedMId || undefined,
            linkedPhotoId: primarySavedPhotoId || undefined,
            createdAtMs: Date.now(),
          };
          setDemoEventsMap((prev) => ({
            ...prev,
            [targetChild.id]: [demoEv, ...(prev[targetChild.id] ?? [])],
          }));
        }
      }

      setIsMemoryModalOpen(false);
      setMemoryModalContext(null);
      showTransientBanner(
        'success',
        newlySavedLocalPhotos.length > 0
          ? `Saved ${newlySavedLocalPhotos.length} ${newlySavedLocalPhotos.length === 1 ? 'photo' : 'photos'} & "${safeTitle}" to ${targetChild.name}’s portfolio!`
          : `Saved "${safeTitle}" to ${targetChild.name}’s portfolio!`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMilestoneEvent = async (ev: MilestoneEventRecord) => {
    const targetChildId = activeChild.id;
    if (user) {
      setCloudEventsByChild((prev) => ({
        ...prev,
        [targetChildId]: (prev[targetChildId] ?? []).filter((item) => item.id !== ev.id),
      }));
      const eventPath = `children/${targetChildId}/events/${ev.id}`;
      try {
        await deleteDoc(doc(db, 'children', targetChildId, 'events', ev.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, eventPath);
      }
    } else {
      setDemoEventsMap((prev) => ({
        ...prev,
        [targetChildId]: (prev[targetChildId] ?? []).filter((item) => item.id !== ev.id),
      }));
    }
    showTransientBanner('success', `Removed "${ev.title}" from ${activeChild.name}’s portfolio.`);
  };

  const handleApplyWallPhotoEstimate = ({
    inches,
    heightCm,
    sourceLabel,
    savedToAlbum,
  }: {
    inches: number;
    heightCm: number;
    sourceLabel: string;
    savedToAlbum?: boolean;
  }) => {
    setIsPlayingTimelapse(false);
    setDraftHeightCm(heightCm);
    setActiveDeckTab('measure');
    showTransientBanner(
      'success',
      savedToAlbum
        ? `Applied ${formatFeetInches(heightCm)} (${inches.toFixed(1)} in · ${formatMetricHeight(heightCm)}) from ${sourceLabel} and saved photo to ${activeChild.name}’s album!`
        : `Applied ${formatFeetInches(heightCm)} (${inches.toFixed(1)} in · ${formatMetricHeight(heightCm)}) from ${sourceLabel}!`,
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

  const handleSaveAgeOneAndPhotoSpurt = async (payload: SaveAgeOneSpurtPayload) => {
    setIsSaving(true);
    const targetChildId = activeChild.id;

    try {
      // 1. Update estimated Age 2 baseline on the child profile
      await handleSaveCharacterProfile({
        name: activeChild.name,
        birthDate: activeChild.birthDate ?? '',
        sex: activeChild.sex ?? 'unspecified',
        ageTwoHeightCm: payload.ageTwoHeightCm,
        ageTwoWeightKg: payload.ageTwoWeightKg,
        paletteId: activeChild.paletteId,
        accessoryId: activeChild.accessoryId,
        hairStyle: activeChild.hairStyle,
        skinTone: activeChild.skinTone ?? SKIN_TONE_PRESETS[1].hex,
        hairColor: activeChild.hairColor ?? HAIR_COLOR_PRESETS[1].hex,
      });

      // 2. Save Age 1 (12m) baseline & Later Photo milestone into measurements
      const itemsToSave = [
        { suffix: 'age1', m: payload.ageOneMeasurement },
        { suffix: 'spurt', m: payload.laterMeasurement },
      ];
      const nowBase = Date.now();

      for (let i = 0; i < itemsToSave.length; i += 1) {
        const { suffix, m } = itemsToSave[i];
        const safeAgeMonths = Math.round(
          clampNumber(
            m.ageMonths,
            VALIDATION_BOUNDS.AGE_MONTHS_MIN,
            VALIDATION_BOUNDS.AGE_MONTHS_MAX,
          ),
        );
        const safeHeightCm = Number(
          clampNumber(
            m.heightCm,
            VALIDATION_BOUNDS.HEIGHT_CM_MIN,
            VALIDATION_BOUNDS.HEIGHT_CM_MAX,
          ).toFixed(1),
        );
        const safeWeightKg = Number(
          clampNumber(
            m.weightKg,
            VALIDATION_BOUNDS.WEIGHT_KG_MIN,
            VALIDATION_BOUNDS.WEIGHT_KG_MAX,
          ).toFixed(1),
        );
        const safeDate = VALIDATION_BOUNDS.DATE_PATTERN.test(m.recordedDate)
          ? m.recordedDate
          : getTodayIsoDate();
        const safeNote = m.note.trim().slice(0, VALIDATION_BOUNDS.NOTE_MAX_LEN);

        if (user) {
          const measurementId = sanitizeId(`m_${suffix}_${nowBase + i}`);
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
        } else {
          const demoEntry: GrowthMeasurement = {
            id: sanitizeId(`demo_m_${suffix}_${nowBase + i}`),
            ownerId: 'demo_family',
            childId: targetChildId,
            ageMonths: safeAgeMonths,
            heightCm: safeHeightCm,
            weightKg: safeWeightKg,
            recordedDate: safeDate,
            note: safeNote,
          };
          setDemoMeasurementsMap((prev) => ({
            ...prev,
            [targetChildId]: [...(prev[targetChildId] ?? []), demoEntry].sort(
              (a, b) => a.ageMonths - b.ageMonths,
            ),
          }));
        }
      }

      // 3. Optionally save the uploaded later photo to the Photo Album & Drive
      if (payload.photoPayload) {
        await handleSaveCapturedPhoto({
          dataUrl: payload.photoPayload.dataUrl,
          kind: 'milestone',
          caption: payload.photoPayload.caption,
          heightCmOverride: payload.photoPayload.heightCm,
          weightKgOverride: payload.photoPayload.weightKg,
          ageMonthsOverride: payload.photoPayload.ageMonths,
          capturedDateOverride: payload.photoPayload.capturedDate,
        });
      }

      // 4. Point Growth Wall preview to the later photo milestone so the jump is visible right away
      setDraftHeightCm(payload.laterMeasurement.heightCm);
      setDraftWeightKg(payload.laterMeasurement.weightKg);
      setDraftAgeMonths(payload.laterMeasurement.ageMonths);
      setDraftDate(payload.laterMeasurement.recordedDate);

      showTransientBanner(
        'success',
        `Saved Age 1, estimated Age 2 (${formatFeetInches(payload.ageTwoHeightCm)}), and later milestone · ${payload.spurtSummary}`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickImportLibraryPhotos = async (items: QuickLibraryPhotoItem[]) => {
    if (items.length === 0) return;
    setIsSaving(true);
    try {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        await handleSaveCapturedPhoto({
          dataUrl: item.dataUrl,
          kind: 'milestone',
          caption: item.caption,
          ageMonthsOverride: item.ageMonths,
          capturedDateOverride: item.capturedDate,
        });
      }
      showTransientBanner(
        'success',
        `Added ${items.length} ${items.length === 1 ? 'photo' : 'photos'} to ${activeChild.name}’s Photo Library!`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickUploadStorybookDayPhotos = async (files: FileList) => {
    const fileArray = Array.from(files).slice(0, 4);
    if (fileArray.length === 0) return;
    const todayIso = getTodayIsoDate();
    const prepared: QuickLibraryPhotoItem[] = [];
    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) continue;
      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Could not read photo file.'));
        reader.readAsDataURL(file);
      });
      if (!rawDataUrl) continue;
      const dataUrl = await compressPhotoToStorageJpeg(rawDataUrl);
      prepared.push({
        dataUrl,
        caption: `${activeChild.name}’s day (${formatHumanDate(todayIso)})`,
        capturedDate: todayIso,
        ageMonths: draftAgeMonths,
      });
    }
    if (prepared.length > 0) {
      await handleQuickImportLibraryPhotos(prepared);
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
          avatarDriveFileId: '',
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
            avatarDriveFileId: '',
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

          // Save optional first uploaded photo straight to the new child's Photo Library
          const rawAlbumPhoto = newChild.initialRawPhotoDataUrl;
          if (rawAlbumPhoto) {
            const photoId = sanitizeId(`photo_lib_${Date.now()}`);
            const compressed = await compressPhotoToStorageJpeg(rawAlbumPhoto, 1200, 0.85);
            const localPhotoRec: SavedLocalPhotoRecord = {
              id: photoId,
              childId,
              kind: 'milestone',
              dataUrl: compressed,
              capturedDate: todayIso,
              ageMonths: safeCurrentAgeMonths,
              heightCm: safeCurrentHeightCm,
              weightKg: safeCurrentWeightKg,
              caption: `${safeName} first library photo`,
              driveFileId: '',
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
              kind: 'milestone',
              capturedDate: todayIso,
              ageMonths: safeCurrentAgeMonths,
              heightCm: safeCurrentHeightCm,
              weightKg: safeCurrentWeightKg,
              caption: `${safeName} first library photo`.slice(0, VALIDATION_BOUNDS.CAPTION_MAX_LEN),
              driveFileId: '',
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
        const rawAlbumPhoto = newChild.initialRawPhotoDataUrl;
        if (rawAlbumPhoto) {
          const photoId = sanitizeId(`photo_lib_${Date.now()}`);
          const compressed = await compressPhotoToStorageJpeg(rawAlbumPhoto, 1200, 0.85);
          const localPhotoRec: SavedLocalPhotoRecord = {
            id: photoId,
            childId,
            kind: 'milestone',
            dataUrl: compressed,
            capturedDate: todayIso,
            ageMonths: safeCurrentAgeMonths,
            heightCm: safeCurrentHeightCm,
            weightKg: safeCurrentWeightKg,
            caption: `${safeName} first library photo`,
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
        setCloudEventsByChild((prev) => {
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
          const evSnap = await getDocs(
            query(
              collection(db, 'children', childIdToDelete, 'events'),
              where('ownerId', '==', user.uid),
            ),
          );
          for (const evDoc of evSnap.docs) {
            await deleteDoc(doc(db, 'children', childIdToDelete, 'events', evDoc.id));
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
        setDemoEventsMap((prev) => {
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

  const handleUpdateMeasurement = async (
    measurementId: string,
    updates: MeasurementEditPayload,
  ) => {
    if (measurementId === 'synthetic_age_2') return;
    const safeAgeMonths = Math.round(
      clampNumber(
        updates.ageMonths,
        VALIDATION_BOUNDS.AGE_MONTHS_MIN,
        VALIDATION_BOUNDS.AGE_MONTHS_MAX,
      ),
    );
    const safeHeightCm = Number(
      clampNumber(
        updates.heightCm,
        VALIDATION_BOUNDS.HEIGHT_CM_MIN,
        VALIDATION_BOUNDS.HEIGHT_CM_MAX,
      ).toFixed(1),
    );
    const safeWeightKg = Number(
      clampNumber(
        updates.weightKg,
        VALIDATION_BOUNDS.WEIGHT_KG_MIN,
        VALIDATION_BOUNDS.WEIGHT_KG_MAX,
      ).toFixed(1),
    );
    const safeDate = VALIDATION_BOUNDS.DATE_PATTERN.test(updates.recordedDate)
      ? updates.recordedDate
      : getTodayIsoDate();
    const safeNote = updates.note.trim().slice(0, VALIDATION_BOUNDS.NOTE_MAX_LEN);

    const targetChildId = activeChild.id;

    if (user) {
      setCloudMeasurementsByChild((prev) => ({
        ...prev,
        [targetChildId]: (prev[targetChildId] ?? [])
          .map((m) =>
            m.id === measurementId
              ? {
                  ...m,
                  ageMonths: safeAgeMonths,
                  heightCm: safeHeightCm,
                  weightKg: safeWeightKg,
                  recordedDate: safeDate,
                  note: safeNote,
                }
              : m,
          )
          .sort((a, b) => a.ageMonths - b.ageMonths),
      }));

      const path = `children/${targetChildId}/measurements/${measurementId}`;
      try {
        await updateDoc(doc(db, 'children', targetChildId, 'measurements', measurementId), {
          ageMonths: safeAgeMonths,
          heightCm: safeHeightCm,
          weightKg: safeWeightKg,
          recordedDate: safeDate,
          note: safeNote,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
      showTransientBanner(
        'success',
        `Updated ${activeChild.name}’s milestone to ${formatFeetInches(safeHeightCm)} & ${formatPounds(safeWeightKg)}.`,
      );
    } else {
      setDemoMeasurementsMap((prev) => ({
        ...prev,
        [targetChildId]: (prev[targetChildId] ?? [])
          .map((m) =>
            m.id === measurementId
              ? {
                  ...m,
                  ageMonths: safeAgeMonths,
                  heightCm: safeHeightCm,
                  weightKg: safeWeightKg,
                  recordedDate: safeDate,
                  note: safeNote,
                }
              : m,
          )
          .sort((a, b) => a.ageMonths - b.ageMonths),
      }));
      showTransientBanner(
        'success',
        `Updated ${activeChild.name}’s milestone to ${formatFeetInches(safeHeightCm)} & ${formatPounds(safeWeightKg)}.`,
      );
    }
  };

  const handleQuickRenameChild = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickRenameValue.trim().slice(0, VALIDATION_BOUNDS.NAME_MAX_LEN);
    if (!trimmed) return;
    const targetChildId = activeChild.id;
    setIsSavingRename(true);
    try {
      if (user) {
        setCloudChildren((prev) =>
          prev.map((c) => (c.id === targetChildId ? { ...c, name: trimmed } : c)),
        );
        const path = `children/${targetChildId}`;
        try {
          await updateDoc(doc(db, 'children', targetChildId), {
            name: trimmed,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        setDemoChildren((prev) =>
          prev.map((c) => (c.id === targetChildId ? { ...c, name: trimmed } : c)),
        );
      }
      setIsRenamingChild(false);
      showTransientBanner('success', `Renamed child profile to ${trimmed}!`);
    } finally {
      setIsSavingRename(false);
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
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-amber-50/80 to-emerald-50/80 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Strict 3-Zone Top Bar Contract (md:sticky keeps mobile sticky budget strictly on bottom tab bar <= 15%) */}
      <header className="md:sticky md:top-0 z-30 bg-white/95 dark:bg-slate-950/90 backdrop-blur-xs border-b-2 border-amber-300 dark:border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 py-3">
          {/* Zone 1: Single Wordmark Element */}
          <button
            type="button"
            onClick={() => navigateToGrowthWall('measure')}
            className="text-xl font-bold tracking-tight text-indigo-950 dark:text-white font-display whitespace-nowrap shrink-0 cursor-pointer"
          >
            SproutScale
          </button>

          {/* Zone 2: 5 Concise Single-Line Navigation Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            <button
              type="button"
              onClick={() => {
                setActiveDeckTab('measure');
                navigateToGrowthWall('measure');
              }}
              className={`hover:text-sky-700 dark:hover:text-sky-300 hover:underline decoration-2 decoration-amber-400 underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                appView === 'growth_wall' ? 'text-indigo-950 dark:text-white underline' : ''
              }`}
            >
              Growth Wall
            </button>
            <button
              type="button"
              onClick={navigateToStorybook}
              className={`inline-flex items-center gap-1.5 hover:text-amber-700 dark:hover:text-amber-300 hover:underline decoration-2 decoration-amber-400 underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                appView === 'storybook'
                  ? 'text-amber-700 dark:text-amber-300 font-bold underline'
                  : ''
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
              Storybook
            </button>
            <button
              type="button"
              onClick={navigateToPlayhouse}
              className={`inline-flex items-center gap-1.5 hover:text-pink-700 dark:hover:text-pink-300 hover:underline decoration-2 decoration-pink-400 underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                appView === 'playhouse'
                  ? 'text-pink-700 dark:text-pink-300 font-bold underline'
                  : ''
              }`}
            >
              <Music className="w-4 h-4 shrink-0" aria-hidden="true" />
              Playhouse
            </button>
            <button
              type="button"
              onClick={navigateToPlayroom}
              className={`inline-flex items-center gap-1.5 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline decoration-2 decoration-emerald-400 underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                appView === 'playroom'
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold underline'
                  : ''
              }`}
            >
              <Gamepad2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              Kids Games
            </button>
            <button
              type="button"
              onClick={() => setIsWallEstimatorOpen(true)}
              className="hover:text-sky-700 dark:hover:text-sky-300 hover:underline decoration-2 decoration-amber-400 underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Photo Ruler
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
              <button
                type="button"
                onClick={() => {
                  setActiveDeckTab('measure');
                  navigateToGrowthWall('measure');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Mark Measurement
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container (1440px Desktop Presence via max-w-7xl, extra mobile bottom padding for thumb nav) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6 pb-24 md:py-8 space-y-12">
        {appView === 'privacy' ||
        appView === 'terms' ||
        appView === 'support' ||
        appView === 'contact' ||
        appView === 'data-deletion' ? (
          <LegalSupportPages
            page={appView}
            userEmail={user?.email ?? null}
            childrenCount={activeChildrenList.length}
            onNavigatePage={navigateToLegalPage}
            onBackToApp={() => navigateToGrowthWall('measure')}
            onDeleteAllUserData={handleDeleteAllUserData}
          />
        ) : appView === 'playroom' ? (
          <KidsPlayroomPage
            activeChild={activeChild}
            childrenList={activeChildrenList}
            avatarPhotoMap={{}}
            activeChildHeightCm={draftHeightCm}
            onSelectChild={(kidId) => {
              pendingChildIdRef.current = null;
              selectChildProfile(kidId);
            }}
            onBackToGrowthWall={() => navigateToGrowthWall('measure')}
            isDark={isDark}
            onToggleTheme={toggleTheme}
          />
        ) : appView === 'storybook' ? (
          <StorybookTimePage
            activeChild={activeChild}
            childrenList={activeChildrenList}
            activePhotos={activePhotos}
            activeEvents={activeEvents}
            activeMeasurements={activeMeasurements}
            currentHeightCm={draftHeightCm}
            currentWeightKg={draftWeightKg}
            currentAgeMonths={draftAgeMonths}
            onSelectChild={(kidId) => {
              pendingChildIdRef.current = null;
              selectChildProfile(kidId);
            }}
            onBackToGrowthWall={() => navigateToGrowthWall('measure')}
            onQuickUploadDayPhoto={handleQuickUploadStorybookDayPhotos}
            isDark={isDark}
            onToggleTheme={toggleTheme}
          />
        ) : appView === 'playhouse' ? (
          <DancePlayhousePage
            activeChild={activeChild}
            childrenList={activeChildrenList}
            currentAgeMonths={draftAgeMonths}
            onSelectChild={(kidId) => {
              pendingChildIdRef.current = null;
              selectChildProfile(kidId);
            }}
            onBackToGrowthWall={() => navigateToGrowthWall('measure')}
            isDark={isDark}
            onToggleTheme={toggleTheme}
          />
        ) : (
          <>
        {/* Hero Intro & Sibling Switcher Workspace Bar */}
        <section id="measure" className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-indigo-950 dark:text-white [text-wrap:balance]">
                Watch how tall they’ve grown since turning two.
              </h1>
              <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                Enter your child’s date of birth, track height and weight beside their 2-year-old
                SproutScale character, build their Photo Library, and read personalized Daytime
                &amp; Bedtime Storybooks.
              </p>

              {/* Unboxed Child Info, Inline Quick Rename & Calculated Age Summary Line */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-0.5 text-xs text-slate-700 dark:text-slate-300">
                {isRenamingChild ? (
                  <form
                    onSubmit={handleQuickRenameChild}
                    className="inline-flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={quickRenameValue}
                      onChange={(e) => setQuickRenameValue(e.target.value)}
                      maxLength={VALIDATION_BOUNDS.NAME_MAX_LEN}
                      aria-label="Child name"
                      autoFocus
                      className="w-36 px-2 py-0.5 text-xs font-bold rounded-md border border-sky-400 dark:border-sky-500 bg-white dark:bg-slate-800 text-indigo-950 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={isSavingRename || !quickRenameValue.trim()}
                      aria-label="Save new name"
                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" aria-hidden="true" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRenamingChild(false)}
                      aria-label="Cancel rename"
                      className="p-0.5 rounded-md text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </form>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-bold text-indigo-950 dark:text-white">
                      {activeChild.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickRenameValue(activeChild.name);
                        setIsRenamingChild(true);
                      }}
                      title="Rename child"
                      className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" aria-hidden="true" />
                      Rename
                    </button>
                  </span>
                )}
                <span aria-hidden="true">·</span>
                {activeChildLiveAge ? (
                  <>
                    <span className="inline-flex items-center gap-1 font-semibold text-sky-900 dark:text-sky-300">
                      <Cake className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-hidden="true" />
                      Age {activeChildLiveAge.formattedExactAge}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      Born {formatHumanDate(activeChild.birthDate)}
                    </span>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveDeckTab('character')}
                    className="font-bold text-sky-800 dark:text-sky-300 hover:underline cursor-pointer"
                  >
                    Enter Date of Birth to auto-calculate age
                  </button>
                )}
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setIsWallEstimatorOpen(true)}
                  className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-400 hover:text-indigo-950 dark:hover:text-white hover:underline cursor-pointer"
                >
                  <Ruler className="w-3.5 h-3.5" aria-hidden="true" />
                  Photo Height Ruler
                </button>
                <span aria-hidden="true">·</span>
                <a
                  href="#photo-album"
                  className="inline-flex items-center gap-1 font-bold text-indigo-800 dark:text-indigo-300 hover:text-sky-800 dark:hover:text-white hover:underline whitespace-nowrap"
                >
                  <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  Portfolio &amp; Gallery ({activePhotos.length} photos · {activeEvents.length}{' '}
                  {activeEvents.length === 1 ? 'event' : 'events'})
                </a>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => openAddMemoryModal()}
                  className="inline-flex items-center gap-1 font-bold text-amber-800 dark:text-amber-300 hover:text-indigo-950 dark:hover:text-white hover:underline whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add Photos / Event
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => openSocialShareModal()}
                  className="inline-flex items-center gap-1 font-bold text-rose-700 dark:text-rose-400 hover:text-indigo-950 dark:hover:text-white hover:underline whitespace-nowrap cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Share to FB / IG
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={navigateToPlayroom}
                  className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 hover:text-indigo-950 dark:hover:text-white hover:underline whitespace-nowrap cursor-pointer"
                >
                  <Gamepad2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Kids Playroom (Ages 2–8)
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={navigateToStorybook}
                  className="inline-flex items-center gap-1 font-bold text-amber-800 dark:text-amber-300 hover:text-indigo-950 dark:hover:text-white hover:underline whitespace-nowrap cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  Storybook Time (Day &amp; Bedtime)
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={navigateToPlayhouse}
                  className="inline-flex items-center gap-1 font-bold text-pink-700 dark:text-pink-300 hover:text-indigo-950 dark:hover:text-white hover:underline whitespace-nowrap cursor-pointer"
                >
                  <Music className="w-3.5 h-3.5" aria-hidden="true" />
                  Dance Playhouse (Music &amp; Moves)
                </button>
              </div>
            </div>

            {/* Child Switcher, Light/Dark Toggle, Mobile App Install/Share & Account Sync Controls */}
            <div className="flex flex-col sm:items-end gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-sky-300/80 dark:border-slate-700 bg-white/90 dark:bg-slate-900 text-indigo-950 dark:text-amber-300 hover:bg-sky-50 dark:hover:bg-slate-800 shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isDark ? (
                    <>
                      <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                      Dark Mode
                    </>
                  )}
                </button>

                <div
                  role="group"
                  aria-label="Select child profile"
                  className="flex flex-wrap items-center gap-1.5 p-1 bg-sky-200/80 dark:bg-slate-800/90 rounded-lg border border-sky-300/70 dark:border-slate-700"
                >
                  {activeChildrenList.map((kid) => {
                    const isSelected = kid.id === activeChild.id;
                    const kidAgeShort = kid.birthDate
                      ? calculateExactAgeFromDob(kid.birthDate)?.formattedShortAge
                      : null;

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
                          setIsRenamingChild(false);
                          setDraftNote('');
                          selectChildProfile(kid.id);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 shadow-xs'
                            : 'text-indigo-950/85 dark:text-slate-200 hover:text-indigo-950 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700'
                        }`}
                      >
                        <img
                          src={defaultAppAvatar.portraitUrl}
                          alt=""
                          aria-hidden="true"
                          className="w-5 h-5 rounded-full object-cover object-top border border-white/80 bg-sky-50 shrink-0"
                        />
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
                <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <span>Saved to {user.displayName?.split(' ')[0] ?? 'Family'}</span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 font-bold text-indigo-950 dark:text-white hover:text-sky-700 dark:hover:text-sky-300 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  <span>Interactive Playground</span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="font-bold text-sky-800 dark:text-sky-300 hover:text-indigo-950 dark:hover:text-white hover:underline whitespace-nowrap shrink-0 cursor-pointer"
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
              className="px-4 py-3 text-xs font-medium text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl"
            >
              {authError}
            </div>
          )}

          {isLoadingCloud ? (
            <div className="bg-white dark:bg-slate-900 border-2 border-sky-200 dark:border-slate-700 rounded-2xl p-12 text-center shadow-xs">
              <p className="text-sm font-semibold text-indigo-950 dark:text-white">
                Loading your family’s growth wall...
              </p>
            </div>
          ) : (
            /* Two-Zone Educational & Interactive Sandbox Layout (65% Stage / 35% Control Deck) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-8 flex flex-col">
                <GrowthWallStage
                  childProfile={activeChild}
                  avatarPhotoUrl={null}
                  measurements={activeMeasurements}
                  activeHeightCm={draftHeightCm}
                  activeWeightKg={draftWeightKg}
                  activeAgeMonths={draftAgeMonths}
                  isPreviewDirty={isPreviewDirty}
                  onSelectMilestoneOnWall={handleInspectMilestone}
                  isPlayingTimelapse={isPlayingTimelapse}
                  onToggleTimelapse={handleToggleTimelapse}
                  onOpenWallHeightEstimator={() => setIsWallEstimatorOpen(true)}
                  onEditAgeTwoBaseline={() => setAgeTwoModalMode('age2')}
                />
              </div>

              <div id="control-deck-panel" className="lg:col-span-4 flex flex-col">
                <MeasurementControlDeck
                  activeTab={activeDeckTab}
                  onTabChange={setActiveDeckTab}
                  childProfile={activeChild}
                  avatarPhotoUrl={null}
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
                  onOpenWallHeightEstimator={() => setIsWallEstimatorOpen(true)}
                  onSaveCharacterProfile={handleSaveCharacterProfile}
                  onOpenAddChildModal={() => setIsAddChildModalOpen(true)}
                  totalChildrenCount={activeChildrenList.length}
                  onDeleteChild={handleDeleteChild}
                />
              </div>
            </div>
          )}
        </section>

        {/* Photo Check-In Reminder (Every 7 or 14 Days) */}
        <PhotoCheckInReminderCard
          childProfile={activeChild}
          photos={activePhotos}
          measurements={activeMeasurements}
          onTakeOrUploadPhoto={() => openAddMemoryModal()}
        />

        {/* Section 2: Growth Trajectory Curve, Velocity Chart & Wall Marks Table */}
        <GrowthTimelineSection
          childProfile={activeChild}
          measurements={activeMeasurements}
          photos={activePhotos}
          events={activeEvents}
          avatarPhotoUrl={null}
          onInspectMilestone={handleInspectMilestone}
          onUpdateMeasurement={handleUpdateMeasurement}
          onDeleteMeasurement={handleDeleteMeasurement}
          onEditAgeTwoBaseline={() => setAgeTwoModalMode('age2')}
          onOpenAgeOneSpurtEstimator={() => setAgeTwoModalMode('age1_spurt')}
          onAddPhotoForMilestone={(m) =>
            openAddMemoryModal({
              dateIso: m.recordedDate,
              ageMonths: m.ageMonths,
              heightCm: m.heightCm,
              weightKg: m.weightKg,
              linkedMeasurementId: m.id,
              suggestedTitle: m.note,
            })
          }
        />

        {/* Section 3: Child Photo Library & Milestone Storybook (Firestore + Drive Synced) */}
        <ChildPhotoAlbumSection
          childProfile={activeChild}
          photos={activePhotos}
          events={activeEvents}
          measurements={activeMeasurements}
          accessToken={accessToken}
          isSignedIn={Boolean(user)}
          isSyncingBatch={isSyncingBatchPhotos}
          onOpenAddMemoryModal={openAddMemoryModal}
          onQuickImportPhotos={handleQuickImportLibraryPhotos}
          onOpenWallEstimator={() => setIsWallEstimatorOpen(true)}
          onToggleFavoritePhoto={handleToggleFavoritePhoto}
          onUpdatePhotoDetails={handleUpdatePhotoDetails}
          onBackupToDrive={handleBackupPhotoToDrive}
          onSyncAllPhotosToDrive={handleSyncAllPhotosToDrive}
          onDeletePhoto={handleDeleteSavedPhoto}
          onDeleteEvent={handleDeleteMilestoneEvent}
          onInspectMilestone={handleInspectMilestone}
          onOpenSocialShare={openSocialShareModal}
          onSignInForDrive={() => void handleGoogleSignIn()}
        />

        {/* Section 4: Color-Coded Google Drive Keepsake Vault, Google Sheets & Firestore Sync */}
        <GoogleDriveVaultSection
          childProfile={activeChild}
          measurements={activeMeasurements}
          events={activeEvents}
          photos={activePhotos}
          isFirestoreSignedIn={Boolean(user)}
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
          </>
        )}
      </main>

      {/* Clean Quiet Footer (extra bottom padding on mobile for thumb-zone tab bar) */}
      <footer className="border-t-2 border-amber-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-4 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="font-medium text-indigo-950 dark:text-white">
              SproutScale — Family Height &amp; Weight Growth Wall
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-1 font-semibold text-indigo-950 dark:text-amber-300 hover:underline whitespace-nowrap cursor-pointer"
              >
                {isDark ? (
                  <>
                    <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                    Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                    Dark Mode
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigateToGrowthWall('measure')}
                className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors whitespace-nowrap cursor-pointer"
              >
                Growth Wall
              </button>
              <button
                type="button"
                onClick={navigateToPlayroom}
                className="font-semibold text-emerald-700 dark:text-emerald-400 hover:text-indigo-950 dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                Kids Games (Ages 2–8)
              </button>
              <button
                type="button"
                onClick={() => navigateToGrowthWall('timeline')}
                className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors whitespace-nowrap cursor-pointer"
              >
                Milestones
              </button>
              <button
                type="button"
                onClick={() => navigateToGrowthWall('photo-album')}
                className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors whitespace-nowrap cursor-pointer"
              >
                Saved Photos
              </button>
              <button
                type="button"
                onClick={() => navigateToGrowthWall('drive-vault')}
                className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors whitespace-nowrap cursor-pointer"
              >
                Google Drive
              </button>
              <button
                type="button"
                onClick={() => setIsMobileAppModalOpen(true)}
                className="font-semibold text-sky-800 dark:text-sky-300 hover:text-indigo-950 dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                {isInstalled ? 'Share App Link' : 'Download Mobile App'}
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-amber-100 dark:border-slate-800 flex flex-wrap items-center justify-center sm:justify-between gap-x-5 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
              <a
                href="/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToLegalPage('privacy');
                }}
                className="font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white transition-colors whitespace-nowrap"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToLegalPage('terms');
                }}
                className="font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white transition-colors whitespace-nowrap"
              >
                Terms of Service
              </a>
              <a
                href="/support"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToLegalPage('support');
                }}
                className="font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white transition-colors whitespace-nowrap"
              >
                Support
              </a>
              <a
                href="/contact"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToLegalPage('contact');
                }}
                className="font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white transition-colors whitespace-nowrap"
              >
                Contact
              </a>
              <a
                href="/data-deletion"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToLegalPage('data-deletion');
                }}
                className="font-semibold text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 transition-colors whitespace-nowrap"
              >
                Data Deletion
              </a>
              <button
                type="button"
                onClick={() => setIsLogoModalOpen(true)}
                className="font-semibold text-sky-700 dark:text-sky-300 hover:text-indigo-950 dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                Meta &amp; Domain Launch Kit (.ZIP)
              </button>
            </div>
            <span>Parent-controlled family growth keepsake</span>
          </div>
        </div>
      </footer>

      {/* Mobile Thumb-Zone Bottom Tab Bar (<768px only, safe-area aware, 56px core height <= 15% sticky cap) */}
      <nav
        aria-label="Mobile app bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 min-h-[58px] pb-[env(safe-area-inset-bottom)] bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-amber-200 dark:border-slate-800 grid grid-cols-5 items-center px-1"
      >
        <button
          type="button"
          onClick={() => navigateToGrowthWall('measure')}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer ${
            appView === 'growth_wall' && mobileNavActive === 'wall'
              ? 'text-sky-700 dark:text-sky-300 font-bold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Smartphone className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] leading-none whitespace-nowrap">Wall</span>
        </button>

        <button
          type="button"
          onClick={navigateToStorybook}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer ${
            appView === 'storybook'
              ? 'text-amber-700 dark:text-amber-300 font-bold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <BookOpen className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] leading-none whitespace-nowrap">Storybook</span>
        </button>

        <button
          type="button"
          onClick={navigateToPlayhouse}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer ${
            appView === 'playhouse'
              ? 'text-pink-700 dark:text-pink-300 font-bold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Music className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] leading-none whitespace-nowrap">Playhouse</span>
        </button>

        <button
          type="button"
          onClick={navigateToPlayroom}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer ${
            appView === 'playroom'
              ? 'text-emerald-700 dark:text-emerald-400 font-bold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Gamepad2 className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] leading-none whitespace-nowrap">Games</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileNavActive('ruler');
            setIsWallEstimatorOpen(true);
          }}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer ${
            mobileNavActive === 'ruler'
              ? 'text-emerald-700 dark:text-emerald-400 font-bold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Ruler className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] leading-none whitespace-nowrap">Photo Ruler</span>
        </button>
      </nav>

      {/* Non-intrusive Offline Connectivity Indicator */}
      <OfflineIndicator />

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

      {/* Quick At Age 2 Baseline & Age 1 + Later Photo Growth Spurt Guesstimator Modal */}
      <EditAgeTwoBaselineModal
        isOpen={ageTwoModalMode !== null}
        initialMode={ageTwoModalMode ?? 'age2'}
        childProfile={activeChild}
        isSaving={isSaving}
        onClose={() => setAgeTwoModalMode(null)}
        onSaveAgeTwoBaseline={async ({ ageTwoHeightCm, ageTwoWeightKg }) => {
          await handleSaveCharacterProfile({
            name: activeChild.name,
            birthDate: activeChild.birthDate ?? '',
            sex: activeChild.sex ?? 'unspecified',
            ageTwoHeightCm,
            ageTwoWeightKg,
            paletteId: activeChild.paletteId,
            accessoryId: activeChild.accessoryId,
            hairStyle: activeChild.hairStyle,
            skinTone: activeChild.skinTone ?? SKIN_TONE_PRESETS[1].hex,
            hairColor: activeChild.hairColor ?? HAIR_COLOR_PRESETS[1].hex,
          });
        }}
        onSaveAgeOneAndPhotoSpurt={handleSaveAgeOneAndPhotoSpurt}
      />

      {/* Unified Portfolio Photos & Milestone Events Composer Modal */}
      <AddPortfolioMemoryModal
        isOpen={isMemoryModalOpen}
        childProfile={activeChild}
        measurements={activeMeasurements}
        currentDraftHeightCm={draftHeightCm}
        currentDraftWeightKg={draftWeightKg}
        currentDraftAgeMonths={draftAgeMonths}
        accessToken={accessToken}
        isSaving={isSaving}
        initialContext={memoryModalContext}
        onClose={() => {
          setIsMemoryModalOpen(false);
          setMemoryModalContext(null);
        }}
        onSaveMemory={handleCreatePortfolioMemory}
      />

      {/* Facebook & Instagram Story / Post Share Studio & Meta OAuth Connector */}
      <SocialShareConnectorModal
        isOpen={isSocialShareOpen}
        childProfile={activeChild}
        avatarPhotoUrl={null}
        photos={activePhotos}
        events={activeEvents}
        measurements={activeMeasurements}
        initialContext={socialShareContext}
        onClose={() => {
          setIsSocialShareOpen(false);
          setSocialShareContext(null);
        }}
      />

      {/* Downloadable SproutScale Meta & Domain Launch Kit (.ZIP) + Brand Icons Modal */}
      <LogoDownloadModal
        isOpen={isLogoModalOpen}
        onClose={() => setIsLogoModalOpen(false)}
        accessToken={accessToken}
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
