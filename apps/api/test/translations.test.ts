import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { bookPageTranslations, bookTranslations } from '../src/db/schema';
import { parseLocale } from '../src/shared/locale';
import { buildTestApp, newBook, type TestApp } from './helpers';

const PARENT_A = 'parent.a@example.com'; // owns Kiko, everything else is locked
const SARI = 'sari@example.com';
const KIKO = 'Kiko the Little Firefly';
const KIKO_ID = 'Kiko si Kunang-kunang Kecil';
const RAINY = 'The Rainy Day Parade'; // locked for parent A, 2 preview pages

const ID = { 'Accept-Language': 'id' };

let t: TestApp;
let parent: string;

beforeEach(async () => {
  t = await buildTestApp();
  parent = await t.login(PARENT_A);
});

const titles = (body: { books: Array<{ title: string }> }) => body.books.map((b) => b.title);

describe('parseLocale', () => {
  it('picks the first language we have, and falls back to the original', () => {
    expect(parseLocale('id')).toBe('id');
    expect(parseLocale('id-ID,id;q=0.9,en;q=0.8')).toBe('id');
    expect(parseLocale('en-US,en;q=0.9,id;q=0.8')).toBe('en');
    expect(parseLocale('fr-FR,id;q=0.5')).toBe('id');
    expect(parseLocale('fr-FR')).toBe('en');
    expect(parseLocale(undefined)).toBe('en');
  });
});

describe('book list and detail', () => {
  it('serves the original text without an Accept-Language header', async () => {
    const res = await t.request('/books', { token: parent });
    expect(titles(res.body)).toContain(KIKO);
    expect(titles(res.body)).not.toContain(KIKO_ID);
  });

  it('serves Indonesian titles and descriptions for Accept-Language: id', async () => {
    const res = await t.request('/books', { token: parent, headers: ID });
    expect(titles(res.body)).toContain(KIKO_ID);
    expect(titles(res.body)).not.toContain(KIKO);
    expect(res.body.books.every((b: { description: string }) => !/\bthe\b/i.test(b.description))).toBe(true);
  });

  it('keeps English when the header asks for English or an unknown language', async () => {
    for (const lang of ['en', 'fr']) {
      const res = await t.request('/books', { token: parent, headers: { 'Accept-Language': lang } });
      expect(titles(res.body), lang).toContain(KIKO);
    }
  });

  it('translates the detail response too, and changes nothing else', async () => {
    const id = await t.bookId(KIKO);
    const en = (await t.request(`/books/${id}`, { token: parent })).body;
    const idr = (await t.request(`/books/${id}`, { token: parent, headers: ID })).body;
    expect(idr.title).toBe(KIKO_ID);
    expect(idr.description).not.toBe(en.description);
    expect({ ...idr, title: en.title, description: en.description }).toEqual(en);
  });

  it('leaves the author name alone', async () => {
    const id = await t.bookId(KIKO);
    const res = await t.request(`/books/${id}`, { token: parent, headers: ID });
    expect(res.body.authorName).toBe('Sari Wulandari');
  });

  it('translates for a kid token as well', async () => {
    const kid = await t.kidToken(PARENT_A);
    const res = await t.request('/books', { token: kid, headers: ID });
    expect(titles(res.body)).toEqual([KIKO_ID]);
  });
});

describe('search', () => {
  it('finds a book by its Indonesian title in Indonesian, but not in English', async () => {
    const inId = await t.request('/books?q=kunang', { token: parent, headers: ID });
    expect(titles(inId.body)).toEqual([KIKO_ID]);
    const inEn = await t.request('/books?q=kunang', { token: parent });
    expect(inEn.body.books).toEqual([]);
  });

  it('still finds a book by its original title in Indonesian', async () => {
    const res = await t.request('/books?q=firefly', { token: parent, headers: ID });
    expect(titles(res.body)).toEqual([KIKO_ID]);
  });
});

describe('pages', () => {
  it('translates the pages a reader may see', async () => {
    const id = await t.bookId(KIKO);
    const en = (await t.request(`/books/${id}/pages`, { token: parent })).body;
    const idr = (await t.request(`/books/${id}/pages`, { token: parent, headers: ID })).body;
    expect(idr.pages).toHaveLength(en.pages.length);
    expect(idr.pages[0].text).toBe('Kiko adalah kunang-kunang terkecil di seluruh padang rumput.');
    expect(idr.pages.map((p: { imageUrl: string }) => p.imageUrl)).toEqual(en.pages.map((p: { imageUrl: string }) => p.imageUrl));
  });

  it('translates a single page', async () => {
    const id = await t.bookId(KIKO);
    const res = await t.request(`/books/${id}/pages/2`, { token: parent, headers: ID });
    expect(res.body.page.text).toBe('Cahayanya begitu redup sampai kunang-kunang lain tertawa cekikikan.');
  });

  it('still shows only the preview pages in Indonesian, and refuses the rest', async () => {
    const id = await t.bookId(RAINY);
    const pages = (await t.request(`/books/${id}/pages`, { token: parent, headers: ID })).body;
    expect(pages.pages).toHaveLength(2);
    expect(pages.lockedFrom).toBe(3);
    const locked = await t.request(`/books/${id}/pages/3`, { token: parent, headers: ID });
    expect(locked.status).toBe(403);
  });
});

describe('a book without a translation', () => {
  it('falls back to the original text in Indonesian', async () => {
    const sari = await t.login(SARI);
    const created = await t.request('/books', { method: 'POST', token: sari, json: newBook({ title: 'Brand New Story' }) });
    const id = created.body.id as string;
    const detail = await t.request(`/books/${id}`, { token: parent, headers: ID });
    expect(detail.body.title).toBe('Brand New Story');
    const pages = await t.request(`/books/${id}/pages`, { token: parent, headers: ID });
    expect(pages.body.pages[0].text).toBe(created.body.pages[0].text);
  });
});

describe('editing a book', () => {
  let sari: string;
  let id: string;
  const countTitles = async () => (await t.db.select().from(bookTranslations).where(eq(bookTranslations.bookId, id))).length;
  const countPages = async () => (await t.db.select().from(bookPageTranslations)).length;

  beforeEach(async () => {
    sari = await t.login(SARI);
    id = await t.bookId(KIKO);
  });

  const current = async () => (await t.request(`/books/${id}`, { token: sari })).body;
  const pagesNow = async () =>
    (await t.request(`/books/${id}/pages`, { token: sari })).body.pages as Array<{ text: string; imageUrl: string }>;

  it('keeps the translations when the words are unchanged', async () => {
    const before = await countPages();
    const book = await current();
    const pages = await pagesNow();
    const res = await t.request(`/books/${id}`, {
      method: 'PATCH',
      token: sari,
      json: { title: book.title, description: book.description, priceIdr: 18_000, pages },
    });
    expect(res.status).toBe(200);
    expect(await countTitles()).toBe(1);
    expect(await countPages()).toBe(before);
    const idr = await t.request(`/books/${id}`, { token: parent, headers: ID });
    expect(idr.body.title).toBe(KIKO_ID);
  });

  it('keeps page translations when only an image changes', async () => {
    const before = await countPages();
    const pages = await pagesNow();
    pages[0]!.imageUrl = 'https://example.com/new.png';
    await t.request(`/books/${id}`, { method: 'PATCH', token: sari, json: { pages } });
    expect(await countPages()).toBe(before);
    const idr = await t.request(`/books/${id}/pages/1`, { token: parent, headers: ID });
    expect(idr.body.page.imageUrl).toBe('https://example.com/new.png');
    expect(idr.body.page.text).toContain('kunang-kunang');
  });

  it('drops the title translation when the title changes, and shows the new title', async () => {
    await t.request(`/books/${id}`, { method: 'PATCH', token: sari, json: { title: 'Kiko Shines' } });
    expect(await countTitles()).toBe(0);
    const idr = await t.request(`/books/${id}`, { token: parent, headers: ID });
    expect(idr.body.title).toBe('Kiko Shines');
  });

  it('drops the page translations when the page text changes', async () => {
    const pages = await pagesNow();
    pages[0]!.text = 'A new first page.';
    await t.request(`/books/${id}`, { method: 'PATCH', token: sari, json: { pages } });
    const idr = await t.request(`/books/${id}/pages/1`, { token: parent, headers: ID });
    expect(idr.body.page.text).toBe('A new first page.');
  });

  it('removes translations with the book', async () => {
    const fresh = await t.request('/books', { method: 'POST', token: sari, json: newBook() });
    const res = await t.request(`/books/${fresh.body.id}`, { method: 'DELETE', token: sari });
    expect(res.body.result).toBe('deleted');
  });
});

describe('order history', () => {
  it('shows the book title in the reader language', async () => {
    const en = await t.request('/orders', { token: parent });
    const idr = await t.request('/orders', { token: parent, headers: ID });
    expect(en.body.orders.map((o: { bookTitle: string }) => o.bookTitle)).toEqual([KIKO]);
    expect(idr.body.orders.map((o: { bookTitle: string }) => o.bookTitle)).toEqual([KIKO_ID]);
  });
});

describe('creators entering the Indonesian version', () => {
  let sari: string;
  const GECKO_ID = {
    title: 'Cicak Kecil yang Berani',
    description: 'Seekor cicak menemukan keberanian pada malam yang berbadai.',
    pages: ['Cicak tinggal di balik jam dapur.', 'Suatu malam, guntur datang.'],
  };

  beforeEach(async () => {
    sari = await t.login(SARI);
  });

  const create = (translations?: unknown, extra: Record<string, unknown> = {}) =>
    t.request('/books', { method: 'POST', token: sari, json: newBook({ ...(translations ? { translations } : {}), ...extra }) });

  it('saves a translation with a new book and shows it to Indonesian readers', async () => {
    const created = await create({ id: GECKO_ID });
    expect(created.status).toBe(201);
    expect(created.body.translations.id).toEqual(GECKO_ID);

    const detail = await t.request(`/books/${created.body.id}`, { token: parent, headers: ID });
    expect(detail.body.title).toBe(GECKO_ID.title);
    expect(detail.body.description).toBe(GECKO_ID.description);
    const pages = await t.request(`/books/${created.body.id}/pages`, { token: parent, headers: ID });
    expect(pages.body.pages.map((p: { text: string }) => p.text)).toEqual(GECKO_ID.pages);
  });

  it('has no translation block content for a book created without one', async () => {
    const created = await create();
    expect(created.body.translations).toEqual({ id: null });
  });

  it('gives the creator the original text from their own endpoint, in any language', async () => {
    const created = await create({ id: GECKO_ID });
    const res = await t.request(`/creator/books/${created.body.id}`, { token: sari, headers: ID });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('The Brave Little Gecko');
    expect(res.body.pages[0].text).toBe('Gecko lived behind the kitchen clock.');
    expect(res.body.translations.id).toEqual(GECKO_ID);
  });

  it('keeps that endpoint to the book’s own creator', async () => {
    const id = await t.bookId(KIKO);
    expect((await t.request(`/creator/books/${id}`, { token: await t.login('budi@example.com') })).status).toBe(404);
    expect((await t.request(`/creator/books/${id}`, { token: parent })).status).toBe(403);
  });

  it('lets a translation cover only some pages; the rest fall back', async () => {
    const created = await create({ id: { ...GECKO_ID, pages: ['Cicak tinggal di balik jam dapur.', ''] } });
    const pages = await t.request(`/books/${created.body.id}/pages`, { token: parent, headers: ID });
    expect(pages.body.pages.map((p: { text: string }) => p.text)).toEqual([
      'Cicak tinggal di balik jam dapur.',
      'One night the thunder came.',
    ]);
  });

  it('accepts a title and description translation without any page text', async () => {
    const created = await create({ id: { ...GECKO_ID, pages: [] } });
    expect(created.status).toBe(201);
    const detail = await t.request(`/books/${created.body.id}`, { token: parent, headers: ID });
    expect(detail.body.title).toBe(GECKO_ID.title);
  });

  it('rejects a title without a description (and the reverse), and a wrong number of page texts', async () => {
    expect((await create({ id: { ...GECKO_ID, description: '' } })).status).toBe(400);
    expect((await create({ id: { ...GECKO_ID, title: '' } })).status).toBe(400);
    const wrong = await create({ id: { ...GECKO_ID, pages: ['only one'] } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('replaces a translation on update, and clears it when the fields are empty', async () => {
    const created = await create({ id: GECKO_ID });
    const id = created.body.id as string;
    const changed = { ...GECKO_ID, title: 'Cicak Pemberani' };
    const res = await t.request(`/books/${id}`, { method: 'PATCH', token: sari, json: { translations: { id: changed } } });
    expect(res.body.translations.id.title).toBe('Cicak Pemberani');

    const cleared = await t.request(`/books/${id}`, {
      method: 'PATCH',
      token: sari,
      json: { translations: { id: { title: '', description: '', pages: ['', ''] } } },
    });
    expect(cleared.body.translations.id).toBeNull();
    const detail = await t.request(`/books/${id}`, { token: parent, headers: ID });
    expect(detail.body.title).toBe('The Brave Little Gecko');
  });

  it('leaves the translation alone when an update does not mention it', async () => {
    const created = await create({ id: GECKO_ID });
    await t.request(`/books/${created.body.id}`, { method: 'PATCH', token: sari, json: { priceIdr: 21_000 } });
    const detail = await t.request(`/creator/books/${created.body.id}`, { token: sari });
    expect(detail.body.translations.id).toEqual(GECKO_ID);
  });

  it('checks the page count against the book when an update sends only translations', async () => {
    const created = await create({ id: GECKO_ID });
    const res = await t.request(`/books/${created.body.id}`, {
      method: 'PATCH',
      token: sari,
      json: { translations: { id: { ...GECKO_ID, pages: ['a', 'b', 'c'] } } },
    });
    expect(res.status).toBe(400);
  });
});
