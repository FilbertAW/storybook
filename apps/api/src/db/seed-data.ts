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
  language: 'id' | 'en';
  ageMin: number;
  ageMax: number;
  priceIdr: number;
  status: 'published' | 'archived';
  pages: string[];
}

const book = (b: Omit<SeedBook, 'coverUrl'>): SeedBook => ({ ...b, coverUrl: cover(b.slug) });

// Books are written in one language each; the catalog is a mix of English and Indonesian.
export const SEED_BOOKS: SeedBook[] = [
  book({
    slug: 'kiko-firefly',
    creator: 'creatorSari',
    language: 'en',
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
    language: 'en',
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
    language: 'id',
    title: 'Mimi dan Kue Bulan',
    description: 'Mimi memanggang kue bulan untuk bulan purnama. Tetapi bulan tampak kesepian, jadi ia menyiapkan kejutan.',
    ageMin: 4,
    ageMax: 8,
    priceIdr: 20000,
    status: 'published',
    pages: [
      'Pada malam bulan purnama, Mimi memanggang kue bundar berwarna keemasan.',
      'Baunya seperti gula, mentega, dan sedikit sihir.',
      'Ia menengadah dan melihat bulan, besar, bulat, dan sendirian.',
      '"Tidak ada yang merayakan bersamamu," kata Mimi pelan.',
      'Maka ia membawa kuenya dan mendaki bukit tertinggi.',
      'Di puncak, ia memotong kue itu menjadi banyak bagian.',
      'Ia membaginya dengan burung hantu, jangkrik, dan seekor kucing yang mengantuk.',
      'Bulan bersinar lebih terang dari sebelumnya, dan Mimi tersenyum sepanjang jalan pulang.',
    ],
  }),
  book({
    slug: 'sleepy-banyan',
    creator: 'creatorBudi',
    language: 'id',
    title: 'Pohon Beringin yang Mengantuk',
    description: 'Pohon beringin tua itu lelah dan ingin tidur, tetapi para penghuni hutan terus meminta tolong kepadanya.',
    ageMin: 3,
    ageMax: 6,
    priceIdr: 20000,
    status: 'published',
    pages: [
      'Pohon beringin tua itu menguap lebar sekali.',
      '"Aku ingin tidur," bisiknya pada angin.',
      'Tetapi seekor burung bertanya, "Bolehkah aku membuat sarang di dahanmu?"',
      'Lalu seekor tupai bertanya, "Bolehkah aku menyimpan kacangku di batangmu?"',
      'Seorang gadis kecil bertanya, "Bolehkah aku berayun di akar panjangmu?"',
      'Setiap kali, beringin menjawab ya, dan hatinya terasa hangat.',
      'Ketika bulan terbit, semua meringkuk tenang di bawah daunnya.',
      'Pohon tua itu tersenyum dan akhirnya tertidur, tidak pernah sendirian.',
    ],
  }),
  book({
    slug: 'dino-school',
    creator: 'creatorBudi',
    language: 'id',
    title: 'Hari Pertama Dino di Sekolah',
    description: 'Dino gugup pergi ke sekolah. Ekornya terlalu panjang dan kakinya terlalu menghentak. Adakah tempat untuknya?',
    ageMin: 3,
    ageMax: 7,
    priceIdr: 25000,
    status: 'published',
    pages: [
      'Dino bangun dengan perut berdebar-debar. Hari ini hari sekolah.',
      'Ia mengemas tasnya, dan ekornya menyenggol lampu hingga jatuh.',
      '"Aduh," kata Dino. "Aku terlalu besar untuk sekolah."',
      'Di pintu, guru tersenyum. "Kami sudah menyiapkan tempat duduk untukmu."',
      'Kursinya besar dan kuat, dibuat khusus untuk Dino.',
      'Di pelajaran seni, ekornya yang panjang pas sekali untuk melukis garis-garis.',
      'Saat bermain, kakinya yang menghentak membuat jejak raksasa yang paling keren.',
      'Ketika ibu datang menjemput, Dino bertanya, "Boleh aku kembali besok?"',
    ],
  }),
  book({
    slug: 'boat-bintang',
    creator: 'creatorBudi',
    language: 'en',
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
    language: 'en',
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
