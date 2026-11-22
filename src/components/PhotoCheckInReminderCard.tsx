import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarPlus, Camera, CheckCircle2, Clock } from 'lucide-react';
import {
  ChildPhotoRecord,
  ChildProfile,
  GrowthMeasurement,
} from '../types';

export type ReminderCadenceDays = 7 | 14 | 0;

interface StoredReminderPref {
  cadenceDays: ReminderCadenceDays;
  browserAlertsEnabled: boolean;
}

interface PhotoCheckInReminderCardProps {
  childProfile: ChildProfile;
  photos: ChildPhotoRecord[];
  measurements: GrowthMeasurement[];
  onTakeOrUploadPhoto: () => void;
}

const STORAGE_KEY = 'sproutscale_photo_checkin_reminders_v1';

function loadReminderPref(childId: string): StoredReminderPref {
  if (typeof window === 'undefined') {
    return { cadenceDays: 7, browserAlertsEnabled: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { cadenceDays: 7, browserAlertsEnabled: false };
    const parsed = JSON.parse(raw) as Record<string, StoredReminderPref>;
    const saved = parsed?.[childId];
    if (!saved) return { cadenceDays: 7, browserAlertsEnabled: false };
    const validCadence: ReminderCadenceDays =
      saved.cadenceDays === 14 ? 14 : saved.cadenceDays === 0 ? 0 : 7;
    return {
      cadenceDays: validCadence,
      browserAlertsEnabled: Boolean(saved.browserAlertsEnabled),
    };
  } catch {
    return { cadenceDays: 7, browserAlertsEnabled: false };
  }
}

function saveReminderPref(childId: string, pref: StoredReminderPref): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, StoredReminderPref>) : {};
    parsed[childId] = pref;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage write errors
  }
}

function parseIsoDayMs(dateStr?: string): number | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

function formatIcsDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function downloadRecurringCalendarReminder(
  childName: string,
  cadenceDays: 7 | 14,
  nextDueDate: Date,
): void {
  const startDay = formatIcsDate(nextDueDate);
  const endDate = new Date(nextDueDate.getTime() + 86400000);
  const endDay = formatIcsDate(endDate);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const safeName = childName.replace(/[\r\n,;]/g, ' ').trim() || 'Child';

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SproutScale//Photo Check-In Reminder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:sproutscale-checkin-${cadenceDays}d-${Date.now()}@sprout-scale.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${startDay}`,
    `DTEND;VALUE=DATE:${endDay}`,
    `RRULE:FREQ=DAILY;INTERVAL=${cadenceDays}`,
    `SUMMARY:SproutScale Photo Check-In — ${safeName}`,
    `DESCRIPTION:Time to snap and upload a fresh photo of ${safeName} in SproutScale to keep growth records accurate!`,
    'BEGIN:VALARM',
    'TRIGGER:-PT9H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Snap & upload ${safeName}'s SproutScale photo check-in!`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsLines], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sproutscale-${safeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-every-${cadenceDays}-days.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const PhotoCheckInReminderCard: React.FC<PhotoCheckInReminderCardProps> = ({
  childProfile,
  photos,
  measurements,
  onTakeOrUploadPhoto,
}) => {
  const [pref, setPref] = useState<StoredReminderPref>(() =>
    loadReminderPref(childProfile.id),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setPref(loadReminderPref(childProfile.id));
    setStatusMessage(null);
  }, [childProfile.id]);

  const updatePref = (next: StoredReminderPref) => {
    setPref(next);
    saveReminderPref(childProfile.id, next);
  };

  const scheduleSummary = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();

    let latestMs: number | null = null;
    let latestSource: 'photo' | 'measurement' | null = null;

    for (const p of photos) {
      const ms = parseIsoDayMs(p.capturedDate);
      if (ms !== null && (latestMs === null || ms > latestMs)) {
        latestMs = ms;
        latestSource = 'photo';
      }
    }
    if (latestMs === null) {
      for (const m of measurements) {
        const ms = parseIsoDayMs(m.recordedDate);
        if (ms !== null && (latestMs === null || ms > latestMs)) {
          latestMs = ms;
          latestSource = 'measurement';
        }
      }
    }

    if (pref.cadenceDays === 0) {
      return {
        isDue: false,
        headline: `Photo check-in reminders are paused for ${childProfile.name}`,
        subline: 'Pick Every 7 days or Every 14 days to stay on track with regular photo updates.',
        nextDueDate: new Date(todayStart + 7 * 86400000),
      };
    }

    if (latestMs === null) {
      return {
        isDue: true,
        headline: `Ready for ${childProfile.name}’s first photo check-in!`,
        subline: `Snap or upload a photo today — we’ll remind you again every ${pref.cadenceDays} days.`,
        nextDueDate: new Date(todayStart),
      };
    }

    const daysSince = Math.max(0, Math.round((todayStart - latestMs) / 86400000));
    const daysRemaining = pref.cadenceDays - daysSince;
    const nextDueDate = new Date(latestMs + pref.cadenceDays * 86400000);
    const nextDateLabel = nextDueDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const lastLabel = latestSource === 'photo' ? 'last photo' : 'last mark';

    if (daysRemaining <= 0) {
      const overdue = Math.abs(daysRemaining);
      return {
        isDue: true,
        headline:
          overdue === 0
            ? `Photo check-in due today for ${childProfile.name}!`
            : `Photo check-in overdue by ${overdue} ${overdue === 1 ? 'day' : 'days'} for ${childProfile.name}`,
        subline: `Your ${lastLabel} was ${daysSince} ${daysSince === 1 ? 'day' : 'days'} ago (every ${pref.cadenceDays} days). Upload a quick photo to keep growth records accurate.`,
        nextDueDate: new Date(todayStart),
      };
    }

    return {
      isDue: false,
      headline: `Next photo check-in in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} (${nextDateLabel})`,
      subline: `Keeping ${childProfile.name}’s growth records accurate every ${pref.cadenceDays} days · ${lastLabel} ${daysSince === 0 ? 'today' : `${daysSince}d ago`}.`,
      nextDueDate,
    };
  }, [childProfile.name, photos, measurements, pref.cadenceDays]);

  const handleToggleBrowserAlerts = async () => {
    if (pref.browserAlertsEnabled) {
      updatePref({ ...pref, browserAlertsEnabled: false });
      setStatusMessage('Browser check-in alerts turned off.');
      return;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      setStatusMessage(
        'Browser notifications aren’t available here — use "Add to Calendar (.ics)" for phone & desktop reminders!',
      );
      return;
    }

    try {
      const permission =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();
      if (permission === 'granted') {
        updatePref({ ...pref, browserAlertsEnabled: true });
        setStatusMessage(
          `Browser check-in reminders enabled for ${childProfile.name} (every ${pref.cadenceDays || 7} days).`,
        );
      } else {
        setStatusMessage(
          'Notification permission was blocked — use "Add to Calendar (.ics)" for automatic phone reminders.',
        );
      }
    } catch {
      setStatusMessage(
        'Use "Add to Calendar (.ics)" to add a recurring 7-day or 14-day phone reminder.',
      );
    }
  };

  const handleExportCalendar = () => {
    const interval: 7 | 14 = pref.cadenceDays === 14 ? 14 : 7;
    downloadRecurringCalendarReminder(
      childProfile.name,
      interval,
      scheduleSummary.nextDueDate,
    );
    setStatusMessage(
      `Downloaded recurring every-${interval}-days calendar reminder (.ics) for ${childProfile.name}!`,
    );
  };

  return (
    <section
      aria-label="Photo check-in reminder"
      className={`rounded-2xl border-2 p-4 sm:p-5 shadow-xs transition-colors ${
        scheduleSummary.isDue
          ? 'bg-amber-50/90 dark:bg-amber-950/35 border-amber-300 dark:border-amber-700/80'
          : 'bg-white/95 dark:bg-slate-900/95 border-sky-200 dark:border-slate-700'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Status & Explanation */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              scheduleSummary.isDue
                ? 'bg-amber-400 text-slate-950'
                : 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300'
            }`}
          >
            {scheduleSummary.isDue ? (
              <Bell className="w-5 h-5" aria-hidden="true" />
            ) : pref.cadenceDays === 0 ? (
              <Clock className="w-5 h-5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            )}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              <span>Photo Check-In Reminder</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-sky-800 dark:text-sky-300">
                {pref.cadenceDays === 0
                  ? 'Paused'
                  : `Every ${pref.cadenceDays} Days`}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-display font-extrabold text-indigo-950 dark:text-white">
              {scheduleSummary.headline}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {scheduleSummary.subline}
            </p>
          </div>
        </div>

        {/* Right: 7 / 14 Day Selector + Quick Photo & Calendar Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div
            role="group"
            aria-label="Photo reminder frequency"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-sky-100/80 dark:bg-slate-800 border border-sky-200 dark:border-slate-700"
          >
            {[
              { days: 7 as const, label: 'Every 7 days' },
              { days: 14 as const, label: 'Every 14 days' },
              { days: 0 as const, label: 'Off' },
            ].map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => {
                  updatePref({ ...pref, cadenceDays: opt.days });
                  setStatusMessage(
                    opt.days === 0
                      ? `Paused photo reminders for ${childProfile.name}.`
                      : `Set ${childProfile.name}’s photo check-in reminder to every ${opt.days} days.`,
                  );
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  pref.cadenceDays === opt.days
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onTakeOrUploadPhoto}
            className="h-10 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Take / Upload Photo
          </button>

          {pref.cadenceDays > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportCalendar}
                className="h-10 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-sky-300 dark:border-slate-600 hover:bg-sky-50 dark:hover:bg-slate-700 text-indigo-950 dark:text-sky-200 text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CalendarPlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Calendar (.ics)
              </button>

              <button
                type="button"
                onClick={() => void handleToggleBrowserAlerts()}
                aria-pressed={pref.browserAlertsEnabled}
                className={`h-10 px-3 py-2 rounded-xl border text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  pref.browserAlertsEnabled
                    ? 'bg-sky-600 border-sky-600 text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Bell className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {pref.browserAlertsEnabled ? 'Alerts On' : 'Browser Alert'}
              </button>
            </>
          )}
        </div>
      </div>

      {statusMessage && (
        <p className="mt-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          {statusMessage}
        </p>
      )}
    </section>
  );
};
