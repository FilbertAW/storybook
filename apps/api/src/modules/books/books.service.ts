import type {
  Access,
  BookPageResponse,
  BookPagesResponse,
  BookSummaryDto,
  BooksQuery,
  BooksResponse,
  CreateBookRequest,
  CreatorBookDto,
  CreatorBookWithPagesDto,
  CreatorBooksResponse,
  DeleteBookResponse,
  Locale,
  UpdateBookRequest,
} from '@storylib/shared';
import { BASE_LOCALE, type BookTranslationInput } from '@storylib/shared';
import type { Scope, UserRow } from '../../shared/app-env';
import type { Clock } from '../../shared/clock';
import { AppError } from '../../shared/errors';
import type { AccessService } from '../access/access.service';
import type { BookRow, BooksRepository, BookTranslation } from './books.repository';

const DEFAULT_PREVIEW_PAGES = 2;

const iso = (ms: number) => new Date(ms).toISOString();

function toDto(row: BookRow): CreatorBookDto {
  return {
    id: row.id,
    creatorId: row.creatorId,
    title: row.title,
    authorName: row.authorName,
    description: row.description,
    coverUrl: row.coverUrl,
    ageMin: row.ageMin,
    ageMax: row.ageMax,
    priceIdr: row.priceIdr,
    status: row.status,
    previewPageCount: row.previewPageCount,
    pageCount: row.pageCount,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    archivedAt: row.archivedAt === null ? null : iso(row.archivedAt),
  };
}

// A kid sees only books the family can read in full, and never a price.
function toSummary(row: BookRow, access: Access, scope: Scope, tr?: BookTranslation): BookSummaryDto {
  return {
    id: row.id,
    title: tr?.title ?? row.title,
    authorName: row.authorName,
    description: tr?.description ?? row.description,
    coverUrl: row.coverUrl,
    ageMin: row.ageMin,
    ageMax: row.ageMax,
    ...(scope === 'kid' ? {} : { priceIdr: row.priceIdr }),
    status: row.status,
    previewPageCount: row.previewPageCount,
    pageCount: row.pageCount,
    access,
  };
}

export class BookService {
  constructor(
    private readonly books: BooksRepository,
    private readonly access: AccessService,
    private readonly clock: Clock,
  ) {}

  async list(user: UserRow, scope: Scope, query: BooksQuery, locale: Locale = BASE_LOCALE): Promise<BooksResponse> {
    const subject = await this.access.subjectFor(user);
    const rows = await this.books.listCatalog({
      purchasedBookIds: [...subject.purchasedBookIds],
      q: query.q,
      age: query.age,
      locale,
    });
    const translations = await this.books.translations(rows.map((r) => r.id), locale);
    const items: BookSummaryDto[] = [];
    for (const row of rows) {
      const access = this.access.resolve(subject, row);
      if (!access) continue;
      if (scope === 'kid' && access.level !== 'full') continue;
      if (query.access === 'full' && access.level !== 'full') continue;
      if (query.access === 'locked' && access.level !== 'preview') continue;
      items.push(toSummary(row, access, scope, translations.get(row.id)));
    }
    return { books: items };
  }

  async detail(user: UserRow, scope: Scope, id: string, locale: Locale = BASE_LOCALE): Promise<BookSummaryDto> {
    const { book, access } = await this.visible(user, scope, id);
    const translations = await this.books.translations([id], locale);
    return toSummary(book, access, scope, translations.get(id));
  }

  async pages(user: UserRow, scope: Scope, id: string, locale: Locale = BASE_LOCALE): Promise<BookPagesResponse> {
    const { book, access } = await this.visible(user, scope, id);
    const shown = this.shownPages(book, access);
    const pages = await this.books.getPages(id, access.level === 'full' ? undefined : shown, locale);
    return {
      pages,
      totalPages: book.pageCount,
      lockedFrom: shown < book.pageCount ? shown + 1 : null,
      access,
    };
  }

  async page(
    user: UserRow,
    scope: Scope,
    id: string,
    pageNumber: number,
    locale: Locale = BASE_LOCALE,
  ): Promise<BookPageResponse> {
    const { book, access } = await this.visible(user, scope, id);
    if (pageNumber < 1 || pageNumber > book.pageCount) {
      throw new AppError('NOT_FOUND', 'Page not found.');
    }
    if (pageNumber > this.shownPages(book, access)) {
      throw new AppError('ENTITLEMENT_REQUIRED', 'Buy this book or subscribe to read this page.', {
        bookId: id,
      });
    }
    const page = await this.books.getPage(id, pageNumber, locale);
    if (!page) throw new AppError('NOT_FOUND', 'Page not found.');
    return { page, totalPages: book.pageCount, access };
  }

  async listOwn(creator: UserRow): Promise<CreatorBooksResponse> {
    const rows = await this.books.listByCreator(creator.id);
    return { books: rows.map(toDto) };
  }

  async create(creator: UserRow, input: CreateBookRequest): Promise<CreatorBookWithPagesDto> {
    const now = this.clock.now();
    const { pages, authorName, previewPageCount, translations, ...fields } = input;
    this.checkTranslation(translations?.id, pages.length);
    const id = await this.books.insertWithPages(
      {
        ...fields,
        creatorId: creator.id,
        authorName: authorName ?? creator.name,
        previewPageCount: previewPageCount ?? DEFAULT_PREVIEW_PAGES,
        status: 'published',
        createdAt: now,
        updatedAt: now,
      },
      pages,
      translations?.id,
    );
    return this.withPages(await this.owned(creator, id));
  }

  async getOwn(creator: UserRow, id: string): Promise<CreatorBookWithPagesDto> {
    return this.withPages(await this.owned(creator, id));
  }

  async update(creator: UserRow, id: string, input: UpdateBookRequest): Promise<CreatorBookWithPagesDto> {
    const book = await this.owned(creator, id);
    if (book.status === 'archived') {
      throw new AppError('VALIDATION_ERROR', 'Archived books can no longer be edited.');
    }
    const { pages, translations, ...changes } = input;
    this.checkTranslation(translations?.id, pages?.length ?? book.pageCount);
    const ageMin = changes.ageMin ?? book.ageMin;
    const ageMax = changes.ageMax ?? book.ageMax;
    if (ageMin > ageMax) {
      throw new AppError('VALIDATION_ERROR', 'ageMin must not be greater than ageMax.');
    }
    await this.books.update(id, { ...changes, updatedAt: this.clock.now() }, pages, translations?.id);
    return this.withPages(await this.owned(creator, id));
  }

  // A book with orders is archived so buyers keep reading it; otherwise it is deleted.
  async remove(creator: UserRow, id: string): Promise<DeleteBookResponse> {
    const book = await this.owned(creator, id);
    if (await this.books.hasOrders(id)) {
      if (book.status !== 'archived') await this.books.archive(id, this.clock.now());
      return { result: 'archived' };
    }
    await this.books.delete(id);
    return { result: 'deleted' };
  }

  // A book the reader may not know about is "not found", never "forbidden".
  private async visible(user: UserRow, scope: Scope, id: string) {
    const book = await this.books.findById(id);
    const access = book ? this.access.resolve(await this.access.subjectFor(user), book) : null;
    if (!book || !access || (scope === 'kid' && access.level !== 'full')) {
      throw new AppError('NOT_FOUND', 'Book not found.');
    }
    return { book, access };
  }

  private shownPages(book: BookRow, access: Access): number {
    return access.level === 'full' ? book.pageCount : Math.min(book.previewPageCount, book.pageCount);
  }

  // Another creator's book is reported as missing, so its id is never confirmed.
  private async owned(creator: UserRow, id: string): Promise<BookRow> {
    const book = await this.books.findOwned(id, creator.id);
    if (!book) throw new AppError('NOT_FOUND', 'Book not found.');
    return book;
  }

  // Translated pages are one per page, or none at all.
  private checkTranslation(translation: BookTranslationInput | undefined, pageCount: number) {
    if (translation && translation.pages.length !== 0 && translation.pages.length !== pageCount) {
      throw new AppError('VALIDATION_ERROR', 'Give one translated text for every page, or none.');
    }
  }

  private async withPages(book: BookRow): Promise<CreatorBookWithPagesDto> {
    return {
      ...toDto(book),
      pages: await this.books.getPages(book.id),
      translations: { id: await this.books.translationOf(book.id) },
    };
  }
}
