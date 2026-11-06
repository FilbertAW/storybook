import { and, asc, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import type { BookPageInput } from '@storylib/shared';
import type { Db } from '../../db/client';
import { bookPages, books, events, orders } from '../../db/schema';

// Drizzle leaves the table name off columns in a single-table select, which would
// make a plain ${books.id} resolve to book_pages.id inside the subquery.
const pageCount = sql<number>`(select count(*) from ${bookPages} where ${bookPages.bookId} = "books"."id")`.as(
  'page_count',
);
const bookWithCount = { ...getTableColumns(books), pageCount };

export type BookRow = Awaited<ReturnType<BooksRepository['findOwned']>> & {};
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

  getPages(bookId: string) {
    return this.db
      .select({
        pageNumber: bookPages.pageNumber,
        text: bookPages.text,
        imageUrl: bookPages.imageUrl,
      })
      .from(bookPages)
      .where(eq(bookPages.bookId, bookId))
      .orderBy(asc(bookPages.pageNumber));
  }

  insertWithPages(book: NewBook, pages: BookPageInput[]): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.insert(books).values(book).returning({ id: books.id });
      await tx.insert(bookPages).values(toPageRows(row!.id, pages));
      return row!.id;
    });
  }

  // Fields and pages change together or not at all.
  update(id: string, changes: BookChanges, pages?: BookPageInput[]) {
    return this.db.transaction(async (tx) => {
      await tx.update(books).set(changes).where(eq(books.id, id));
      if (pages) {
        await tx.delete(bookPages).where(eq(bookPages.bookId, id));
        await tx.insert(bookPages).values(toPageRows(id, pages));
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
