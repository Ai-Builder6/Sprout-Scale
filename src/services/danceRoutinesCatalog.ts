import { DanceTrackId } from './dancePlayhouseAudio';

export type DanceMoveId =
  | 'bounce'
  | 'reach_sky'
  | 'spin'
  | 'star_jump'
  | 'robot_arms'
  | 'march'
  | 'stomp'
  | 'bunny_hop'
  | 'wiggle'
  | 'flamingo'
  | 'disco_high'
  | 'disco_low'
  | 'side_slide'
  | 'squat_blast'
  | 'moonwalk'
  | 'wave'
  | 'freeze';

export interface DanceMoveDefinition {
  id: DanceMoveId;
  name: string;
  shortLabel: string;
  cuePhrase: string;
  coachCallout: string;
  kidTip: string;
  beats: number;
  badgeColorClass: string;
}

export interface DanceRoutineDefinition {
  id: string;
  title: string;
  subtitle: string;
  ageRange: string;
  difficulty: 'Beginner' | 'Active' | 'Superstar';
  trackId: DanceTrackId;
  accentGradient: string;
  borderAccent: string;
  steps: DanceMoveId[];
}

export interface ChildDanceProgress {
  starsEarned: number;
  routinesCompleted: Record<string, number>;
  bestFreezeStreak: number;
  movesPracticed: number;
  totalSessions: number;
}

export const DANCE_MOVES: Record<DanceMoveId, DanceMoveDefinition> = {
  bounce: {
    id: 'bounce',
    name: 'Happy Bounce & Clap',
    shortLabel: 'Bounce',
    cuePhrase: 'Bend your knees, bounce to the beat, and clap!',
    coachCallout: 'Bounce your knees and clap on the beat!',
    kidTip: 'Soft springy knees — clap, clap, clap!',
    beats: 8,
    badgeColorClass: 'bg-amber-500 text-slate-950',
  },
  reach_sky: {
    id: 'reach_sky',
    name: 'Reach for the Sunshine',
    shortLabel: 'Reach Up',
    cuePhrase: 'Stretch both arms way up high to tickle the clouds!',
    coachCallout: 'Reach both hands high to the sunshine!',
    kidTip: 'Stand tall on your tippy-toes and wave your fingers!',
    beats: 8,
    badgeColorClass: 'bg-sky-500 text-white',
  },
  spin: {
    id: 'spin',
    name: 'Twirl & Spin Around',
    shortLabel: 'Spin',
    cuePhrase: 'Spin all the way around in a happy circle!',
    coachCallout: 'Twirl around in a big happy circle!',
    kidTip: 'Arms out like airplane wings and spin!',
    beats: 8,
    badgeColorClass: 'bg-pink-500 text-white',
  },
  star_jump: {
    id: 'star_jump',
    name: 'Super Star Jump',
    shortLabel: 'Star Jump',
    cuePhrase: 'Jump up wide with arms and legs like a bright star!',
    coachCallout: 'Big star jump! Shine bright!',
    kidTip: 'Bend low, jump wide, and land with a big smile!',
    beats: 8,
    badgeColorClass: 'bg-orange-500 text-white',
  },
  robot_arms: {
    id: 'robot_arms',
    name: 'Beep-Boop Robot Arms',
    shortLabel: 'Robot',
    cuePhrase: 'Bend your elbows and move like a friendly dancing robot!',
    coachCallout: 'Robot arms! Beep, boop, beep, boop!',
    kidTip: 'Click-clack one arm up, then the other!',
    beats: 8,
    badgeColorClass: 'bg-cyan-500 text-slate-950',
  },
  march: {
    id: 'march',
    name: 'High-Knee March',
    shortLabel: 'March',
    cuePhrase: 'Lift those knees high and swing your arms in time!',
    coachCallout: 'March it out! Left, right, knees up high!',
    kidTip: 'Left knee up, right knee up — just like a parade!',
    beats: 8,
    badgeColorClass: 'bg-emerald-500 text-white',
  },
  stomp: {
    id: 'stomp',
    name: 'Elephant Stomp',
    shortLabel: 'Stomp',
    cuePhrase: 'Give big booming stomps like a happy dancing elephant!',
    coachCallout: 'Elephant stomp! Boom, boom, boom!',
    kidTip: 'Swing your arm like a trunk and stomp your feet!',
    beats: 8,
    badgeColorClass: 'bg-teal-500 text-white',
  },
  bunny_hop: {
    id: 'bunny_hop',
    name: 'Springy Bunny Hop',
    shortLabel: 'Bunny Hop',
    cuePhrase: 'Tuck your hands like bunny paws and hop, hop, hop!',
    coachCallout: 'Hop like a bouncy little bunny! Hop, hop, hop!',
    kidTip: 'Two feet together — light bouncy hops!',
    beats: 8,
    badgeColorClass: 'bg-lime-500 text-slate-950',
  },
  wiggle: {
    id: 'wiggle',
    name: 'Silly Monkey Wiggle',
    shortLabel: 'Wiggle',
    cuePhrase: 'Shake your shoulders and wiggle your whole silly self!',
    coachCallout: 'Shake and wiggle those silly shoulders!',
    kidTip: 'Wiggle left, wiggle right, shake out the giggles!',
    beats: 8,
    badgeColorClass: 'bg-yellow-400 text-slate-950',
  },
  flamingo: {
    id: 'flamingo',
    name: 'Flamingo Balance Pose',
    shortLabel: 'Balance',
    cuePhrase: 'Lift one foot up and balance like a pink flamingo!',
    coachCallout: 'Balance on one leg like a cool flamingo!',
    kidTip: 'Hold your arms out wide to stay super steady!',
    beats: 8,
    badgeColorClass: 'bg-rose-500 text-white',
  },
  disco_high: {
    id: 'disco_high',
    name: 'Disco Point High',
    shortLabel: 'Disco Up',
    cuePhrase: 'Point one finger up to the disco sparkles!',
    coachCallout: 'Disco point way up high to the lights!',
    kidTip: 'One hand on your hip, one finger pointing to the sky!',
    beats: 8,
    badgeColorClass: 'bg-fuchsia-500 text-white',
  },
  disco_low: {
    id: 'disco_low',
    name: 'Disco Point Low',
    shortLabel: 'Disco Low',
    cuePhrase: 'Point across down low and groove those knees!',
    coachCallout: 'Now disco point down low and groove!',
    kidTip: 'Switch high, then low — disco superstar!',
    beats: 8,
    badgeColorClass: 'bg-violet-500 text-white',
  },
  side_slide: {
    id: 'side_slide',
    name: 'Rainbow Side Slide',
    shortLabel: 'Side Slide',
    cuePhrase: 'Step slide to the left, clap, then slide to the right!',
    coachCallout: 'Slide to the left, now slide to the right!',
    kidTip: 'Big smooth steps side to side across the floor!',
    beats: 8,
    badgeColorClass: 'bg-indigo-500 text-white',
  },
  squat_blast: {
    id: 'squat_blast',
    name: 'Rocket Blast-Off Jump',
    shortLabel: 'Blast Off',
    cuePhrase: 'Crouch down low... 3, 2, 1 — BLAST OFF into the sky!',
    coachCallout: 'Crouch down low... three, two, one, blast off!',
    kidTip: 'Hands together like a rocket nose cone and jump!',
    beats: 8,
    badgeColorClass: 'bg-blue-600 text-white',
  },
  moonwalk: {
    id: 'moonwalk',
    name: 'Astronaut Moon Slide',
    shortLabel: 'Moon Slide',
    cuePhrase: 'Glide smoothly across the moon in slow-motion steps!',
    coachCallout: 'Glide like an astronaut walking on the moon!',
    kidTip: 'Big floaty steps — pretend gravity is super light!',
    beats: 8,
    badgeColorClass: 'bg-indigo-600 text-white',
  },
  wave: {
    id: 'wave',
    name: 'Superstar Crowd Wave',
    shortLabel: 'Wave',
    cuePhrase: 'Wave big and smile to your cheering fans!',
    coachCallout: 'Wave big to your cheering fans! Take a bow!',
    kidTip: 'Huge smile and wave both hands up high!',
    beats: 8,
    badgeColorClass: 'bg-amber-400 text-slate-950',
  },
  freeze: {
    id: 'freeze',
    name: 'Statue Freeze Pose',
    shortLabel: 'Freeze!',
    cuePhrase: 'Stop still like a silly frozen statue — don’t wiggle!',
    coachCallout: 'Freeze! Hold your coolest statue pose!',
    kidTip: 'Strike a funny pose and hold super still!',
    beats: 8,
    badgeColorClass: 'bg-sky-600 text-white',
  },
};

export const FREESTYLE_PARTY_MOVES: DanceMoveId[] = [
  'bounce',
  'star_jump',
  'spin',
  'robot_arms',
  'disco_high',
  'bunny_hop',
  'wiggle',
  'side_slide',
];

export const DANCE_ROUTINES: DanceRoutineDefinition[] = [
  {
    id: 'sunshine_pop_bounce',
    title: 'The Sunshine Pop Bounce',
    subtitle: 'Easy bouncy pop choreography with big claps and star jumps',
    ageRange: 'Ages 2–6',
    difficulty: 'Beginner',
    trackId: 'sunny_pop',
    accentGradient: 'from-amber-400 to-orange-500',
    borderAccent: 'border-amber-300 dark:border-amber-700',
    steps: ['bounce', 'reach_sky', 'spin', 'star_jump', 'wave'],
  },
  {
    id: 'funky_robot_dance',
    title: 'The Funky Robot Groove',
    subtitle: 'Click-clack robot arms, high-knee marches, and power freezes',
    ageRange: 'Ages 3–8',
    difficulty: 'Active',
    trackId: 'funky_robot',
    accentGradient: 'from-sky-500 to-cyan-500',
    borderAccent: 'border-sky-300 dark:border-sky-700',
    steps: ['robot_arms', 'march', 'spin', 'freeze', 'wave'],
  },
  {
    id: 'jungle_animal_boogie',
    title: 'Jungle Animal Boogie',
    subtitle: 'Hop like a bunny, stomp like an elephant, and balance like a flamingo',
    ageRange: 'Ages 2–6',
    difficulty: 'Beginner',
    trackId: 'jungle_safari',
    accentGradient: 'from-emerald-500 to-teal-500',
    borderAccent: 'border-emerald-300 dark:border-emerald-700',
    steps: ['bunny_hop', 'stomp', 'wiggle', 'flamingo', 'star_jump'],
  },
  {
    id: 'disco_rainbow_fever',
    title: 'Disco Rainbow Boogie',
    subtitle: 'Point high, point low, slide across the dance floor, and spin',
    ageRange: 'Ages 3–8',
    difficulty: 'Active',
    trackId: 'disco_rainbow',
    accentGradient: 'from-pink-500 to-fuchsia-500',
    borderAccent: 'border-pink-300 dark:border-pink-700',
    steps: ['disco_high', 'disco_low', 'side_slide', 'spin', 'wave'],
  },
  {
    id: 'rocket_ship_shuffle',
    title: 'Rocket Ship Space Shuffle',
    subtitle: 'Countdown squats, huge blast-off jumps, and astronaut moon slides',
    ageRange: 'Ages 3–8',
    difficulty: 'Superstar',
    trackId: 'rocket_shuffle',
    accentGradient: 'from-indigo-500 to-blue-600',
    borderAccent: 'border-indigo-300 dark:border-indigo-700',
    steps: ['squat_blast', 'moonwalk', 'spin', 'star_jump', 'freeze'],
  },
  {
    id: 'superstar_party_mix',
    title: 'Superstar Party Remix',
    subtitle: 'Combine all your favorite dance styles into one upbeat showstopper',
    ageRange: 'All Ages',
    difficulty: 'Superstar',
    trackId: 'freeze_party',
    accentGradient: 'from-orange-500 to-rose-500',
    borderAccent: 'border-orange-300 dark:border-orange-700',
    steps: ['bounce', 'disco_high', 'robot_arms', 'side_slide', 'star_jump', 'wave'],
  },
];

const STORAGE_PREFIX = 'sproutscale_dance_playhouse_v1_';

const DEFAULT_PROGRESS: ChildDanceProgress = {
  starsEarned: 0,
  routinesCompleted: {},
  bestFreezeStreak: 0,
  movesPracticed: 0,
  totalSessions: 0,
};

export function loadChildDanceProgress(childId: string): ChildDanceProgress {
  if (typeof window === 'undefined' || !childId) return { ...DEFAULT_PROGRESS };
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${childId}`);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<ChildDanceProgress>;
    return {
      starsEarned: typeof parsed.starsEarned === 'number' ? parsed.starsEarned : 0,
      routinesCompleted:
        parsed.routinesCompleted && typeof parsed.routinesCompleted === 'object'
          ? parsed.routinesCompleted
          : {},
      bestFreezeStreak: typeof parsed.bestFreezeStreak === 'number' ? parsed.bestFreezeStreak : 0,
      movesPracticed: typeof parsed.movesPracticed === 'number' ? parsed.movesPracticed : 0,
      totalSessions: typeof parsed.totalSessions === 'number' ? parsed.totalSessions : 0,
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveChildDanceProgress(
  childId: string,
  progress: ChildDanceProgress,
): ChildDanceProgress {
  if (typeof window !== 'undefined' && childId) {
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${childId}`, JSON.stringify(progress));
    } catch {
      // Ignore quota errors gracefully
    }
  }
  return progress;
}
