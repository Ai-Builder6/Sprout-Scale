import React, { useState } from 'react';
import { Camera, Ruler } from 'lucide-react';

interface HowToMeasureSectionProps {
  onOpenWallHeightEstimator?: () => void;
}

export const HowToMeasureSection: React.FC<HowToMeasureSectionProps> = ({
  onOpenWallHeightEstimator,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [cardImgFailed, setCardImgFailed] = useState(false);

  return (
    <section id="how-to-measure" className="pt-8 pb-12 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-indigo-950 dark:text-white">
            How to Measure Together at Home
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 max-w-2xl">
            Turn check-in day into a favorite family ritual with a hardcover storybook, a flat
            wall, or a quick wall photo guesstimate in inches.
          </p>
        </div>

        {onOpenWallHeightEstimator && (
          <button
            type="button"
            onClick={onOpenWallHeightEstimator}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" aria-hidden="true" />
            Guesstimate Height from Wall Photo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Visual Card: Scandinavian Playroom Growth Ruler Photo */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border-2 border-sky-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col justify-between shadow-xs">
          <div className="relative aspect-video w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            {!heroImgFailed ? (
              <img
                src="/src/assets/images/hero_playroom_ruler_1795018900537.jpg"
                alt="Sunlit children's bedroom wall with a natural oak wooden height growth ruler and floor scale"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-slate-800 dark:to-slate-900 p-6 text-center">
                <Ruler className="w-10 h-10 text-emerald-700 dark:text-emerald-400 mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Playroom Wall Height &amp; Scale Corner
                </p>
              </div>
            )}
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                01. Shoes &amp; Socks Off
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Stand barefoot on a hard, flat floor with heels, shoulders, and the back
                of the head touching a flat wall.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                02. Book or Wall Photo
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Rest a hardcover book flat on the head, or tape an 11-inch sheet of paper beside
                them and snap a straight-on photo to guesstimate inches!
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                03. Steady Scale Step
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Weigh in the morning wearing light clothes so every milestone compares
                apples to apples from Age 2 onward.
              </p>
            </div>
          </div>
        </div>

        {/* Right Companion Card: Storybook Illustration + Why Age 2 Matters */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border-2 border-amber-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col justify-between shadow-xs">
          <div className="aspect-4/3 w-full bg-amber-50/40 dark:bg-slate-800 overflow-hidden">
            {!cardImgFailed ? (
              <img
                src="/src/assets/images/milestone_storybook_card_1795018899795.jpg"
                alt="Storybook illustration of a smiling wooden growth ruler beside a flourishing green sprout and paper airplanes"
                referrerPolicy="no-referrer"
                onError={() => setCardImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-emerald-50 dark:from-slate-800 dark:to-slate-900 p-6 text-center">
                <Ruler className="w-8 h-8 text-amber-700 dark:text-amber-400 mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Growing From Age Two Onward
                </p>
              </div>
            )}
          </div>

          <div className="p-6 space-y-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              No Tape Measure Handy? Snap a Wall Picture!
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Have your child stand against a wall next to a standard door frame (80&quot;), light
              switch (48&quot;), or a taped sheet of printer paper (11&quot;). Our Wall Photo
              Guesstimator estimates how many inches tall they are right from the photo!
            </p>
            <div className="pt-2 text-xs text-slate-500 dark:text-slate-400">
              <span>AI wall cue detection</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>11&quot; paper calibration</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>Inches &amp; metric ready</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
