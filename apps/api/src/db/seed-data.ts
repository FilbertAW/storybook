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
  status: 'published' | 'archived';
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

// Indonesian versions of the seed books, keyed by slug. The books above stay in their
// original language (English); anything missing here falls back to it.
export interface SeedTranslation {
  title: string;
  description: string;
  pages: string[];
}

export const SEED_TRANSLATIONS_ID: Record<string, SeedTranslation> = {
  'kiko-firefly': {
    title: 'Kiko si Kunang-kunang Kecil',
    description:
      'Kiko adalah kunang-kunang terkecil di padang rumput, dan cahayanya paling redup. Bisakah cahaya kecil tetap menolong?',
    pages: [
      'Kiko adalah kunang-kunang terkecil di seluruh padang rumput.',
      'Cahayanya begitu redup sampai kunang-kunang lain tertawa cekikikan.',
      '"Hampir tidak kelihatan!" kata mereka, lalu melesat pergi.',
      'Suatu malam, kabut tebal menyelimuti padang rumput.',
      'Cahaya besar yang terang hanya memantul dan membuat semuanya serba putih.',
      'Seekor anak kelinci tersesat, dan ia ketakutan.',
      'Kiko bersinar lembut, dan si kelinci melihat cahayanya yang hangat.',
      'Selangkah demi selangkah, Kiko mengantarnya pulang. Cahaya kecil tetaplah cahaya.',
    ],
  },
  'rainy-day-parade': {
    title: 'Parade Hari Hujan',
    description:
      'Hujan turun, dan para hewan bosan. Lalu seseorang menemukan genangan yang pas sekali untuk diinjak-injak.',
    pages: [
      'Tik, tik, tik, tes, tes. Hujan tak mau berhenti.',
      'Bebek Kecil menatap keluar jendela dan menghela napas.',
      '"Tidak ada yang bisa dilakukan," kata Bebek Kecil.',
      'Lalu ia melihat genangan besar dan bulat di dekat pagar.',
      'Cebur! Satu kaki masuk. Cebur! Kaki yang lain menyusul.',
      'Anak Babi datang membawa payung merah yang cerah.',
      'Kodok melompat datang dan menabuh daun seperti gendang.',
      'Tak lama kemudian ada parade, dan tak seorang pun peduli pada hujan.',
    ],
  },
  'mimi-moon-cake': {
    title: 'Mimi dan Kue Bulan',
    description:
      'Mimi memanggang kue bulan untuk bulan purnama. Tetapi bulan tampak kesepian, jadi ia menyiapkan kejutan.',
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
  },
  'sleepy-banyan': {
    title: 'Pohon Beringin yang Mengantuk',
    description:
      'Pohon beringin tua itu lelah dan ingin tidur, tetapi para penghuni hutan terus meminta tolong kepadanya.',
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
  },
  'dino-school': {
    title: 'Hari Pertama Dino di Sekolah',
    description:
      'Dino gugup pergi ke sekolah. Ekornya terlalu panjang dan kakinya terlalu menghentak. Adakah tempat untuknya?',
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
  },
  'boat-bintang': {
    title: 'Perahu Bernama Bintang',
    description:
      'Sebuah perahu kayu kecil bermimpi berlayar melewati pelabuhan dan menemukan bahwa bintang-bintang menunjukkan jalan pulang.',
    pages: [
      'Bintang adalah perahu kayu kecil yang tinggal di dekat pelabuhan.',
      'Setiap malam ia memandangi bintang-bintang berkedip di atas air.',
      '"Andai aku bisa berlayar ke sana," katanya.',
      'Pada suatu sore yang tenang, seorang nelayan melepaskan talinya.',
      'Bintang hanyut melewati mercusuar dan ikan-ikan yang mengantuk.',
      'Laut makin luas, dan ia mulai merasa sangat kecil.',
      'Lalu ia menengadah. Bintang-bintang membentuk jalan dari cahaya perak.',
      'Bintang mengikuti cahaya itu dan menemukan jalan pulang, penuh cerita.',
    ],
  },
  'lost-kite': {
    title: 'Layang-layang yang Hilang',
    description: 'Sebuah layang-layang terlepas dari talinya dan berpetualang melintasi atap-atap desa.',
    pages: [
      'Rani memegang tali layang-layang merahnya erat-erat.',
      'Angin kencang datang, dan wuss, talinya terlepas.',
      'Layang-layang itu terbang melewati atap rumah dan pasar.',
      'Ia melambai pada tukang roti, kucing, dan anjing yang mengantuk.',
      'Ia menari di antara awan, makin lama makin tinggi.',
      'Akhirnya angin mereda dan layang-layang melayang turun.',
      'Ia mendarat dengan lembut di kebun Rani sendiri.',
      'Rani memeluk layang-layangnya. "Selamat datang kembali," bisiknya.',
    ],
  },
};
