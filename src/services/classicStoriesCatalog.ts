import { SavedStorybook, StorybookMode, StorybookPage } from './storybookService';

export interface ClassicStoryTemplate {
  slug: string;
  title: string;
  subtitle: string;
  category: 'Fairy Tale' | 'Nursery Rhyme' | 'Fable' | 'Folk Tale';
  mode: StorybookMode;
  keywords: string[];
  pages: StorybookPage[];
  conversationPrompt: string;
  closingLine: string;
}

export const CLASSIC_STORIES_CATALOG: ClassicStoryTemplate[] = [
  {
    slug: 'three-little-pigs',
    title: 'The Three Little Pigs',
    subtitle: 'Classic Fairy Tale Read-Along',
    category: 'Fairy Tale',
    mode: 'daytime',
    keywords: ['three', 'little', 'pigs', 'wolf', 'straw', 'sticks', 'bricks', 'huff', 'puff', 'fairy tale'],
    pages: [
      {
        pageNumber: 1,
        heading: 'Three Little Pigs Set Out',
        text: 'Once upon a sunny morning, three little pigs set out to build their very own cozy homes. Each little pig picked a different plan and went right to work!',
        sceneMood: 'sunny',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 2,
        heading: 'The House of Straw',
        text: 'The first little pig built a quick house out of golden straw. Soon a big gray wolf knocked on the door. He huffed, and he puffed, and whoosh! Away blew the straw house!',
        sceneMood: 'playful',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 3,
        heading: 'The House of Sticks',
        text: 'The first pig ran fast to the second little pig’s house made of wooden sticks. The wolf huffed, and he puffed, and rattle-rattle-clatter! Down tumbled the stick house too!',
        sceneMood: 'playful',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 4,
        heading: 'The Sturdy Brick House',
        text: 'Both little pigs hurried inside the third little pig’s strong house of red bricks. The wolf huffed and he puffed as hard as he could, but the sturdy brick house did not budge an inch!',
        sceneMood: 'wonder',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 5,
        heading: 'Safe and Happy Together',
        text: 'At last the tired wolf trotted far away into the woods. The three little pigs danced, laughed, and shared a warm bowl of soup inside their strong brick home.',
        sceneMood: 'sunny',
        usePhotoIndex: -1,
      },
    ],
    conversationPrompt: 'Which house was the strongest — straw, sticks, or bricks?',
    closingLine: 'Working patiently and helping each other keeps everyone safe and happy!',
  },
  {
    slug: 'itsy-bitsy-spider',
    title: 'The Itsy Bitsy Spider',
    subtitle: 'Classic Nursery Rhyme Read-Along',
    category: 'Nursery Rhyme',
    mode: 'daytime',
    keywords: ['itsy', 'bitsy', 'incy', 'wincy', 'spider', 'rain', 'water', 'spout', 'sun', 'nursery', 'rhyme', 'song'],
    pages: [
      {
        pageNumber: 1,
        heading: 'Up the Water Spout',
        text: 'The itsy bitsy spider climbed up the water spout! Tip-tap, tip-tap went eight tiny spider feet, climbing higher and higher toward the bright blue sky.',
        sceneMood: 'sunny',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 2,
        heading: 'Down Came the Rain',
        text: 'Suddenly, fluffy gray clouds drifted overhead. Pitter-patter, splash! Down came the rain and washed the little spider all the way back down the spout!',
        sceneMood: 'playful',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 3,
        heading: 'Out Came the Sun',
        text: 'The little spider shook off the raindrops and looked up with hope. Then out came the warm golden sun and dried up all the rain!',
        sceneMood: 'wonder',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 4,
        heading: 'Try, Try Again!',
        text: 'Did the little spider give up? No way! The itsy bitsy spider climbed up the spout again — step by step, wiggly leg by wiggly leg!',
        sceneMood: 'playful',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 5,
        heading: 'Right to the Very Top',
        text: 'Hooray! At the top of the sunny spout, the proud little spider waved hello to a passing butterfly. Trying again makes even tiny explorers brave and strong!',
        sceneMood: 'sunny',
        usePhotoIndex: -1,
      },
    ],
    conversationPrompt: 'Can you wiggle your fingers like the itsy bitsy spider climbing up the spout?',
    closingLine: 'When the rain clears and the sun shines, we can always try again!',
  },
  {
    slug: 'goldilocks-three-bears',
    title: 'Goldilocks and the Three Bears',
    subtitle: 'Classic Fairy Tale Read-Along',
    category: 'Fairy Tale',
    mode: 'daytime',
    keywords: ['goldilocks', 'three', 'bears', 'porridge', 'chair', 'bed', 'mama', 'papa', 'baby', 'bear'],
    pages: [
      {
        pageNumber: 1,
        heading: 'A Cottage in the Woods',
        text: 'Deep in a sunny green forest stood a cozy wooden cottage where Papa Bear, Mama Bear, and Baby Bear lived. One morning they went for a walk while their warm porridge cooled.',
        sceneMood: 'sunny',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 2,
        heading: 'Three Bowls of Porridge',
        text: 'Curious little Goldilocks peeked inside and saw three bowls. Papa Bear’s porridge was too hot! Mama Bear’s was too cold! Baby Bear’s little bowl was just right!',
        sceneMood: 'playful',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 3,
        heading: 'Three Cozy Chairs',
        text: 'Next, Goldilocks tried three chairs in the living room. The big chair was too tall, the medium chair was too soft, and the tiny chair was just right — until creak, pop! It tipped right over.',
        sceneMood: 'playful',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 4,
        heading: 'Three Fluffy Beds',
        text: 'Upstairs, Goldilocks felt sleepy. One bed was too hard, one bed was too bumpy, and the cozy little bed was just right for a quick nap.',
        sceneMood: 'cozy',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 5,
        heading: 'A Polite Goodbye',
        text: 'When the three bears came home and found Goldilocks awake, she said sorry for wandering in uninvited and skipped safely back home to her own family.',
        sceneMood: 'sunny',
        usePhotoIndex: -1,
      },
    ],
    conversationPrompt: 'Which bowl of porridge did Goldilocks like best — too hot, too cold, or just right?',
    closingLine: 'Asking before borrowing is always the kindest way!',
  },
  {
    slug: 'tortoise-and-the-hare',
    title: 'The Tortoise and the Hare',
    subtitle: 'Aesop’s Classic Fable Read-Along',
    category: 'Fable',
    mode: 'daytime',
    keywords: ['tortoise', 'hare', 'turtle', 'rabbit', 'bunny', 'race', 'slow', 'steady', 'aesop', 'fable'],
    pages: [
      {
        pageNumber: 1,
        heading: 'Ready, Set, Go!',
        text: 'A speedy hare loved to brag about how fast he could hop. One bright day, a calm little tortoise smiled and said, Let us have a friendly race to the big oak tree!',
        sceneMood: 'sunny',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 2,
        heading: 'Zoom Goes the Hare',
        text: 'On your mark, get set, go! Zoom, zoom, zoom! The hare dashed far ahead in a cloud of dust while the tortoise took one steady little step at a time.',
        sceneMood: 'playful',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 3,
        heading: 'A Shady Nap',
        text: 'The hare looked back and could barely see the tortoise. I have plenty of time, yawned the hare. He curled up under a shady clover patch and fell fast asleep.',
        sceneMood: 'cozy',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 4,
        heading: 'Step by Steady Step',
        text: 'Clump, clump, step, step! The little tortoise did not stop to brag or nap. He kept walking right past the sleeping hare toward the bright red finish ribbon.',
        sceneMood: 'wonder',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 5,
        heading: 'Slow and Steady Wins!',
        text: 'The hare woke up and hopped as fast as he could, but hooray! The tortoise crossed the finish line first! Both friends cheered and shook hands.',
        sceneMood: 'sunny',
        usePhotoIndex: -1,
      },
    ],
    conversationPrompt: 'Why did the slow little tortoise win the race?',
    closingLine: 'Slow and steady wins the race — keep going one step at a time!',
  },
  {
    slug: 'jack-and-the-beanstalk',
    title: 'Jack and the Beanstalk',
    subtitle: 'Classic Adventure Fairy Tale',
    category: 'Fairy Tale',
    mode: 'daytime',
    keywords: ['jack', 'beanstalk', 'magic', 'beans', 'giant', 'clouds', 'harp', 'castle', 'climb'],
    pages: [
      {
        pageNumber: 1,
        heading: 'Five Magic Beans',
        text: 'Once upon a time, a curious boy named Jack traded for five sparkling magic beans. He planted them by his window before going to sleep.',
        sceneMood: 'wonder',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 2,
        heading: 'Up Into the Clouds',
        text: 'The very next morning, wow! A giant twisted green beanstalk had grown all the way up past the fluffy white clouds! Jack started to climb up, up, up!',
        sceneMood: 'sunny',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 3,
        heading: 'The Cloud Castle',
        text: 'At the top of the sky sat an enormous castle with giant chairs and giant teacups. Inside, Jack heard a magical golden harp playing the sweetest gentle song.',
        sceneMood: 'wonder',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 4,
        heading: 'Fee-Fi-Fo-Fum!',
        text: 'Boom, boom, boom went giant footsteps down the hall! Jack tiptoed lightly as a mouse, waved to the friendly cloud birds, and hurried back to the giant green vine.',
        sceneMood: 'playful',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 5,
        heading: 'Back Home Safely',
        text: 'Down, down, down Jack slid until his feet touched the soft green grass of home. What a big, brave adventure in the sky!',
        sceneMood: 'sunny',
        usePhotoIndex: -1,
      },
    ],
    conversationPrompt: 'If you climbed a giant beanstalk into the clouds, what would you hope to see?',
    closingLine: 'Big imagination can take you all the way up to the clouds!',
  },
  {
    slug: 'gingerbread-man',
    title: 'The Gingerbread Man',
    subtitle: 'Classic Folk Tale Read-Along',
    category: 'Folk Tale',
    mode: 'daytime',
    keywords: ['gingerbread', 'man', 'cookie', 'run', 'fast', 'oven', 'bake', 'fox', 'folk tale'],
    pages: [
      {
        pageNumber: 1,
        heading: 'Warm From the Oven',
        text: 'One cozy morning, a cheerful baker made a smiling gingerbread cookie with bright raisin eyes and candy buttons. When the oven door opened, hop! Out jumped the Gingerbread Man!',
        sceneMood: 'sunny',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 2,
        heading: 'Run, Run as Fast as You Can!',
        text: 'Out through the garden gate he zipped, laughing happily. Run, run, as fast as you can! You cannot catch me, I am the Gingerbread Man!',
        sceneMood: 'playful',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 3,
        heading: 'Past the Cow and the Horse',
        text: 'He zoomed past a spotted cow in the clover and a friendly brown horse by the red barn. Moo and neigh! Everyone joined the silly meadow chase!',
        sceneMood: 'playful',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 4,
        heading: 'Down by the Sparkling Stream',
        text: 'Soon the Gingerbread Man reached a cool blue stream with stepping stones. A clever little fox offered a ride, so the Gingerbread Man hopped carefully from stone to stone instead!',
        sceneMood: 'wonder',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 5,
        heading: 'A Sweet Meadow Picnic',
        text: 'Across the stream, the Gingerbread Man waved to all his new barnyard friends and invited everyone to share warm cinnamon treats in the sunshine!',
        sceneMood: 'sunny',
        usePhotoIndex: -1,
      },
    ],
    conversationPrompt: 'Can you say the Gingerbread Man’s silly rhyme out loud together?',
    closingLine: 'Run, laugh, and share a smile with your friends today!',
  },
  {
    slug: 'old-macdonald',
    title: 'Old MacDonald Had a Farm',
    subtitle: 'Animal Sounds Read-Along Rhyme',
    category: 'Nursery Rhyme',
    mode: 'daytime',
    keywords: ['old', 'macdonald', 'mcdonald', 'farm', 'cow', 'moo', 'duck', 'quack', 'pig', 'oink', 'sheep', 'animal', 'song'],
    pages: [
      {
        pageNumber: 1,
        heading: 'Welcome to the Sunny Farm',
        text: 'Old MacDonald had a farm, E-I-E-I-O! On his bright red barn sat a shiny rooster ready to say hello to every animal friend.',
        sceneMood: 'sunny',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 2,
        heading: 'The Friendly Spotted Cow',
        text: 'And on that farm he had a cow, E-I-E-I-O! With a moo-moo here, and a moo-moo there, here a moo, there a moo, everywhere a moo-moo!',
        sceneMood: 'playful',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 3,
        heading: 'The Splashing Yellow Duck',
        text: 'And on that farm he had a duck, E-I-E-I-O! With a quack-quack here, and a quack-quack there, splashing happily in the shiny blue pond!',
        sceneMood: 'playful',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 4,
        heading: 'The Wiggly Pink Pig',
        text: 'And on that farm he had a pig, E-I-E-I-O! With an oink-oink here, and an oink-oink there, wiggling a curly pink tail in the grass!',
        sceneMood: 'playful',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 5,
        heading: 'The Fluffy White Sheep',
        text: 'And on that farm he had a sheep, E-I-E-I-O! With a baa-baa here, and a baa-baa there. Moo, quack, oink, baa — what a happy farm chorus!',
        sceneMood: 'sunny',
        usePhotoIndex: -1,
      },
    ],
    conversationPrompt: 'Which farm animal sound is your favorite to make — moo, quack, oink, or baa?',
    closingLine: 'E-I-E-I-O! Great job reading along with all the farm friends!',
  },
  {
    slug: 'twinkle-little-star-lullaby',
    title: 'Twinkle, Twinkle, Little Star',
    subtitle: 'Classic Bedtime Lullaby Read-Along',
    category: 'Nursery Rhyme',
    mode: 'bedtime',
    keywords: ['twinkle', 'little', 'star', 'lullaby', 'bedtime', 'moon', 'sleep', 'night', 'diamond', 'sky', 'nursery'],
    pages: [
      {
        pageNumber: 1,
        heading: 'Sparkling High Above',
        text: 'Twinkle, twinkle, little star, how I wonder what you are! Up above the world so high, like a sparkling diamond in the quiet evening sky.',
        sceneMood: 'wonder',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 2,
        heading: 'When the Bright Sun Goes',
        text: 'When the golden sun is gone, and the soft dark night comes on, then you show your tiny light, twinkle, twinkle, all the night.',
        sceneMood: 'cozy',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 3,
        heading: 'A Cozy Silver Glow',
        text: 'Softly through the bedroom window shines a gentle silver beam. Every toy is tucked away, resting quietly for a peaceful dream.',
        sceneMood: 'cozy',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 4,
        heading: 'Shining Through the Night',
        text: 'Slowly blink your sleepy eyes while the friendly moon smiles bright. Watching gently from above until the warm morning light.',
        sceneMood: 'sleepy',
        usePhotoIndex: -1,
      },
      {
        pageNumber: 5,
        heading: 'Goodnight, Little Star',
        text: 'Twinkle, twinkle, little star, safe and cozy where you are. Snuggle tight beneath your quilt and drift off to sweet, happy dreams.',
        sceneMood: 'sleepy',
        usePhotoIndex: -1,
      },
    ],
    conversationPrompt: 'Can you make twinkling star fingers with your hands before closing your eyes?',
    closingLine: 'Goodnight, little star — sleep peacefully until morning.',
  },
];

export function instantiateClassicStoryForChild(
  template: ClassicStoryTemplate,
  params: {
    childId: string;
    childName: string;
    ageMonths: number;
    storyDate: string;
  },
): SavedStorybook {
  const safeName = params.childName.trim() || 'Sprout';
  return {
    id: `classic_${template.slug}_${params.childId}`,
    childId: params.childId,
    childName: safeName,
    ageMonths: params.ageMonths,
    mode: template.mode,
    storyDate: params.storyDate,
    title: template.title,
    subtitle: template.subtitle,
    dedication: `Downloaded for ${safeName} — follow the glowing words as we read together!`,
    pages: template.pages,
    conversationPrompt: `${template.conversationPrompt} What do you think, ${safeName}?`,
    closingLine: template.closingLine,
    photoIds: [],
    todayPrompt: `Classic Read-Along: ${template.title}`,
    createdAtMs: Date.now(),
  };
}

export function searchClassicCatalog(query: string): ClassicStoryTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return CLASSIC_STORIES_CATALOG;
  const terms = q.split(/\s+/).filter(Boolean);
  return CLASSIC_STORIES_CATALOG.filter((item) => {
    const haystack = `${item.title} ${item.subtitle} ${item.category} ${item.keywords.join(' ')}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}
