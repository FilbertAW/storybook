import { z } from 'zod';

// Books are stored in their original language (English in the seed); other languages
// are translations that fall back to the original when one is missing.
export const localeSchema = z.enum(['id', 'en']);
export type Locale = z.infer<typeof localeSchema>;
export const BASE_LOCALE: Locale = 'en';

export const bookStatusSchema = z.enum(['published', 'archived']);
export type BookStatus = z.infer<typeof bookStatusSchema>;

const bookPageInputSchema = z.object({
  text: z.string().trim().min(1).max(500),
  imageUrl: z.url(),
});
export type BookPageInput = z.infer<typeof bookPageInputSchema>;

const bookFields = {
  title: z.string().trim().min(1).max(120),
  authorName: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000),
  coverUrl: z.url(),
  ageMin: z.number().int().min(0).max(12),
  ageMax: z.number().int().min(0).max(12),
  priceIdr: z.number().int().positive(),
  previewPageCount: z.number().int().min(0),
  pages: z.array(bookPageInputSchema).min(1).max(40),
};

// The Indonesian version of a book. The title and description come as a pair; an empty
// string means "not translated" and the reader sees the original. `pages` is empty or has
// one entry per page (an empty entry leaves that page untranslated).
export const bookTranslationInputSchema = z
  .object({
    title: z.string().trim().max(120),
    description: z.string().trim().max(1000),
    pages: z.array(z.string().trim().max(500)).max(40),
  })
  .refine((t) => (t.title === '') === (t.description === ''), {
    message: 'Give both the translated title and description, or neither.',
    path: ['title'],
  });
export type BookTranslationInput = z.infer<typeof bookTranslationInputSchema>;
const translationsField = z.object({ id: bookTranslationInputSchema }).optional();

const ageRangeIsValid = (b: { ageMin?: number; ageMax?: number }) =>
  b.ageMin === undefined || b.ageMax === undefined || b.ageMin <= b.ageMax;
const ageRangeIssue = { message: 'ageMin must not be greater than ageMax.', path: ['ageMax'] };

// authorName defaults to the creator's name and previewPageCount to 2.
export const createBookRequestSchema = z
  .object({
    ...bookFields,
    authorName: bookFields.authorName.optional(),
    previewPageCount: bookFields.previewPageCount.optional(),
    translations: translationsField,
  })
  .refine(ageRangeIsValid, ageRangeIssue);
export type CreateBookRequest = z.infer<typeof createBookRequestSchema>;

// A book is published when created; DELETE archives it when it has orders.
export const updateBookRequestSchema = z
  .object({ ...bookFields, translations: translationsField })
  .partial()
  .refine(ageRangeIsValid, ageRangeIssue);
export type UpdateBookRequest = z.infer<typeof updateBookRequestSchema>;

export const creatorBookSchema = z.object({
  id: z.string(),
  creatorId: z.string(),
  title: z.string(),
  authorName: z.string(),
  description: z.string(),
  coverUrl: z.string(),
  ageMin: z.number(),
  ageMax: z.number(),
  priceIdr: z.number(),
  status: bookStatusSchema,
  previewPageCount: z.number(),
  pageCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
});
export type CreatorBookDto = z.infer<typeof creatorBookSchema>;

// Always the original text, whatever language the request asks for, with the Indonesian
// version beside it so the edit form can show both.
export const creatorBookWithPagesSchema = creatorBookSchema.extend({
  pages: z.array(z.object({ pageNumber: z.number(), text: z.string(), imageUrl: z.string() })),
  translations: z.object({
    id: z.object({ title: z.string(), description: z.string(), pages: z.array(z.string()) }).nullable(),
  }),
});
export type CreatorBookWithPagesDto = z.infer<typeof creatorBookWithPagesSchema>;

export const creatorBooksResponseSchema = z.object({ books: z.array(creatorBookSchema) });
export type CreatorBooksResponse = z.infer<typeof creatorBooksResponseSchema>;

export const deleteBookResponseSchema = z.object({ result: z.enum(['deleted', 'archived']) });
export type DeleteBookResponse = z.infer<typeof deleteBookResponseSchema>;

// Reading: every book in a list or detail carries the access decision the server enforces.
export const accessSchema = z.object({
  level: z.enum(['full', 'preview']),
  reason: z.enum(['owner', 'purchased', 'subscription', 'locked']),
});
export type Access = z.infer<typeof accessSchema>;

export const bookSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  authorName: z.string(),
  description: z.string(),
  coverUrl: z.string(),
  ageMin: z.number(),
  ageMax: z.number(),
  priceIdr: z.number().optional(), // absent in Kid mode
  status: bookStatusSchema,
  previewPageCount: z.number(),
  pageCount: z.number(),
  access: accessSchema,
});
export type BookSummaryDto = z.infer<typeof bookSummarySchema>;

export const booksResponseSchema = z.object({ books: z.array(bookSummarySchema) });
export type BooksResponse = z.infer<typeof booksResponseSchema>;

export const booksQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  age: z
    .string()
    .regex(/^\d{1,2}$/, 'age must be a whole number.')
    .transform(Number)
    .pipe(z.number().max(12))
    .optional(),
  access: z.enum(['all', 'full', 'locked']).default('all'),
});
export type BooksQuery = z.infer<typeof booksQuerySchema>;

export const bookPageSchema = z.object({
  pageNumber: z.number(),
  text: z.string(),
  imageUrl: z.string(),
});
export type BookPageDto = z.infer<typeof bookPageSchema>;

export const bookPagesResponseSchema = z.object({
  pages: z.array(bookPageSchema),
  totalPages: z.number(),
  // First page number the reader cannot see, or null when every page is included.
  lockedFrom: z.number().nullable(),
  access: accessSchema,
});
export type BookPagesResponse = z.infer<typeof bookPagesResponseSchema>;

export const bookPageResponseSchema = z.object({
  page: bookPageSchema,
  totalPages: z.number(),
  access: accessSchema,
});
export type BookPageResponse = z.infer<typeof bookPageResponseSchema>;
