import { beforeEach, describe, expect, it } from 'vitest';
import {
  bookPageResponseSchema,
  bookPagesResponseSchema,
  bookSummarySchema,
  booksResponseSchema,
  type BookSummaryDto,
} from '@storylib/shared';
import { buildTestApp, type TestApp } from './helpers';

const PARENT_A = 'parent.a@example.com'; // owns Kiko, no subscription
const PARENT_B = 'parent.b@example.com'; // active subscription
const PARENT_C = 'parent.c@example.com'; // elapsed subscription, owns the archived Kite
const SARI = 'sari@example.com';

const KIKO = 'Kiko the Little Firefly';
const RAINY = 'The Rainy Day Parade';
const MIMI = 'Mimi and the Moon Cake';
const BOBO = 'Bobo Learns to Share'; // draft
const KITE = 'The Lost Kite'; // archived

let t: TestApp;
beforeEach(async () => {
  t = await buildTestApp();
});

async function list(email: string, query = '') {
  const res = await t.request(`/books${query}`, { token: await t.login(email) });
  expect(res.status).toBe(200);
  return booksResponseSchema.parse(res.body).books;
}

const titles = (books: BookSummaryDto[]) => books.map((b) => b.title);
const byTitle = (books: BookSummaryDto[], title: string) => books.find((b) => b.title === title)!;

describe('GET /books', () => {
  it('shows a parent the published catalog newest first, with the access decision on each book', async () => {
    const books = await list(PARENT_A);
    expect(titles(books)).toEqual([
      'A Boat Called Bintang',
      "Dino's First Day at School",
      'The Sleepy Banyan Tree',
      MIMI,
      RAINY,
      KIKO,
    ]);
    expect(byTitle(books, KIKO).access).toEqual({ level: 'full', reason: 'purchased' });
    expect(byTitle(books, RAINY).access).toEqual({ level: 'preview', reason: 'locked' });
    expect(books.every((b) => typeof b.priceIdr === 'number')).toBe(true);
    books.forEach((b) => bookSummarySchema.parse(b));
  });

  it('never lists a draft or a retired book the parent did not buy', async () => {
    const seen = titles(await list(PARENT_A));
    expect(seen).not.toContain(BOBO);
    expect(seen).not.toContain(KITE);
  });

  it('opens every published book to an active subscriber, but not a retired one', async () => {
    const books = await list(PARENT_B);
    expect(books).toHaveLength(6);
    expect(books.every((b) => b.access.level === 'full' && b.access.reason === 'subscription')).toBe(true);
    expect(titles(books)).not.toContain(KITE);
  });

  it('falls back to purchased books only once the subscription has run out', async () => {
    const books = await list(PARENT_C);
    expect(books).toHaveLength(7);
    expect(byTitle(books, KITE)).toMatchObject({ status: 'archived', access: { level: 'full', reason: 'purchased' } });
    const others = books.filter((b) => b.title !== KITE);
    expect(others.every((b) => b.access.reason === 'locked')).toBe(true);
  });

  it('shows a creator the same catalog, with their own books as owner and no drafts', async () => {
    const books = await list(SARI);
    expect(titles(books)).not.toContain(BOBO);
    expect(byTitle(books, KIKO).access).toEqual({ level: 'full', reason: 'owner' });
    expect(byTitle(books, 'A Boat Called Bintang').access.reason).toBe('locked');
  });

  describe('filters', () => {
    it('access=full keeps only readable books, access=locked only the rest', async () => {
      expect(titles(await list(PARENT_A, '?access=full'))).toEqual([KIKO]);
      expect(await list(PARENT_A, '?access=locked')).toHaveLength(5);
      expect(await list(PARENT_A, '?access=all')).toHaveLength(6);
    });

    it('q matches title or author, ignoring case', async () => {
      expect(titles(await list(PARENT_A, '?q=MOON'))).toEqual([MIMI]);
      expect(titles(await list(PARENT_A, '?q=budi'))).toHaveLength(3);
    });

    it('q treats % and _ literally instead of as wildcards', async () => {
      expect(await list(PARENT_A, '?q=%25')).toHaveLength(0);
      expect(await list(PARENT_A, '?q=_')).toHaveLength(0);
    });

    it('age keeps books whose range includes it', async () => {
      expect(titles(await list(PARENT_A, '?age=2'))).toEqual([RAINY]);
      expect((await list(PARENT_A, '?age=7')).map((b) => b.title).sort()).toEqual(
        ['A Boat Called Bintang', "Dino's First Day at School", MIMI].sort(),
      );
    });

    it('combines filters', async () => {
      expect(titles(await list(PARENT_A, '?age=4&access=full'))).toEqual([KIKO]);
    });

    it('400s a bad value', async () => {
      const token = await t.login(PARENT_A);
      for (const query of ['?age=abc', '?age=13', '?age=-1', '?access=bogus', '?q=']) {
        const res = await t.request(`/books${query}`, { token });
        expect(res.status, query).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});

describe('GET /books/:id', () => {
  it('returns the book with its access decision, price and page count', async () => {
    const token = await t.login(PARENT_A);
    const res = await t.request(`/books/${await t.bookId(RAINY)}`, { token });
    expect(res.status).toBe(200);
    expect(bookSummarySchema.parse(res.body)).toMatchObject({
      title: RAINY,
      priceIdr: 15_000,
      pageCount: 8,
      access: { level: 'preview', reason: 'locked' },
    });
  });

  it('404s a draft for a parent, and for a creator who does not own it', async () => {
    const bobo = await t.bookId(BOBO);
    expect((await t.request(`/books/${bobo}`, { token: await t.login(PARENT_A) })).status).toBe(404);
    expect((await t.request(`/books/${bobo}`, { token: await t.login('budi@example.com') })).status).toBe(404);
  });

  it('lets the creator open their own draft', async () => {
    const res = await t.request(`/books/${await t.bookId(BOBO)}`, { token: await t.login(SARI) });
    expect(res.status).toBe(200);
    expect(res.body.access).toEqual({ level: 'full', reason: 'owner' });
  });

  it('404s a retired book unless the reader bought it', async () => {
    const kite = await t.bookId(KITE);
    expect((await t.request(`/books/${kite}`, { token: await t.login(PARENT_A) })).status).toBe(404);
    expect((await t.request(`/books/${kite}`, { token: await t.login(PARENT_B) })).status).toBe(404);
    const owner = await t.request(`/books/${kite}`, { token: await t.login(PARENT_C) });
    expect(owner.status).toBe(200);
    expect(owner.body.access.reason).toBe('purchased');
  });

  it('404s an unknown id with the shared error shape', async () => {
    const res = await t.request('/books/nope', { token: await t.login(PARENT_A) });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('401s without a token', async () => {
    expect((await t.request(`/books/${await t.bookId(RAINY)}`)).status).toBe(401);
  });
});

describe('GET /books/:id/pages', () => {
  it('sends a locked reader only the preview pages, never the rest', async () => {
    const token = await t.login(PARENT_A);
    const res = await t.request(`/books/${await t.bookId(RAINY)}/pages`, { token });
    expect(res.status).toBe(200);
    const body = bookPagesResponseSchema.parse(res.body);
    expect(body.pages.map((p) => p.pageNumber)).toEqual([1, 2]);
    expect(body).toMatchObject({ totalPages: 8, lockedFrom: 3, access: { level: 'preview', reason: 'locked' } });

    // The locked text is not anywhere in the payload, whatever the UI would hide.
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('Piglet came with a bright red umbrella');
    expect(raw).not.toContain('Soon there was a parade');
  });

  it('sends every page to a buyer', async () => {
    const res = await t.request(`/books/${await t.bookId(KIKO)}/pages`, { token: await t.login(PARENT_A) });
    const body = bookPagesResponseSchema.parse(res.body);
    expect(body.pages).toHaveLength(8);
    expect(body.lockedFrom).toBeNull();
    expect(body.access).toEqual({ level: 'full', reason: 'purchased' });
  });

  it('sends every page to a subscriber', async () => {
    const res = await t.request(`/books/${await t.bookId(RAINY)}/pages`, { token: await t.login(PARENT_B) });
    expect(res.body.pages).toHaveLength(8);
    expect(res.body.access.reason).toBe('subscription');
  });

  it('sends no pages when the preview is 0, and all of them when it is longer than the book', async () => {
    const sari = await t.login(SARI);
    const parent = await t.login(PARENT_A);
    const rainy = await t.bookId(RAINY);

    await t.request(`/books/${rainy}`, { method: 'PATCH', token: sari, json: { previewPageCount: 0 } });
    const none = await t.request(`/books/${rainy}/pages`, { token: parent });
    expect(none.body.pages).toEqual([]);
    expect(none.body.lockedFrom).toBe(1);

    await t.request(`/books/${rainy}`, { method: 'PATCH', token: sari, json: { previewPageCount: 20 } });
    const all = await t.request(`/books/${rainy}/pages`, { token: parent });
    expect(all.body.pages).toHaveLength(8);
    expect(all.body.lockedFrom).toBeNull();
  });

  it('404s a draft and a retired book the reader has no claim to', async () => {
    const token = await t.login(PARENT_A);
    expect((await t.request(`/books/${await t.bookId(BOBO)}/pages`, { token })).status).toBe(404);
    expect((await t.request(`/books/${await t.bookId(KITE)}/pages`, { token })).status).toBe(404);
  });

  it('lets a creator read all of their own draft', async () => {
    const res = await t.request(`/books/${await t.bookId(BOBO)}/pages`, { token: await t.login(SARI) });
    expect(res.body.pages).toHaveLength(8);
    expect(res.body.access.reason).toBe('owner');
  });
});

describe('GET /books/:id/pages/:n', () => {
  const page = async (email: string, title: string, n: string | number) =>
    t.request(`/books/${await t.bookId(title)}/pages/${n}`, { token: await t.login(email) });

  it('returns a preview page to a locked reader', async () => {
    const res = await page(PARENT_A, RAINY, 2);
    expect(res.status).toBe(200);
    expect(bookPageResponseSchema.parse(res.body).page.pageNumber).toBe(2);
  });

  it('403 ENTITLEMENT_REQUIRED for a page past the preview, fetched directly by URL', async () => {
    const res = await page(PARENT_A, RAINY, 3);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ENTITLEMENT_REQUIRED');
    expect(JSON.stringify(res.body)).not.toContain('Piglet');
    const last = await page(PARENT_A, RAINY, 8);
    expect(last.status).toBe(403);
  });

  it('returns any page to someone with full access', async () => {
    expect((await page(PARENT_A, KIKO, 8)).status).toBe(200);
    expect((await page(PARENT_B, RAINY, 8)).status).toBe(200);
  });

  it('404s a page that does not exist, however it is written', async () => {
    for (const n of ['0', '9', '99', 'abc', '-1', '1.5']) {
      const res = await page(PARENT_B, RAINY, n);
      expect(res.status, n).toBe(404);
    }
  });

  it('404s a draft page for a parent', async () => {
    expect((await page(PARENT_A, BOBO, 1)).status).toBe(404);
  });
});

describe('a purchase is ownership', () => {
  it('stays readable when the creator archives the book', async () => {
    const kiko = await t.bookId(KIKO);
    const sari = await t.login(SARI);
    const del = await t.request(`/books/${kiko}`, { method: 'DELETE', token: sari });
    expect(del.body.result).toBe('archived');

    const parentA = await t.login(PARENT_A);
    const pages = await t.request(`/books/${kiko}/pages`, { token: parentA });
    expect(pages.status).toBe(200);
    expect(pages.body.pages).toHaveLength(8);
    expect(byTitle(await list(PARENT_A), KIKO)).toMatchObject({
      status: 'archived',
      access: { level: 'full', reason: 'purchased' },
    });

    // Everyone else no longer sees it.
    expect((await t.request(`/books/${kiko}`, { token: await t.login(PARENT_B) })).status).toBe(404);
    expect(titles(await list(PARENT_B))).not.toContain(KIKO);
  });
});

describe('Kid mode', () => {
  const kidList = async (email: string, query = '') => {
    const res = await t.request(`/books${query}`, { token: await t.kidToken(email) });
    expect(res.status).toBe(200);
    return res.body.books as BookSummaryDto[];
  };

  it('lists only books the family can read in full, with no prices anywhere', async () => {
    const books = await kidList(PARENT_A);
    expect(titles(books)).toEqual([KIKO]);
    expect(books[0]!.access.level).toBe('full');
    expect(JSON.stringify(books)).not.toMatch(/priceIdr|15000|price/i);
  });

  it('lists every published book for a subscribed family', async () => {
    const books = await kidList(PARENT_B);
    expect(books).toHaveLength(6);
    expect(books.every((b) => !('priceIdr' in b))).toBe(true);
  });

  it('shows nothing for access=locked', async () => {
    expect(await kidList(PARENT_A, '?access=locked')).toEqual([]);
  });

  it('opens a readable book without a price', async () => {
    const res = await t.request(`/books/${await t.bookId(KIKO)}`, { token: await t.kidToken(PARENT_A) });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('priceIdr');
    const pages = await t.request(`/books/${await t.bookId(KIKO)}/pages`, { token: await t.kidToken(PARENT_A) });
    expect(pages.body.pages).toHaveLength(8);
  });

  it('404s a locked book instead of showing a preview', async () => {
    const kid = await t.kidToken(PARENT_A);
    const rainy = await t.bookId(RAINY);
    for (const path of [`/books/${rainy}`, `/books/${rainy}/pages`, `/books/${rainy}/pages/1`]) {
      const res = await t.request(path, { token: kid });
      expect(res.status, path).toBe(404);
    }
  });
});
