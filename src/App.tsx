/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
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
import { LogIn, LogOut, Plus } from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  AccessoryId,
  ChildProfile,
  clampNumber,
  DEMO_CHILD,
  DEMO_MEASUREMENTS,
  HairStyle,
  PaletteId,
  sanitizeId,
  UnitSystem,
  VALIDATION_BOUNDS,
  GrowthMeasurement,
} from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GrowthWallStage } from './components/GrowthWallStage';
import {
  ControlDeckTab,
  MeasurementControlDeck,
} from './components/MeasurementControlDeck';
import { GrowthTimelineSection } from './components/GrowthTimelineSection';
import { HowToMeasureSection } from './components/HowToMeasureSection';

function getTodayIsoDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function SproutScaleWorkspace() {
  // Firebase Auth state
  const [user, setUser] = useState<User | null>(null);
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

  // Active children list & measurements depending on Auth state
  const activeChildrenList = user ? cloudChildren : demoChildren;
  const activeChild: ChildProfile = useMemo(() => {
    const found = activeChildrenList.find((c) => c.id === selectedChildId);
    return found ?? activeChildrenList[0] ?? DEMO_CHILD;
  }, [activeChildrenList, selectedChildId]);

  const activeMeasurements: GrowthMeasurement[] = useMemo(() => {
    if (user) {
      return cloudMeasurements;
    }
    return demoMeasurementsMap[activeChild.id] ?? [];
  }, [user, cloudMeasurements, demoMeasurementsMap, activeChild.id]);

  // Latest recorded milestone for active child (fallback to Age 2 baseline)
  const latestMilestone = useMemo(() => {
    if (activeMeasurements.length === 0) {
      return {
        heightCm: activeChild.ageTwoHeightCm,
        weightKg: activeChild.ageTwoWeightKg,
        ageMonths: 24,
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
      setDraftAgeMonths(latestMilestone.ageMonths);
    }
  }, [activeChild.id, latestMilestone.heightCm, latestMilestone.weightKg, latestMilestone.ageMonths, isPlayingTimelapse]);

  // 1. Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);

      if (currentUser && currentUser.emailVerified) {
        // Seed initial child profile in Firestore if this user has zero profiles yet
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
              ageTwoHeightCm: DEMO_CHILD.ageTwoHeightCm,
              ageTwoWeightKg: DEMO_CHILD.ageTwoWeightKg,
              paletteId: DEMO_CHILD.paletteId,
              accessoryId: DEMO_CHILD.accessoryId,
              hairStyle: DEMO_CHILD.hairStyle,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            // Also seed Age 2 baseline milestone so their timeline starts ready to explore
            const baselineMId = sanitizeId(`m_${firstChildId}_24m`);
            await setDoc(
              doc(db, 'children', firstChildId, 'measurements', baselineMId),
              {
                ownerId: currentUser.uid,
                childId: firstChildId,
                ageMonths: 24,
                heightCm: DEMO_CHILD.ageTwoHeightCm,
                weightKg: DEMO_CHILD.ageTwoWeightKg,
                recordedDate: getTodayIsoDate(),
                note: 'Age 2 starting height & weight baseline',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
            );
            setSelectedChildId(firstChildId);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, childrenPath);
        }
      }
    });

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
          return {
            id: docSnap.id,
            ownerId: String(d.ownerId ?? user.uid),
            name: String(d.name ?? 'Sprout'),
            ageTwoHeightCm: Number(d.ageTwoHeightCm ?? 86.5),
            ageTwoWeightKg: Number(d.ageTwoWeightKg ?? 12.5),
            paletteId: (d.paletteId as PaletteId) ?? 'meadow',
            accessoryId: (d.accessoryId as AccessoryId) ?? 'sprout',
            hairStyle: (d.hairStyle as HairStyle) ?? 'curls',
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
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in was cancelled.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('Could not complete Google sign-in. Please try again.');
      }
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setSelectedChildId(DEMO_CHILD.id);
    setStatusBanner(null);
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

  const handleSaveCharacterProfile = async (updates: {
    name: string;
    ageTwoHeightCm: number;
    ageTwoWeightKg: number;
    paletteId: PaletteId;
    accessoryId: AccessoryId;
    hairStyle: HairStyle;
  }) => {
    setIsSaving(true);
    try {
      if (user) {
        const path = `children/${activeChild.id}`;
        try {
          await updateDoc(doc(db, 'children', activeChild.id), {
            name: updates.name.slice(0, VALIDATION_BOUNDS.NAME_MAX_LEN),
            ageTwoHeightCm: updates.ageTwoHeightCm,
            ageTwoWeightKg: updates.ageTwoWeightKg,
            paletteId: updates.paletteId,
            accessoryId: updates.accessoryId,
            hairStyle: updates.hairStyle,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
        showTransientBanner('success', `Updated ${updates.name}’s character & Age 2 baseline!`);
      } else {
        setDemoChildren((prev) =>
          prev.map((c) => (c.id === activeChild.id ? { ...c, ...updates } : c)),
        );
        showTransientBanner('success', `Updated ${updates.name}’s character & Age 2 baseline!`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewChild = async (newChild: {
    name: string;
    ageTwoHeightCm: number;
    ageTwoWeightKg: number;
    paletteId: PaletteId;
    accessoryId: AccessoryId;
    hairStyle: HairStyle;
  }) => {
    setIsSaving(true);
    try {
      if (user) {
        const childId = sanitizeId(`child_${Date.now()}`);
        const childPath = `children/${childId}`;
        try {
          await setDoc(doc(db, 'children', childId), {
            ownerId: user.uid,
            name: newChild.name.slice(0, VALIDATION_BOUNDS.NAME_MAX_LEN),
            ageTwoHeightCm: newChild.ageTwoHeightCm,
            ageTwoWeightKg: newChild.ageTwoWeightKg,
            paletteId: newChild.paletteId,
            accessoryId: newChild.accessoryId,
            hairStyle: newChild.hairStyle,
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
        showTransientBanner('success', `Added ${newChild.name} starting at Age 2!`);
      } else {
        const childId = sanitizeId(`demo_child_${Date.now()}`);
        const created: ChildProfile = {
          id: childId,
          ownerId: 'demo_family',
          ...newChild,
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
        showTransientBanner('success', `Added ${newChild.name} starting at Age 2!`);
      }
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single Wordmark Element */}
          <a
            href="#measure"
            className="text-xl font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
          >
            SproutScale
          </a>

          {/* Zone 2: 4 Concise Single-Line Navigation Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <a
              href="#measure"
              onClick={() => setActiveDeckTab('measure')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Growth Wall
            </a>
            <a
              href="#measure"
              onClick={() => setActiveDeckTab('character')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Character
            </a>
            <a
              href="#timeline"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Milestones
            </a>
            <a
              href="#how-to-measure"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              How to Measure
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            {!user ? (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                Sign in to Save
              </button>
            ) : (
              <a
                href="#measure"
                onClick={() => setActiveDeckTab('measure')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
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
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                Watch how tall they’ve grown since turning two.
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Slide or mark your kid’s height and weight to watch their character sprout
                right beside their 2-year-old self on the playroom ruler.
              </p>
            </div>

            {/* Child Switcher & Account Sync Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="group"
                aria-label="Select child profile"
                className="flex items-center gap-1 p-1 bg-slate-200/75 rounded-lg"
              >
                {activeChildrenList.map((kid) => (
                  <button
                    key={kid.id}
                    type="button"
                    onClick={() => setSelectedChildId(kid.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      kid.id === activeChild.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {kid.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setActiveDeckTab('character')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  + Kid
                </button>
              </div>

              {user ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Saved to {user.displayName?.split(' ')[0] ?? 'Family'}</span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 whitespace-nowrap shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  <span>Interactive Playground</span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="font-semibold text-emerald-700 hover:underline whitespace-nowrap shrink-0"
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
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
              <p className="text-sm font-medium text-slate-600">
                Loading your family’s growth wall...
              </p>
            </div>
          ) : (
            /* Two-Zone Educational & Interactive Sandbox Layout (65% Stage / 35% Control Deck) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-8 flex flex-col">
                <GrowthWallStage
                  childProfile={activeChild}
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
                />
              </div>

              <div className="lg:col-span-4 flex flex-col">
                <MeasurementControlDeck
                  activeTab={activeDeckTab}
                  onTabChange={setActiveDeckTab}
                  childProfile={activeChild}
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
                  onChangeDraftDate={setDraftDate}
                  onChangeDraftNote={setDraftNote}
                  onResetDraft={() => {
                    setDraftHeightCm(latestMilestone.heightCm);
                    setDraftWeightKg(latestMilestone.weightKg);
                    setDraftAgeMonths(latestMilestone.ageMonths);
                  }}
                  onSubmitMeasurement={handleMarkMeasurement}
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

        {/* Section 3: Home Measuring Guide */}
        <HowToMeasureSection />
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>SproutScale — Family Height & Weight Growth Wall</p>
          <div className="flex items-center gap-4">
            <a href="#measure" className="hover:text-slate-900 transition-colors">
              Growth Wall
            </a>
            <a href="#timeline" className="hover:text-slate-900 transition-colors">
              Milestones
            </a>
            <a href="#how-to-measure" className="hover:text-slate-900 transition-colors">
              Measuring Tips
            </a>
          </div>
        </div>
      </footer>
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
