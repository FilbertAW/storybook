import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSessionStore } from '@/stores/session'
import { authApi, booksApi, checkoutApi, creatorApi, type BookFilters } from './endpoints'

// Server data lives only here. The keys are shared so one invalidation reaches every view.
export const keys = {
  me: ['me'] as const,
  books: ['books'] as const,
  bookList: (filters: BookFilters) => ['books', 'list', filters] as const,
  book: (id: string) => ['books', 'detail', id] as const,
  pages: (id: string) => ['books', 'pages', id] as const,
  orders: ['orders'] as const,
  plans: ['plans'] as const,
  creatorBooks: ['creator-books'] as const,
}

// A kid token is refused by /me, so it is only fetched in parent mode.
export const useMe = () => {
  const { token, mode } = useSessionStore()
  return useQuery({ queryKey: keys.me, queryFn: authApi.me, enabled: !!token && mode === 'parent' })
}

export const useBooks = (filters: BookFilters) =>
  useQuery({
    queryKey: keys.bookList(filters),
    queryFn: () => booksApi.list(filters),
    placeholderData: keepPreviousData,
  })

export const useBook = (id: string | undefined) =>
  useQuery({ queryKey: keys.book(id ?? ''), queryFn: () => booksApi.get(id!), enabled: !!id })

export const useBookPages = (id: string | undefined) =>
  useQuery({ queryKey: keys.pages(id ?? ''), queryFn: () => booksApi.pages(id!), enabled: !!id })

export const useOrders = () => useQuery({ queryKey: keys.orders, queryFn: checkoutApi.orders })

export const usePlans = (enabled = true) =>
  useQuery({ queryKey: keys.plans, queryFn: checkoutApi.plans, enabled })

export const useCreatorBooks = () =>
  useQuery({ queryKey: keys.creatorBooks, queryFn: creatorApi.list })
