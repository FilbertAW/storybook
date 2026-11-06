import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// IDs are UUID text, timestamps are UTC epoch milliseconds, money is integer IDR.
const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const users = sqliteTable(
  'users',
  {
    id: id(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    role: text('role', { enum: ['parent', 'creator'] }).notNull(),
    pinHash: text('pin_hash'),
    pinFailedAttempts: integer('pin_failed_attempts').notNull().default(0),
    pinLockedUntil: integer('pin_locked_until'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [check('users_role_check', sql`${t.role} in ('parent', 'creator')`)],
);

export const books = sqliteTable(
  'books',
  {
    id: id(),
    creatorId: text('creator_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    authorName: text('author_name').notNull(),
    description: text('description').notNull(),
    coverUrl: text('cover_url').notNull(),
    ageMin: integer('age_min').notNull(),
    ageMax: integer('age_max').notNull(),
    priceIdr: integer('price_idr').notNull(),
    status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull(),
    previewPageCount: integer('preview_page_count').notNull().default(2),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    archivedAt: integer('archived_at'),
  },
  (t) => [
    check('books_status_check', sql`${t.status} in ('draft', 'published', 'archived')`),
    check('books_price_check', sql`${t.priceIdr} > 0`),
    check('books_preview_check', sql`${t.previewPageCount} >= 0`),
    check('books_age_check', sql`${t.ageMin} <= ${t.ageMax}`),
    index('books_status_created_idx').on(t.status, t.createdAt),
    index('books_creator_idx').on(t.creatorId),
  ],
);

export const bookPages = sqliteTable(
  'book_pages',
  {
    id: id(),
    bookId: text('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    pageNumber: integer('page_number').notNull(),
    text: text('text').notNull(),
    imageUrl: text('image_url').notNull(),
  },
  (t) => [
    uniqueIndex('book_pages_book_page_idx').on(t.bookId, t.pageNumber),
    check('book_pages_number_check', sql`${t.pageNumber} >= 1`),
  ],
);

export const plans = sqliteTable(
  'plans',
  {
    id: id(),
    name: text('name').notNull(),
    priceIdr: integer('price_idr').notNull(),
    periodDays: integer('period_days').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [
    check('plans_price_check', sql`${t.priceIdr} > 0`),
    check('plans_period_check', sql`${t.periodDays} > 0`),
  ],
);

export const orders = sqliteTable(
  'orders',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    type: text('type', { enum: ['book', 'subscription'] }).notNull(),
    bookId: text('book_id').references(() => books.id),
    planId: text('plan_id').references(() => plans.id),
    amountIdr: integer('amount_idr').notNull(),
    status: text('status', { enum: ['pending', 'paid', 'failed'] }).notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    subscriptionOverlapAck: integer('subscription_overlap_ack', { mode: 'boolean' })
      .notNull()
      .default(false),
    provider: text('provider').notNull().default('mock'),
    providerRef: text('provider_ref'),
    failureReason: text('failure_reason'),
    createdAt: integer('created_at').notNull(),
    paidAt: integer('paid_at'),
  },
  (t) => [
    uniqueIndex('orders_user_idempotency_idx').on(t.userId, t.idempotencyKey),
    check('orders_type_check', sql`${t.type} in ('book', 'subscription')`),
    check('orders_status_check', sql`${t.status} in ('pending', 'paid', 'failed')`),
    check('orders_amount_check', sql`${t.amountIdr} > 0`),
    check(
      'orders_target_check',
      sql`(${t.type} = 'book' and ${t.bookId} is not null) or (${t.type} = 'subscription' and ${t.planId} is not null)`,
    ),
  ],
);

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id),
    status: text('status', { enum: ['active', 'expired'] }).notNull(),
    currentPeriodStart: integer('current_period_start').notNull(),
    currentPeriodEnd: integer('current_period_end').notNull(),
    cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdOrderId: text('created_order_id')
      .notNull()
      .references(() => orders.id),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    check('subscriptions_status_check', sql`${t.status} in ('active', 'expired')`),
    check('subscriptions_period_check', sql`${t.currentPeriodEnd} > ${t.currentPeriodStart}`),
    // One active subscription per user. Expiry is lazy, so checkout flips an
    // elapsed row to 'expired' before inserting a new one.
    uniqueIndex('subscriptions_one_active_idx')
      .on(t.userId)
      .where(sql`${t.status} = 'active'`),
    index('subscriptions_user_status_idx').on(t.userId, t.status),
  ],
);

export const purchases = sqliteTable(
  'purchases',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    pricePaidIdr: integer('price_paid_idr').notNull(),
    purchasedAt: integer('purchased_at').notNull(),
  },
  // The unique (user_id, book_id) index also serves lookups by user_id.
  (t) => [uniqueIndex('purchases_user_book_idx').on(t.userId, t.bookId)],
);

export const events = sqliteTable(
  'events',
  {
    id: id(),
    userId: text('user_id').references(() => users.id),
    name: text('name').notNull(),
    bookId: text('book_id').references(() => books.id),
    props: text('props'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('events_name_created_idx').on(t.name, t.createdAt)],
);
