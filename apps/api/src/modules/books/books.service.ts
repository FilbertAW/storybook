import type {
  CreateBookRequest,
  CreatorBookDto,
  CreatorBookWithPagesDto,
  CreatorBooksResponse,
  DeleteBookResponse,
  UpdateBookRequest,
} from '@storylib/shared';
import type { UserRow } from '../../shared/app-env';
import type { Clock } from '../../shared/clock';
import { AppError } from '../../shared/errors';
import type { BookRow, BooksRepository } from './books.repository';

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

export class BookService {
  constructor(
    private readonly books: BooksRepository,
    private readonly clock: Clock,
  ) {}

  async listOwn(creator: UserRow): Promise<CreatorBooksResponse> {
    const rows = await this.books.listByCreator(creator.id);
    return { books: rows.map(toDto) };
  }

  async create(creator: UserRow, input: CreateBookRequest): Promise<CreatorBookWithPagesDto> {
    const now = this.clock.now();
    const { pages, authorName, previewPageCount, ...fields } = input;
    const id = await this.books.insertWithPages(
      {
        ...fields,
        creatorId: creator.id,
        authorName: authorName ?? creator.name,
        previewPageCount: previewPageCount ?? DEFAULT_PREVIEW_PAGES,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      },
      pages,
    );
    return this.withPages(await this.owned(creator, id));
  }

  async update(creator: UserRow, id: string, input: UpdateBookRequest): Promise<CreatorBookWithPagesDto> {
    const book = await this.owned(creator, id);
    if (book.status === 'archived') {
      throw new AppError('VALIDATION_ERROR', 'Archived books can no longer be edited.');
    }
    const { pages, ...changes } = input;
    const ageMin = changes.ageMin ?? book.ageMin;
    const ageMax = changes.ageMax ?? book.ageMax;
    if (ageMin > ageMax) {
      throw new AppError('VALIDATION_ERROR', 'ageMin must not be greater than ageMax.');
    }
    await this.books.update(id, { ...changes, updatedAt: this.clock.now() }, pages);
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

  // Another creator's book is reported as missing, so its id is never confirmed.
  private async owned(creator: UserRow, id: string): Promise<BookRow> {
    const book = await this.books.findOwned(id, creator.id);
    if (!book) throw new AppError('NOT_FOUND', 'Book not found.');
    return book;
  }

  private async withPages(book: BookRow): Promise<CreatorBookWithPagesDto> {
    return { ...toDto(book), pages: await this.books.getPages(book.id) };
  }
}
