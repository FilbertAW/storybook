import { and, asc, desc, eq, getTableColumns, inArray, lte, or, sql } from 'drizzle-orm';
import { BASE_LOCALE, type BookPageInput, type Locale } from '@storylib/shared';
import type { Db } from '../../db/client';
import { bookPageTranslations, bookPages, bookTranslations, books, events, orders } from '../../db/schema';

// Drizzle leaves the table name off columns in a single-table select, which would
// make a plain ${books.id} resolve to book_pages.id inside the subquery.
const pageCount = sql<number>`(select count(*) from ${bookPages} where ${bookPages.bookId} = "books"."id")`.as(
  'page_count',
);
const bookWithCount = { ...getTableColumns(books), pageCount };

export type BookRow = Awaited<ReturnType<BooksRepository['findOwned']>> & {};
export type BookTranslation = { title: string; description: string };
export type NewBook = Omit<typeof books.$inferInsert, 'id'>;
export type BookChanges = Partial<Omit<typeof books.$inferInsert, 'id' | 'creatorId' | 'createdAt'>>;

const toPageRows = (bookId: string, pages: BookPageInput[]) =>
  pages.map((p, i) => ({ bookId, pageNumber: i + 1, text: p.text, imageUrl: p.imageUrl }));

export class BooksRepository {
  constructor(private readonly db: Db) {}

  listByCreator(creatorId: string) {
    return this.db
      .select(bookWithCount)
      .from(books)
      .where(eq(books.creatorId, creatorId))
      .orderBy(desc(books.createdAt));
  }

  async findOwned(id: string, creatorId: string) {
    const [row] = await this.db
      .select(bookWithCount)
      .from(books)
      .where(and(eq(books.id, id), eq(books.creatorId, creatorId)));
    return row;
  }

  async findById(id: string) {
    const [row] = await this.db.select(bookWithCount).from(books).where(eq(books.id, id));
    return row;
  }

  // Published books, plus archived ones the reader bought. Nothing else appears.
  // Whether each book is readable in full is decided afterwards by resolveAccess.
  listCatalog(filter: { purchasedBookIds: string[]; q?: string; age?: number; locale?: Locale }) {
    const retired =
      filter.purchasedBookIds.length > 0
        ? and(eq(books.status, 'archived'), inArray(books.id, filter.purchasedBookIds))
        : undefined;
    const conditions = [or(eq(books.status, 'published'), retired)];
    if (filter.q) {
      const pattern = `%${filter.q.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(
        or(
          sql`lower(${books.title}) like ${pattern} escape '\\'`,
          sql`lower(${books.authorName}) like ${pattern} escape '\\'`,
          // The title in the reader's language is searchable too.
          sql`exists (select 1 from ${bookTranslations} where ${bookTranslations.bookId} = "books"."id" and ${bookTranslations.locale} = ${filter.locale ?? BASE_LOCALE} and lower(${bookTranslations.title}) like ${pattern} escape '\\')`,
        ),
      );
    }
    if (filter.age !== undefined) {
      conditions.push(sql`${books.ageMin} <= ${filter.age} and ${books.ageMax} >= ${filter.age}`);
    }
    return this.db
      .select(bookWithCount)
      .from(books)
      .where(and(...conditions))
      .orderBy(desc(books.createdAt), asc(books.id));
  }

  // Titles and descriptions in the reader's language; a book without a translation is left out.
  async translations(bookIds: string[], locale: Locale): Promise<Map<string, BookTranslation>> {
    if (locale === BASE_LOCALE || bookIds.length === 0) return new Map();
    const rows = await this.db
      .select({ bookId: bookTranslations.bookId, title: bookTranslations.title, description: bookTranslations.description })
      .from(bookTranslations)
      .where(and(inArray(bookTranslations.bookId, bookIds), eq(bookTranslations.locale, locale as 'id')));
    return new Map(rows.map((r) => [r.bookId, { title: r.title, description: r.description }]));
  }

  // Page text in the reader's language, falling back to the original per page.
  private pageSelect(locale: Locale) {
    return this.db
      .select({
        pageNumber: bookPages.pageNumber,
        text: sql<string>`coalesce(${bookPageTranslations.text}, ${bookPages.text})`,
        imageUrl: bookPages.imageUrl,
      })
      .from(bookPages)
      .leftJoin(
        bookPageTranslations,
        and(eq(bookPageTranslations.pageId, bookPages.id), eq(bookPageTranslations.locale, locale as 'id')),
      );
  }

  // `limit` is applied in SQL so a page the reader may not see is never loaded.
  getPages(bookId: string, limit?: number, locale: Locale = BASE_LOCALE) {
    return this.pageSelect(locale)
      .where(
        limit === undefined
          ? eq(bookPages.bookId, bookId)
          : and(eq(bookPages.bookId, bookId), lte(bookPages.pageNumber, limit)),
      )
      .orderBy(asc(bookPages.pageNumber));
  }

  async getPage(bookId: string, pageNumber: number, locale: Locale = BASE_LOCALE) {
    const [row] = await this.pageSelect(locale).where(
      and(eq(bookPages.bookId, bookId), eq(bookPages.pageNumber, pageNumber)),
    );
    return row;
  }

  insertWithPages(book: NewBook, pages: BookPageInput[]): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.insert(books).values(book).returning({ id: books.id });
      await tx.insert(bookPages).values(toPageRows(row!.id, pages));
      return row!.id;
    });
  }

  // Fields and pages change together or not at all. A translation describes the text it was
  // written from, so it is dropped only when that original text really changes: saving a
  // book with the same words (a new price, say) keeps its translations.
  update(id: string, changes: BookChanges, pages?: BookPageInput[]) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ title: books.title, description: books.description })
        .from(books)
        .where(eq(books.id, id));
      const wordsChanged =
        (changes.title !== undefined && changes.title !== current?.title) ||
        (changes.description !== undefined && changes.description !== current?.description);
      if (wordsChanged) await tx.delete(bookTranslations).where(eq(bookTranslations.bookId, id));

      await tx.update(books).set(changes).where(eq(books.id, id));

      if (pages) {
        const existing = await tx
          .select({ text: bookPages.text, imageUrl: bookPages.imageUrl })
          .from(bookPages)
          .where(eq(bookPages.bookId, id))
          .orderBy(asc(bookPages.pageNumber));
        const sameText = existing.length === pages.length && existing.every((p, i) => p.text === pages[i]!.text);
        if (sameText) {
          for (const [i, p] of pages.entries()) {
            if (existing[i]!.imageUrl !== p.imageUrl) {
              await tx
                .update(bookPages)
                .set({ imageUrl: p.imageUrl })
                .where(and(eq(bookPages.bookId, id), eq(bookPages.pageNumber, i + 1)));
            }
          }
        } else {
          await tx.delete(bookPages).where(eq(bookPages.bookId, id));
          await tx.insert(bookPages).values(toPageRows(id, pages));
        }
      }
    });
  }

  async hasOrders(bookId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.bookId, bookId))
      .limit(1);
    return row !== undefined;
  }

  archive(id: string, now: number) {
    return this.db
      .update(books)
      .set({ status: 'archived', archivedAt: now, updatedAt: now })
      .where(eq(books.id, id));
  }

  // Pages go with the book (cascade). Logged events keep their row but lose the book link.
  delete(id: string) {
    return this.db.transaction(async (tx) => {
      await tx.update(events).set({ bookId: null }).where(eq(events.bookId, id));
      await tx.delete(books).where(eq(books.id, id));
    });
  }
}
