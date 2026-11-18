import React, { useState } from 'react';
import { Ruler } from 'lucide-react';

export const HowToMeasureSection: React.FC = () => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [cardImgFailed, setCardImgFailed] = useState(false);

  return (
    <section id="how-to-measure" className="pt-8 pb-12 space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-indigo-950">
          How to Measure Together at Home
        </h2>
        <p className="text-sm text-slate-700 max-w-2xl">
          Turn check-in day into a favorite family ritual with a hardcover storybook,
          a flat wall, and a bathroom scale.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Visual Card: Scandinavian Playroom Growth Ruler Photo */}
        <div className="lg:col-span-7 bg-white border-2 border-sky-200 rounded-2xl overflow-hidden flex flex-col justify-between shadow-xs">
          <div className="relative aspect-video w-full bg-slate-100 overflow-hidden">
            {!heroImgFailed ? (
              <img
                src="/src/assets/images/hero_playroom_ruler_1795018900537.jpg"
                alt="Sunlit children's bedroom wall with a natural oak wooden height growth ruler and floor scale"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50 p-6 text-center">
                <Ruler className="w-10 h-10 text-emerald-700 mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-800">
                  Playroom Wall Height & Scale Corner
                </p>
              </div>
            )}
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-900">01. Shoes & Socks Off</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Stand barefoot on a hard, flat floor with heels, shoulders, and the back
                of the head touching a flat wall.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-900">02. The Storybook Trick</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Rest a hardcover picture book flat on the crown of the head with its spine
                flush against the wall to find the exact mark.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-900">03. Steady Scale Step</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Weigh in the morning wearing light clothes so every milestone compares
                apples to apples from Age 2 onward.
              </p>
            </div>
          </div>
        </div>

        {/* Right Companion Card: Storybook Illustration + Why Age 2 Matters */}
        <div className="lg:col-span-5 bg-white border-2 border-amber-200 rounded-2xl overflow-hidden flex flex-col justify-between shadow-xs">
          <div className="aspect-4/3 w-full bg-amber-50/40 overflow-hidden">
            {!cardImgFailed ? (
              <img
                src="/src/assets/images/milestone_storybook_card_1795018899795.jpg"
                alt="Storybook illustration of a smiling wooden growth ruler beside a flourishing green sprout and paper airplanes"
                referrerPolicy="no-referrer"
                onError={() => setCardImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-emerald-50 p-6 text-center">
                <Ruler className="w-8 h-8 text-amber-700 mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-800">
                  Growing From Age Two Onward
                </p>
              </div>
            )}
          </div>

          <div className="p-6 space-y-3">
            <h3 className="text-lg font-bold text-slate-900">
              Why Start the Story at Age Two?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Around age two, kids switch from baby length mats to standing tall on their
              own two feet! Keeping their Age 2 mark right beside today’s character lets
              kids celebrate every centimeter and kilogram they’ve gained.
            </p>
            <div className="pt-2 text-xs text-slate-500">
              <span>Standing stadiometer method</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>Metric & Imperial ready</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>Multi-sibling profiles</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
