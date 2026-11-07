import {
  authResponseSchema,
  bookPagesResponseSchema,
  booksResponseSchema,
  bookSummarySchema,
  creatorBookWithPagesSchema,
  creatorBooksResponseSchema,
  deleteBookResponseSchema,
  meResponseSchema,
  orderSchema,
  ordersResponseSchema,
  plansResponseSchema,
  setPinResponseSchema,
  subscriptionSummarySchema,
  type CreateBookRequest,
  type CreateOrderRequest,
  type UpdateBookRequest,
} from '@storylib/shared'
import { request } from './client'

export const authApi = {
  login: (email: string) => request('/auth/login', authResponseSchema, { method: 'POST', json: { email } }),
  enterKidMode: () => request('/auth/kid-mode', authResponseSchema, { method: 'POST' }),
  parentUnlock: (pin: string) =>
    request('/auth/parent-unlock', authResponseSchema, { method: 'POST', json: { pin } }),
  setPin: (pin: string, currentPin?: string) =>
    request('/me/pin', setPinResponseSchema, { method: 'PUT', json: { pin, currentPin } }),
  me: () => request('/me', meResponseSchema),
}

export interface BookFilters {
  q?: string
  age?: number
  access?: 'all' | 'full' | 'locked'
}

export const booksApi = {
  list: ({ q, age, access }: BookFilters = {}) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (age !== undefined) params.set('age', String(age))
    if (access && access !== 'all') params.set('access', access)
    const query = params.toString()
    return request(`/books${query ? `?${query}` : ''}`, booksResponseSchema)
  },
  get: (id: string) => request(`/books/${id}`, bookSummarySchema),
  pages: (id: string) => request(`/books/${id}/pages`, bookPagesResponseSchema),
}

export const checkoutApi = {
  plans: () => request('/plans', plansResponseSchema),
  orders: () => request('/orders', ordersResponseSchema),
  createOrder: (idempotencyKey: string, body: CreateOrderRequest) =>
    request('/orders', orderSchema, {
      method: 'POST',
      json: body,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  pay: (orderId: string, simulate: 'success' | 'fail') =>
    request(`/orders/${orderId}/pay`, orderSchema, { method: 'POST', json: { simulate } }),
  cancelSubscription: () =>
    request('/subscriptions/current/cancel', subscriptionSummarySchema, { method: 'POST' }),
}

export const creatorApi = {
  list: () => request('/creator/books', creatorBooksResponseSchema),
  // The original text plus the Indonesian version: what the edit form works on.
  get: (id: string) => request(`/creator/books/${id}`, creatorBookWithPagesSchema),
  create: (body: CreateBookRequest) =>
    request('/books', creatorBookWithPagesSchema, { method: 'POST', json: body }),
  update: (id: string, body: UpdateBookRequest) =>
    request(`/books/${id}`, creatorBookWithPagesSchema, { method: 'PATCH', json: body }),
  remove: (id: string) => request(`/books/${id}`, deleteBookResponseSchema, { method: 'DELETE' }),
}

// Product analytics are best effort: a failed event must never break reading.
export const logEvent = (name: string, bookId?: string) => {
  void request('/events', null, { method: 'POST', json: { name, bookId } }).catch(() => undefined)
}
