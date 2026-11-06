// Demo content for the seed. Placeholder images come from picsum.photos, seeded by
// a stable string so every page keeps the same picture.

export const DEMO_PIN = '1234';

const cover = (slug: string) => `https://picsum.photos/seed/${slug}-cover/600/800`;
export const pageImage = (slug: string, n: number) =>
  `https://picsum.photos/seed/${slug}-${n}/800/600`;

export const SEED_USERS = {
  parentA: { email: 'parent.a@example.com', name: 'Parent A', role: 'parent' },
  parentB: { email: 'parent.b@example.com', name: 'Parent B', role: 'parent' },
  parentC: { email: 'parent.c@example.com', name: 'Parent C', role: 'parent' },
  creatorSari: { email: 'sari@example.com', name: 'Sari Wulandari', role: 'creator' },
  creatorBudi: { email: 'budi@example.com', name: 'Budi Santoso', role: 'creator' },
} as const;

export const SEED_PLAN = { name: 'Monthly', priceIdr: 49_000, periodDays: 30 } as const;

export interface SeedBook {
  slug: string;
  creator: 'creatorSari' | 'creatorBudi';
  title: string;
  description: string;
  coverUrl: string;
  ageMin: number;
  ageMax: number;
  priceIdr: number;
  status: 'draft' | 'published' | 'archived';
  pages: string[];
}

const book = (b: Omit<SeedBook, 'coverUrl'>): SeedBook => ({ ...b, coverUrl: cover(b.slug) });

export const SEED_BOOKS: SeedBook[] = [
  book({
    slug: 'kiko-firefly',
    creator: 'creatorSari',
    title: 'Kiko the Little Firefly',
    description: 'Kiko is the smallest firefly in the meadow, and her light is the dimmest. Can a tiny glow still help?',
    ageMin: 3,
    ageMax: 6,
    priceIdr: 15_000,
    status: 'published',
    pages: [
      'Kiko was the smallest firefly in the whole meadow.',
      'Her light was so dim that the other fireflies giggled.',
      '"You can barely see it!" they said, and zoomed away.',
      'One night, a thick fog rolled over the meadow.',
      'The big bright lights only bounced back and made everything white.',
      'A baby bunny was lost, and she was scared.',
      'Kiko glowed softly, and the bunny saw her gentle light.',
      'Step by step, Kiko led her home. A small light is still a light.',
    ],
  }),
  book({
    slug: 'rainy-day-parade',
    creator: 'creatorSari',
    title: 'The Rainy Day Parade',
    description: 'It is raining, and the animals are bored. Then someone finds a puddle that is just right for stomping.',
    ageMin: 2,
    ageMax: 5,
    priceIdr: 15_000,
    status: 'published',
    pages: [
      'Pitter, patter, drip, drop. The rain would not stop.',
      'Little Duck looked out of the window and sighed.',
      '"Nothing to do," said Little Duck.',
      'Then she spotted a big, round puddle by the gate.',
      'Splash! One foot went in. Splash! The other followed.',
      'Piglet came with a bright red umbrella.',
      'Frog hopped along and beat a drum on a leaf.',
      'Soon there was a parade, and nobody minded the rain at all.',
    ],
  }),
  book({
    slug: 'mimi-moon-cake',
    creator: 'creatorSari',
    title: 'Mimi and the Moon Cake',
    description: 'Mimi bakes a moon cake for the full moon. But the moon looks lonely, so she plans a surprise.',
    ageMin: 4,
    ageMax: 8,
    priceIdr: 20_000,
    status: 'published',
    pages: [
      'On the night of the full moon, Mimi baked a round, golden cake.',
      'It smelled like sugar, butter and a little bit of magic.',
      'She looked up and saw the moon, big and round and all alone.',
      '"Nobody is celebrating with you," said Mimi softly.',
      'So she packed her cake and climbed the tallest hill.',
      'At the top, she cut the cake into many pieces.',
      'She shared it with the owls, the crickets and a sleepy cat.',
      'The moon glowed brighter than ever, and Mimi smiled all the way home.',
    ],
  }),
  book({
    slug: 'bobo-share',
    creator: 'creatorSari',
    title: 'Bobo Learns to Share',
    description: 'A new story about a little bear and his very favourite toy truck. Still being written.',
    ageMin: 2,
    ageMax: 4,
    priceIdr: 15_000,
    status: 'draft',
    pages: [
      'Bobo had a bright red toy truck. He loved it more than honey.',
      'When Mina came to play, Bobo hugged the truck tight.',
      '"Mine!" said Bobo. Mina looked sad.',
      'Bobo felt a funny, heavy feeling in his tummy.',
      'He thought for a moment, then held out the truck.',
      '"Let us drive it together," said Bobo.',
      'Vroom, vroom! Two friends were twice the fun.',
      'The heavy feeling went away, and the truck went round and round.',
    ],
  }),
  book({
    slug: 'sleepy-banyan',
    creator: 'creatorBudi',
    title: 'The Sleepy Banyan Tree',
    description: 'The old banyan tree is tired and wants to sleep, but the forest creatures keep asking him for help.',
    ageMin: 3,
    ageMax: 6,
    priceIdr: 20_000,
    status: 'published',
    pages: [
      'The old banyan tree yawned a very big yawn.',
      '"I would like to sleep," he whispered to the wind.',
      'But a bird asked, "Can I build my nest in your branches?"',
      'Then a squirrel asked, "May I hide my nuts in your trunk?"',
      'A little girl asked, "Can I swing from your long roots?"',
      'The banyan said yes each time, and his heart felt warm.',
      'When the moon rose, everyone curled up quietly beneath his leaves.',
      'The old tree smiled and finally fell asleep, never alone.',
    ],
  }),
  book({
    slug: 'dino-school',
    creator: 'creatorBudi',
    title: "Dino's First Day at School",
    description: 'Dino is nervous about school. His tail is too long and his legs are too stompy. Is there room for him?',
    ageMin: 3,
    ageMax: 7,
    priceIdr: 25_000,
    status: 'published',
    pages: [
      'Dino woke up with butterflies in his tummy. Today was school day.',
      'He packed his bag, and his tail knocked over the lamp.',
      '"Oops," said Dino. "I am too big for school."',
      'At the door, the teacher smiled. "We saved you a seat."',
      'The seat was big and strong, made just for Dino.',
      'In art class, his long tail was perfect for painting stripes.',
      'At playtime, his stompy legs made the best giant footprints.',
      'When mom came to pick him up, Dino said, "Can I come back tomorrow?"',
    ],
  }),
  book({
    slug: 'boat-bintang',
    creator: 'creatorBudi',
    title: 'A Boat Called Bintang',
    description: 'A little wooden boat dreams of sailing beyond the harbour and finds that the stars show the way home.',
    ageMin: 4,
    ageMax: 8,
    priceIdr: 25_000,
    status: 'published',
    pages: [
      'Bintang was a little wooden boat who lived by the harbour.',
      'Every night she watched the stars blink over the water.',
      '"I wish I could sail out there," she said.',
      'One calm evening, a fisherman untied her rope.',
      'Bintang drifted past the lighthouse and past the sleepy fish.',
      'The sea grew wide, and she began to feel very small.',
      'Then she looked up. The stars made a path of silver light.',
      'Bintang followed the glow and found her way home, full of stories.',
    ],
  }),
  book({
    slug: 'lost-kite',
    creator: 'creatorBudi',
    title: 'The Lost Kite',
    description: 'A kite slips off its string and goes on an adventure across the village roofs.',
    ageMin: 2,
    ageMax: 5,
    priceIdr: 15_000,
    status: 'archived',
    pages: [
      'Rani held the string of her red kite very tight.',
      'A big gust of wind came, and whoosh, the string slipped away.',
      'The kite flew over the rooftops and past the market.',
      'It waved at the baker, the cat and the sleepy dog.',
      'It danced between the clouds, higher and higher.',
      'At last the wind grew gentle and the kite floated down.',
      'It landed softly in Rani\'s own garden.',
      'Rani hugged her kite. "Welcome home," she whispered.',
    ],
  }),
];
