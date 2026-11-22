import React, { useState } from 'react';
import {
  Award,
  Backpack,
  BookOpen,
  CheckCircle2,
  Compass,
  Crown,
  Flame,
  Lock,
  Music,
  Orbit,
  Play,
  Rocket,
  RotateCcw,
  Sprout,
  Star,
  Trophy,
} from 'lucide-react';
import {
  BadgeColorTheme,
  BadgeIconKind,
  ChildPlayroomProgress,
  EvaluatedPlayroomBadge,
  PlayableGameId,
} from '../../services/playroomBadgesService';

interface PlayroomBadgesGridProps {
  childName: string;
  badges: EvaluatedPlayroomBadge[];
  progress: ChildPlayroomProgress;
  onPlaySuggestedGame: (gameId: PlayableGameId) => void;
  onResetBadges: () => void;
}

type BadgeFilterMode = 'all' | 'unlocked' | 'locked';

const THEME_STYLES: Record<
  BadgeColorTheme,
  {
    unlockedCard: string;
    emblemBg: string;
    emblemRing: string;
    iconColor: string;
    barFill: string;
    accentText: string;
  }
> = {
  emerald: {
    unlockedCard:
      'bg-emerald-50/70 dark:bg-emerald-950/35 border-emerald-300 dark:border-emerald-700/80',
    emblemBg: 'bg-emerald-500 text-white',
    emblemRing: 'ring-4 ring-emerald-200 dark:ring-emerald-900/70',
    iconColor: 'text-emerald-700 dark:text-emerald-300',
    barFill: 'bg-emerald-500',
    accentText: 'text-emerald-800 dark:text-emerald-300',
  },
  sky: {
    unlockedCard:
      'bg-sky-50/75 dark:bg-sky-950/35 border-sky-300 dark:border-sky-700/80',
    emblemBg: 'bg-sky-500 text-white',
    emblemRing: 'ring-4 ring-sky-200 dark:ring-sky-900/70',
    iconColor: 'text-sky-700 dark:text-sky-300',
    barFill: 'bg-sky-500',
    accentText: 'text-sky-800 dark:text-sky-300',
  },
  amber: {
    unlockedCard:
      'bg-amber-50/80 dark:bg-amber-950/35 border-amber-300 dark:border-amber-700/80',
    emblemBg: 'bg-amber-400 text-slate-950',
    emblemRing: 'ring-4 ring-amber-200 dark:ring-amber-900/70',
    iconColor: 'text-amber-700 dark:text-amber-300',
    barFill: 'bg-amber-400',
    accentText: 'text-amber-900 dark:text-amber-300',
  },
  violet: {
    unlockedCard:
      'bg-violet-50/75 dark:bg-violet-950/35 border-violet-300 dark:border-violet-700/80',
    emblemBg: 'bg-violet-600 text-white',
    emblemRing: 'ring-4 ring-violet-200 dark:ring-violet-900/70',
    iconColor: 'text-violet-700 dark:text-violet-300',
    barFill: 'bg-violet-500',
    accentText: 'text-violet-800 dark:text-violet-300',
  },
  rose: {
    unlockedCard:
      'bg-rose-50/75 dark:bg-rose-950/35 border-rose-300 dark:border-rose-700/80',
    emblemBg: 'bg-rose-500 text-white',
    emblemRing: 'ring-4 ring-rose-200 dark:ring-rose-900/70',
    iconColor: 'text-rose-700 dark:text-rose-300',
    barFill: 'bg-rose-500',
    accentText: 'text-rose-800 dark:text-rose-300',
  },
  orange: {
    unlockedCard:
      'bg-orange-50/75 dark:bg-orange-950/35 border-orange-300 dark:border-orange-700/80',
    emblemBg: 'bg-orange-500 text-white',
    emblemRing: 'ring-4 ring-orange-200 dark:ring-orange-900/70',
    iconColor: 'text-orange-700 dark:text-orange-300',
    barFill: 'bg-orange-500',
    accentText: 'text-orange-800 dark:text-orange-300',
  },
  cyan: {
    unlockedCard:
      'bg-cyan-50/75 dark:bg-cyan-950/35 border-cyan-300 dark:border-cyan-700/80',
    emblemBg: 'bg-cyan-600 text-white',
    emblemRing: 'ring-4 ring-cyan-200 dark:ring-cyan-900/70',
    iconColor: 'text-cyan-700 dark:text-cyan-300',
    barFill: 'bg-cyan-500',
    accentText: 'text-cyan-800 dark:text-cyan-300',
  },
  indigo: {
    unlockedCard:
      'bg-indigo-50/75 dark:bg-indigo-950/35 border-indigo-300 dark:border-indigo-700/80',
    emblemBg: 'bg-indigo-600 text-white',
    emblemRing: 'ring-4 ring-indigo-200 dark:ring-indigo-900/70',
    iconColor: 'text-indigo-700 dark:text-indigo-300',
    barFill: 'bg-indigo-500',
    accentText: 'text-indigo-800 dark:text-indigo-300',
  },
};

function renderBadgeIcon(icon: BadgeIconKind, className: string) {
  switch (icon) {
    case 'sprout':
      return <Sprout className={className} aria-hidden="true" />;
    case 'compass':
      return <Compass className={className} aria-hidden="true" />;
    case 'backpack':
      return <Backpack className={className} aria-hidden="true" />;
    case 'crown':
      return <Crown className={className} aria-hidden="true" />;
    case 'star':
      return <Star className={className} aria-hidden="true" />;
    case 'trophy':
      return <Trophy className={className} aria-hidden="true" />;
    case 'medal':
      return <Award className={className} aria-hidden="true" />;
    case 'book':
      return <BookOpen className={className} aria-hidden="true" />;
    case 'planet':
      return <Orbit className={className} aria-hidden="true" />;
    case 'rocket':
      return <Rocket className={className} aria-hidden="true" />;
    case 'music':
      return <Music className={className} aria-hidden="true" />;
    case 'flame':
      return <Flame className={className} aria-hidden="true" />;
  }
}

export const PlayroomBadgesGrid: React.FC<PlayroomBadgesGridProps> = ({
  childName,
  badges,
  progress,
  onPlaySuggestedGame,
  onResetBadges,
}) => {
  const [filterMode, setFilterMode] = useState<BadgeFilterMode>('all');
  const [confirmingReset, setConfirmingReset] = useState(false);

  const unlockedCount = badges.filter((b) => b.isUnlocked).length;
  const lockedCount = badges.length - unlockedCount;
  const uniqueGamesTried = Object.values(progress.gamesOpened).filter(
    (n) => (n ?? 0) > 0,
  ).length;
  const overallPercent = Math.round((unlockedCount / badges.length) * 100);

  const filteredBadges = badges.filter((badge) => {
    if (filterMode === 'unlocked') return badge.isUnlocked;
    if (filterMode === 'locked') return !badge.isUnlocked;
    return true;
  });

  return (
    <section
      aria-label={`${childName}'s Playroom Badges and Achievements`}
      className="bg-white/95 dark:bg-slate-900/95 rounded-3xl border-2 border-amber-200 dark:border-slate-700 p-5 sm:p-6 shadow-xs space-y-5"
    >
      {/* Trophy Case Header + Clean Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-amber-100 dark:border-slate-800">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
            <Trophy className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
            <span>Playroom Trophy Case</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-indigo-950 dark:text-white">
              {unlockedCount} / {badges.length} Badges Unlocked ({overallPercent}%)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-indigo-950 dark:text-white">
            {childName}’s Achievements &amp; Badges
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
              {uniqueGamesTried}/12
            </span>{' '}
            games tried
            <span className="mx-2 text-slate-300 dark:text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
              {progress.totalVictories}
            </span>{' '}
            {progress.totalVictories === 1 ? 'round' : 'rounds'} finished
            <span className="mx-2 text-slate-300 dark:text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
              {progress.totalSessions}
            </span>{' '}
            {progress.totalSessions === 1 ? 'play session' : 'play sessions'}
          </p>
        </div>

        {/* Filter Segmented Control & Reset Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="Filter badges"
            className="inline-flex items-center gap-1 bg-sky-50 dark:bg-slate-800 p-1 rounded-xl border border-sky-200 dark:border-slate-700"
          >
            {[
              { id: 'all' as const, label: `All (${badges.length})` },
              { id: 'unlocked' as const, label: `Unlocked (${unlockedCount})` },
              { id: 'locked' as const, label: `Next Up (${lockedCount})` },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilterMode(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filterMode === opt.id
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {progress.totalSessions > 0 &&
            (confirmingReset ? (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onResetBadges();
                    setConfirmingReset(false);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingReset(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Reset
              </button>
            ))}
        </div>
      </div>

      {/* Overall Trophy Progress Bar */}
      <div className="space-y-1.5">
        <div
          className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700"
          role="progressbar"
          aria-valuenow={unlockedCount}
          aria-valuemin={0}
          aria-valuemax={badges.length}
          aria-label="Overall badges unlocked"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-500 to-sky-500 transition-all duration-300"
            style={{ width: `${Math.max(unlockedCount > 0 ? 6 : 0, overallPercent)}%` }}
          />
        </div>
      </div>

      {/* CSS Grid Showcase of All Playroom Achievements */}
      {filteredBadges.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {filterMode === 'unlocked'
              ? `No badges unlocked yet — pick any game to earn ${childName}’s first badge!`
              : `Woohoo! ${childName} unlocked every single Playroom badge!`}
          </p>
          {filterMode === 'unlocked' && (
            <button
              type="button"
              onClick={() => onPlaySuggestedGame('sunflower')}
              className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
              Play First Game
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredBadges.map((badge) => {
            const theme = THEME_STYLES[badge.theme];
            return (
              <article
                key={badge.id}
                className={`rounded-2xl border-2 p-4 flex flex-col justify-between gap-3.5 transition-transform duration-200 ${
                  badge.isUnlocked
                    ? `${theme.unlockedCard} hover:-translate-y-0.5`
                    : 'bg-slate-50/80 dark:bg-slate-800/55 border-slate-200 dark:border-slate-700/80'
                }`}
              >
                {/* Top Row: Medal Emblem + Category/Status Line */}
                <div className="flex items-start gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform ${
                      badge.isUnlocked
                        ? `${theme.emblemBg} ${theme.emblemRing} shadow-xs`
                        : 'bg-slate-200/90 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {badge.isUnlocked ? (
                      renderBadgeIcon(badge.icon, 'w-6 h-6')
                    ) : (
                      <Lock className="w-5 h-5" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                      <span
                        className={
                          badge.isUnlocked
                            ? theme.accentText
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {badge.category}
                      </span>
                      <span
                        aria-hidden="true"
                        className="text-slate-300 dark:text-slate-600"
                      >
                        ·
                      </span>
                      {badge.isUnlocked ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                          {badge.unlockedDateLabel
                            ? `Earned ${badge.unlockedDateLabel}`
                            : 'Unlocked'}
                        </span>
                      ) : (
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {badge.currentCount}/{badge.targetCount}
                        </span>
                      )}
                    </div>

                    <h3
                      className={`text-sm font-display font-extrabold leading-snug ${
                        badge.isUnlocked
                          ? 'text-indigo-950 dark:text-white'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {badge.title}
                    </h3>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {badge.description}
                </p>

                {/* Bottom Row: Progress Bar & Play Shortcut (when locked) */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    <span>
                      {badge.currentCount} / {badge.targetCount} {badge.unitLabel}
                    </span>
                    <span className="font-bold">{badge.progressPercent}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/90 dark:bg-slate-900 overflow-hidden border border-slate-200/80 dark:border-slate-700">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        badge.isUnlocked ? theme.barFill : 'bg-amber-400/85'
                      }`}
                      style={{ width: `${badge.progressPercent}%` }}
                    />
                  </div>

                  {!badge.isUnlocked && (
                    <button
                      type="button"
                      onClick={() => onPlaySuggestedGame(badge.suggestedGameId)}
                      className="w-full mt-1 py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 hover:border-amber-400 dark:hover:border-amber-500 text-xs font-bold text-indigo-950 dark:text-slate-100 inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current text-amber-500 shrink-0" aria-hidden="true" />
                      Try {badge.suggestedGameLabel}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
