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
import { Cake, Camera, LogOut, Plus } from 'lucide-react';
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
  calculateExactAgeFromDob,
  ChildProfile,
  clampNumber,
  DEMO_CHILD,
  DEMO_MEASUREMENTS,
  formatHumanDate,
  getLocalTodayIso,
  GrowthMeasurement,
  HAIR_COLOR_PRESETS,
  HairStyle,
  PaletteId,
  sanitizeHexColor,
  sanitizeId,
  SKIN_TONE_PRESETS,
  UnitSystem,
  VALIDATION_BOUNDS,
} from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GrowthWallStage } from './components/GrowthWallStage';
import {
  ControlDeckTab,
  MeasurementControlDeck,
} from './components/MeasurementControlDeck';
import { GrowthTimelineSection } from './components/GrowthTimelineSection';
import { HowToMeasureSection } from './components/HowToMeasureSection';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { GoogleDriveVaultSection } from './components/GoogleDriveVaultSection';
import { ChildAvatarPhotoModal } from './components/ChildAvatarPhotoModal';
import {
  getLocalAvatarDataUrl,
  removeLocalAvatarDataUrl,
  saveLocalAvatarDataUrl,
} from './services/avatarPhotoService';
import {
  downloadDriveImageAsDataUrl,
  GrowthBackupPayload,
  uploadChildAvatarToDrive,
} from './services/googleDriveService';

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

  // Guest Playground state (works immediately before sign-in)
  const [demoChildren, setDemoChildren] = useState<ChildProfile[]>([DEMO_CHILD]);
  const [demoMeasurementsMap, setDemoMeasurementsMap] = useState<
    Record<string, GrowthMeasurement[]>
  >({
    [DEMO_CHILD.id]: DEMO_MEASUREMENTS,
  });

  // Cloud Firestore state (when authenticated)
  const [cloudChildren, setCloudChildren] = useState<ChildProfile[]>([]);
  const [cloudMeasurements, setCloudMeasurements] = useState<GrowthMeasurement[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);

  // Active child & UI controls
  const [selectedChildId, setSelectedChildId] = useState<string>(DEMO_CHILD.id);
  const [units, setUnits] = useState<UnitSystem>('imperial');
  const [activeDeckTab, setActiveDeckTab] = useState<ControlDeckTab>('measure');
  const [isSaving, setIsSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Live Interactive Measurement Draft (drives the growing character on the wall in real time!)
  const [draftHeightCm, setDraftHeightCm] = useState<number>(116.5);
  const [draftWeightKg, setDraftWeightKg] = useState<number>(21.0);
  const [draftAgeMonths, setDraftAgeMonths] = useState<number>(72);
  const [draftDate, setDraftDate] = useState<string>(getTodayIsoDate());
  const [draftNote, setDraftNote] = useState<string>('');

  // Growth Timelapse Playback state ("Play Growth from Age 2")
  const [isPlayingTimelapse, setIsPlayingTimelapse] = useState<boolean>(false);
  const timelapseTimerRef = useRef<number | null>(null);

  // Realistic Child Photo Avatar cache & Studio modal state
  const [avatarPhotoMap, setAvatarPhotoMap] = useState<Record<string, string>>({});
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState<boolean>(false);

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
      return cloudMeasurements;
    }
    return demoMeasurementsMap[activeChild.id] ?? [];
  }, [user, cloudMeasurements, demoMeasurementsMap, activeChild.id]);

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
      if (activeChild.birthDate && activeMeasurements.length <= 1) {
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
          const firstChildId = sanitizeId(`child_${currentUser.uid.slice(0, 12)}_1`);
          await setDoc(doc(db, 'children', firstChildId), {
            ownerId: currentUser.uid,
            name: DEMO_CHILD.name,
            birthDate: DEMO_CHILD.birthDate,
            ageTwoHeightCm: DEMO_CHILD.ageTwoHeightCm,
            ageTwoWeightKg: DEMO_CHILD.ageTwoWeightKg,
            paletteId: DEMO_CHILD.paletteId,
            accessoryId: DEMO_CHILD.accessoryId,
            hairStyle: DEMO_CHILD.hairStyle,
            skinTone: DEMO_CHILD.skinTone,
            hairColor: DEMO_CHILD.hairColor,
            avatarDriveFileId: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const baselineMId = sanitizeId(`m_${firstChildId}_24m`);
          await setDoc(doc(db, 'children', firstChildId, 'measurements', baselineMId), {
            ownerId: currentUser.uid,
            childId: firstChildId,
            ageMonths: 24,
            heightCm: DEMO_CHILD.ageTwoHeightCm,
            weightKg: DEMO_CHILD.ageTwoWeightKg,
            recordedDate: getTodayIsoDate(),
            note: 'Age 2 starting height & weight baseline',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setSelectedChildId(firstChildId);
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
        const loaded: ChildProfile[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const rawBirthDate = String(d.birthDate ?? '');
          const rawDriveFileId = String(d.avatarDriveFileId ?? '');
          return {
            id: docSnap.id,
            ownerId: String(d.ownerId ?? user.uid),
            name: String(d.name ?? 'Sprout'),
            birthDate: VALIDATION_BOUNDS.DATE_PATTERN.test(rawBirthDate) ? rawBirthDate : '',
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
          };
        });
        setCloudChildren(loaded);
        if (loaded.length > 0 && !loaded.some((c) => c.id === selectedChildId)) {
          setSelectedChildId(loaded[0].id);
        }
        setIsLoadingCloud(false);
      },
      (error) => {
        setIsLoadingCloud(false);
        handleFirestoreError(error, OperationType.LIST, childrenPath);
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, user, selectedChildId]);

  // 3. Attach real-time onSnapshot listener for active child's GrowthMeasurements
  useEffect(() => {
    if (!isAuthReady || !user || !activeChild?.id || cloudChildren.length === 0) {
      setCloudMeasurements([]);
      return;
    }
    if (!cloudChildren.some((c) => c.id === activeChild.id)) {
      return;
    }

    const measurementsPath = `children/${activeChild.id}/measurements`;
    const q = query(
      collection(db, 'children', activeChild.id, 'measurements'),
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
            childId: String(d.childId ?? activeChild.id),
            ageMonths: Number(d.ageMonths ?? 24),
            heightCm: Number(d.heightCm ?? activeChild.ageTwoHeightCm),
            weightKg: Number(d.weightKg ?? activeChild.ageTwoWeightKg),
            recordedDate: String(d.recordedDate ?? getTodayIsoDate()),
            note: String(d.note ?? ''),
          };
        });
        loaded.sort((a, b) => a.ageMonths - b.ageMonths);
        setCloudMeasurements(loaded);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, measurementsPath);
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, user, activeChild.id, activeChild.ageTwoHeightCm, activeChild.ageTwoWeightKg, cloudChildren]);

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
    setSelectedChildId(DEMO_CHILD.id);
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
        const measurementId = sanitizeId(`m_${Date.now()}`);
        const path = `children/${activeChild.id}/measurements/${measurementId}`;
        try {
          await setDoc(doc(db, 'children', activeChild.id, 'measurements', measurementId), {
            ownerId: user.uid,
            childId: activeChild.id,
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
        showTransientBanner('success', `Marked ${activeChild.name}’s height & weight on the wall!`);
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
          `Marked on ${activeChild.name}’s playground wall! Sign in to save across devices.`,
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

  const handleSaveCharacterProfile = async (updates: {
    name: string;
    birthDate: string;
    ageTwoHeightCm: number;
    ageTwoWeightKg: number;
    paletteId: PaletteId;
    accessoryId: AccessoryId;
    hairStyle: HairStyle;
    skinTone: string;
    hairColor: string;
  }) => {
    setIsSaving(true);
    const safeBirthDate = VALIDATION_BOUNDS.DATE_PATTERN.test(updates.birthDate)
      ? updates.birthDate
      : '';
    const safeSkinTone = sanitizeHexColor(updates.skinTone, SKIN_TONE_PRESETS[1].hex);
    const safeHairColor = sanitizeHexColor(updates.hairColor, HAIR_COLOR_PRESETS[1].hex);

    try {
      if (user) {
        const path = `children/${activeChild.id}`;
        try {
          await updateDoc(doc(db, 'children', activeChild.id), {
            name: updates.name.slice(0, VALIDATION_BOUNDS.NAME_MAX_LEN),
            birthDate: safeBirthDate,
            ageTwoHeightCm: updates.ageTwoHeightCm,
            ageTwoWeightKg: updates.ageTwoWeightKg,
            paletteId: updates.paletteId,
            accessoryId: updates.accessoryId,
            hairStyle: updates.hairStyle,
            skinTone: safeSkinTone,
            hairColor: safeHairColor,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        setDemoChildren((prev) =>
          prev.map((c) =>
            c.id === activeChild.id
              ? {
                  ...c,
                  ...updates,
                  birthDate: safeBirthDate,
                  skinTone: safeSkinTone,
                  hairColor: safeHairColor,
                }
              : c,
          ),
        );
      }

      if (safeBirthDate) {
        const calc = calculateExactAgeFromDob(safeBirthDate, draftDate);
        if (calc) {
          setDraftAgeMonths(calc.totalMonths);
        }
      }
      showTransientBanner('success', `Saved ${updates.name}’s info, age & avatar!`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewChild = async (newChild: {
    name: string;
    birthDate: string;
    ageTwoHeightCm: number;
    ageTwoWeightKg: number;
    paletteId: PaletteId;
    accessoryId: AccessoryId;
    hairStyle: HairStyle;
    skinTone: string;
    hairColor: string;
  }) => {
    setIsSaving(true);
    const safeBirthDate = VALIDATION_BOUNDS.DATE_PATTERN.test(newChild.birthDate)
      ? newChild.birthDate
      : '';
    const safeSkinTone = sanitizeHexColor(newChild.skinTone, SKIN_TONE_PRESETS[1].hex);
    const safeHairColor = sanitizeHexColor(newChild.hairColor, HAIR_COLOR_PRESETS[1].hex);

    try {
      if (user) {
        const childId = sanitizeId(`child_${Date.now()}`);
        const childPath = `children/${childId}`;
        try {
          await setDoc(doc(db, 'children', childId), {
            ownerId: user.uid,
            name: newChild.name.slice(0, VALIDATION_BOUNDS.NAME_MAX_LEN),
            birthDate: safeBirthDate,
            ageTwoHeightCm: newChild.ageTwoHeightCm,
            ageTwoWeightKg: newChild.ageTwoWeightKg,
            paletteId: newChild.paletteId,
            accessoryId: newChild.accessoryId,
            hairStyle: newChild.hairStyle,
            skinTone: safeSkinTone,
            hairColor: safeHairColor,
            avatarDriveFileId: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Create starting Age 2 mark on their wall
          const baselineMId = sanitizeId(`m_${childId}_24m`);
          await setDoc(doc(db, 'children', childId, 'measurements', baselineMId), {
            ownerId: user.uid,
            childId,
            ageMonths: 24,
            heightCm: newChild.ageTwoHeightCm,
            weightKg: newChild.ageTwoWeightKg,
            recordedDate: getTodayIsoDate(),
            note: 'Age 2 starting height & weight',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, childPath);
        }
        setSelectedChildId(childId);
        setActiveDeckTab('measure');
      } else {
        const childId = sanitizeId(`demo_child_${Date.now()}`);
        const created: ChildProfile = {
          id: childId,
          ownerId: 'demo_family',
          ...newChild,
          birthDate: safeBirthDate,
          skinTone: safeSkinTone,
          hairColor: safeHairColor,
          avatarDriveFileId: '',
        };
        setDemoChildren((prev) => [...prev, created]);
        setDemoMeasurementsMap((prev) => ({
          ...prev,
          [childId]: [
            {
              id: sanitizeId(`demo_m_${childId}_24`),
              ownerId: 'demo_family',
              childId,
              ageMonths: 24,
              heightCm: newChild.ageTwoHeightCm,
              weightKg: newChild.ageTwoWeightKg,
              recordedDate: getTodayIsoDate(),
              note: 'Age 2 starting height & weight',
            },
          ],
        }));
        setSelectedChildId(childId);
        setActiveDeckTab('measure');
      }

      if (safeBirthDate) {
        const calc = calculateExactAgeFromDob(safeBirthDate, draftDate);
        if (calc) {
          setDraftAgeMonths(calc.totalMonths);
        }
      }
      showTransientBanner('success', `Added ${newChild.name} starting at Age 2!`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMeasurement = async (measurementId: string) => {
    if (measurementId === 'synthetic_age_2') return;
    if (user) {
      const path = `children/${activeChild.id}/measurements/${measurementId}`;
      try {
        await deleteDoc(doc(db, 'children', activeChild.id, 'measurements', measurementId));
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
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b-2 border-amber-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
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
            <a
              href="#measure"
              onClick={() => setActiveDeckTab('character')}
              className="hover:text-sky-700 hover:underline decoration-2 decoration-amber-400 underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Child Info
            </a>
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
            <a
              href="#how-to-measure"
              onClick={() => setActiveDeckTab('measure')}
              className="hover:text-sky-700 hover:underline decoration-2 decoration-amber-400 underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              How to Measure
            </a>
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
              </div>
            </div>

            {/* Child Switcher & Account Sync Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="group"
                aria-label="Select child profile"
                className="flex items-center gap-1 p-1 bg-sky-200/80 rounded-lg border border-sky-300/70"
              >
                {activeChildrenList.map((kid) => (
                  <button
                    key={kid.id}
                    type="button"
                    onClick={() => setSelectedChildId(kid.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      kid.id === activeChild.id
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'text-indigo-950/80 hover:text-indigo-950 hover:bg-white/60'
                    }`}
                  >
                    {kid.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setActiveDeckTab('character')}
                  className="px-2.5 py-1.5 text-xs font-bold text-sky-800 hover:text-indigo-950 hover:bg-white/60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  + Child
                </button>
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
                  units={units}
                  onUnitsChange={setUnits}
                  onSelectMilestoneOnWall={handleInspectMilestone}
                  isPlayingTimelapse={isPlayingTimelapse}
                  onToggleTimelapse={handleToggleTimelapse}
                  onOpenPhotoStudio={() => setIsPhotoModalOpen(true)}
                />
              </div>

              <div className="lg:col-span-4 flex flex-col">
                <MeasurementControlDeck
                  activeTab={activeDeckTab}
                  onTabChange={setActiveDeckTab}
                  childProfile={activeChild}
                  avatarPhotoUrl={activeAvatarPhotoUrl}
                  units={units}
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
                  onRemoveAvatarPhoto={handleRemoveAvatarPhoto}
                  onSaveCharacterProfile={handleSaveCharacterProfile}
                  onCreateNewChild={handleCreateNewChild}
                />
              </div>
            </div>
          )}
        </section>

        {/* Section 2: Growth Trajectory Curve & Wall Marks Table */}
        <GrowthTimelineSection
          childProfile={activeChild}
          measurements={activeMeasurements}
          units={units}
          onInspectMilestone={handleInspectMilestone}
          onDeleteMeasurement={handleDeleteMeasurement}
        />

        {/* Section 3: Google Drive Keepsake Vault & Google Picker */}
        <GoogleDriveVaultSection
          childProfile={activeChild}
          measurements={activeMeasurements}
          units={units}
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

        {/* Section 4: Home Measuring Guide */}
        <HowToMeasureSection />
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t-2 border-amber-200 bg-white/95">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <p className="font-medium text-indigo-950">
            SproutScale — Family Height &amp; Weight Growth Wall
          </p>
          <div className="flex items-center gap-4">
            <a href="#measure" className="hover:text-sky-700 transition-colors whitespace-nowrap">
              Growth Wall
            </a>
            <a href="#timeline" className="hover:text-sky-700 transition-colors whitespace-nowrap">
              Milestones
            </a>
            <a href="#drive-vault" className="hover:text-sky-700 transition-colors whitespace-nowrap">
              Google Drive
            </a>
            <a href="#how-to-measure" className="hover:text-sky-700 transition-colors whitespace-nowrap">
              Measuring Tips
            </a>
          </div>
        </div>
      </footer>

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
