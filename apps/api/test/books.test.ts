import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  creatorBookSchema,
  creatorBookWithPagesSchema,
  creatorBooksResponseSchema,
  deleteBookResponseSchema,
} from '@storylib/shared';
import { bookPages, books } from '../src/db/schema';
import { buildTestApp, newBook, type TestApp } from './helpers';

const SARI = 'sari@example.com'; // 3 published
const BUDI = 'budi@example.com'; // 3 published + 1 archived
const PARENT_A = 'parent.a@example.com';

let t: TestApp;
let sari: string;
let budi: string;

beforeEach(async () => {
  t = await buildTestApp();
  sari = await t.login(SARI);
  budi = await t.login(BUDI);
});

async function listTitles(token: string) {
  const res = await t.request('/creator/books', { token });
  return creatorBooksResponseSchema.parse(res.body).books;
}

async function bookIdByTitle(token: string, title: string) {
  const found = (await listTitles(token)).find((b) => b.title === title);
  if (!found) throw new Error(`No book titled ${title}`);
  return found.id;
}

describe('GET /creator/books', () => {
  it('lists the creator\'s own books in own books, with page counts', async () => {
    const mine = await listTitles(sari);
    expect(mine).toHaveLength(3);
    expect(mine.every((b) => b.status === 'published')).toBe(true);
    expect(mine.every((b) => b.pageCount === 8)).toBe(true);
    mine.forEach((b) => creatorBookSchema.parse(b));

    const others = await listTitles(budi);
    expect(others.some((b) => b.status === 'archived')).toBe(true);
    expect(others.some((b) => b.creatorId === mine[0]!.creatorId)).toBe(false);
  });

  it('403 FORBIDDEN_ROLE for a parent', async () => {
    const res = await t.request('/creator/books', { token: await t.login(PARENT_A) });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('401 without a token', async () => {
    expect((await t.request('/creator/books')).status).toBe(401);
  });
});

describe('POST /books', () => {
  it('creates a published book with its pages, defaulting author and preview count', async () => {
    const res = await t.request('/books', { method: 'POST', token: sari, json: newBook() });
    expect(res.status).toBe(201);
    const book = creatorBookWithPagesSchema.parse(res.body);
    expect(book.status).toBe('published');
    expect(book.authorName).toBe('Sari Wulandari');
    expect(book.previewPageCount).toBe(2);
    expect(book.pageCount).toBe(2);
    expect(book.pages.map((p) => p.pageNumber)).toEqual([1, 2]);
    expect((await listTitles(sari)).some((b) => b.id === book.id)).toBe(true);
  });

  it('keeps an explicit author and preview count', async () => {
    const res = await t.request('/books', {
      method: 'POST',
      token: sari,
      json: newBook({ authorName: 'Guest Author', previewPageCount: 1 }),
    });
    expect(res.body.authorName).toBe('Guest Author');
    expect(res.body.previewPageCount).toBe(1);
  });

  it('403 FORBIDDEN_ROLE for a parent', async () => {
    const res = await t.request('/books', { method: 'POST', token: await t.login(PARENT_A), json: newBook() });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it.each([
    ['a zero price', { priceIdr: 0 }],
    ['a fractional price', { priceIdr: 1500.5 }],
    ['no pages', { pages: [] }],
    ['a page without text', { pages: [{ text: '', imageUrl: 'https://example.com/a.png' }] }],
    ['a page image that is not a URL', { pages: [{ text: 'Hi', imageUrl: 'nope' }] }],
    ['an age range that is backwards', { ageMin: 8, ageMax: 3 }],
    ['an empty title', { title: '  ' }],
  ])('400 VALIDATION_ERROR for %s', async (_label, overrides) => {
    const res = await t.request('/books', { method: 'POST', token: sari, json: newBook(overrides) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not let the client choose the owner or the status', async () => {
    const res = await t.request('/books', {
      method: 'POST',
      token: sari,
      json: newBook({ status: 'archived', creatorId: 'someone-else' }),
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('published');
    expect(res.body.creatorId).not.toBe('someone-else');
  });
});

describe('PATCH /books/:id', () => {
  it('edits fields, replaces pages', async () => {
    const id = await bookIdByTitle(sari, 'Kiko the Little Firefly');
    const res = await t.request(`/books/${id}`, {
      method: 'PATCH',
      token: sari,
      json: {
        title: 'Kiko Shines',
        priceIdr: 17_500,
        pages: [{ text: 'Only one page now.', imageUrl: 'https://example.com/only.png' }],
      },
    });
    expect(res.status).toBe(200);
    const book = creatorBookWithPagesSchema.parse(res.body);
    expect(book).toMatchObject({ title: 'Kiko Shines', priceIdr: 17_500, status: 'published', pageCount: 1 });
    expect(book.pages).toHaveLength(1);
    expect(new Date(book.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(book.createdAt).getTime());
  });

  it('leaves pages alone when none are sent', async () => {
    const id = await bookIdByTitle(sari, 'Kiko the Little Firefly');
    const res = await t.request(`/books/${id}`, { method: 'PATCH', token: sari, json: { title: 'Kiko!' } });
    expect(res.body.pageCount).toBe(8);
  });

  it('cannot archive through PATCH, nor change the owner', async () => {
    const id = await bookIdByTitle(sari, 'Kiko the Little Firefly');
    const res = await t.request(`/books/${id}`, { method: 'PATCH', token: sari, json: { status: 'archived', creatorId: 'x' } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
    expect(res.body.creatorId).not.toBe('x');
  });

  it('rejects an age range that only becomes invalid against the stored value', async () => {
    const id = await bookIdByTitle(sari, 'Kiko the Little Firefly'); // ages 3-6
    const res = await t.request(`/books/${id}`, { method: 'PATCH', token: sari, json: { ageMin: 9 } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('404s another creator\'s book, so its id is not confirmed', async () => {
    const budisBook = await bookIdByTitle(budi, 'A Boat Called Bintang');
    const res = await t.request(`/books/${budisBook}`, { method: 'PATCH', token: sari, json: { title: 'Mine now' } });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    const [row] = await t.db.select().from(books).where(eq(books.id, budisBook));
    expect(row!.title).toBe('A Boat Called Bintang');
  });

  it('404s an id that does not exist', async () => {
    const res = await t.request('/books/nope', { method: 'PATCH', token: sari, json: { title: 'x' } });
    expect(res.status).toBe(404);
  });

  it('403 FORBIDDEN_ROLE for a parent', async () => {
    const id = await bookIdByTitle(sari, 'Kiko the Little Firefly');
    const res = await t.request(`/books/${id}`, { method: 'PATCH', token: await t.login(PARENT_A), json: { title: 'x' } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('refuses to edit an archived book', async () => {
    const id = await bookIdByTitle(budi, 'The Lost Kite');
    const res = await t.request(`/books/${id}`, { method: 'PATCH', token: budi, json: { title: 'x' } });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /books/:id', () => {
  it('hard-deletes a book with no orders, pages included', async () => {
    const created = await t.request('/books', { method: 'POST', token: sari, json: newBook() });
    const id = created.body.id as string; // never ordered
    const res = await t.request(`/books/${id}`, { method: 'DELETE', token: sari });
    expect(res.status).toBe(200);
    expect(deleteBookResponseSchema.parse(res.body).result).toBe('deleted');
    expect((await listTitles(sari)).some((b) => b.id === id)).toBe(false);
    expect(await t.db.select().from(bookPages).where(eq(bookPages.bookId, id))).toHaveLength(0);
  });

  it('archives a book that has orders, so buyers keep it', async () => {
    const id = await bookIdByTitle(sari, 'Kiko the Little Firefly'); // bought by parent A
    const res = await t.request(`/books/${id}`, { method: 'DELETE', token: sari });
    expect(deleteBookResponseSchema.parse(res.body).result).toBe('archived');

    const kept = (await listTitles(sari)).find((b) => b.id === id)!;
    expect(kept.status).toBe('archived');
    expect(kept.archivedAt).not.toBeNull();
    expect(kept.pageCount).toBe(8);
  });

  it('is idempotent on an already archived book', async () => {
    const id = await bookIdByTitle(budi, 'The Lost Kite');
    const res = await t.request(`/books/${id}`, { method: 'DELETE', token: budi });
    expect(res.body.result).toBe('archived');
  });

  it('deletes a book that only has logged events, keeping the events', async () => {
    const { events } = await import('../src/db/schema');
    const id = await bookIdByTitle(sari, 'The Rainy Day Parade');
    await t.db.insert(events).values({ name: 'book_opened', bookId: id, createdAt: t.clock.now() });
    const res = await t.request(`/books/${id}`, { method: 'DELETE', token: sari });
    expect(res.body.result).toBe('deleted');
    const left = await t.db.select().from(events);
    expect(left).toHaveLength(1);
    expect(left[0]!.bookId).toBeNull();
  });

  it('404s another creator\'s book and leaves it untouched', async () => {
    const budisBook = await bookIdByTitle(budi, 'A Boat Called Bintang');
    const res = await t.request(`/books/${budisBook}`, { method: 'DELETE', token: sari });
    expect(res.status).toBe(404);
    expect((await listTitles(budi)).some((b) => b.id === budisBook)).toBe(true);
  });

  it('403 FORBIDDEN_ROLE for a parent', async () => {
    const id = await bookIdByTitle(sari, 'Kiko the Little Firefly');
    const res = await t.request(`/books/${id}`, { method: 'DELETE', token: await t.login(PARENT_A) });
    expect(res.status).toBe(403);
  });
});

describe('Kid mode on creator endpoints', () => {
  it('a kid token gets 403 KID_MODE_FORBIDDEN, never reaching the role check', async () => {
    const kid = await t.kidToken(PARENT_A);
    const res = await t.request('/creator/books', { token: kid });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('KID_MODE_FORBIDDEN');
  });
});
