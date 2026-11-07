import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useLocaleStore } from '@/i18n'
import { useSessionStore } from '@/stores/session'
import { authApi, booksApi, checkoutApi, creatorApi, type BookFilters } from './endpoints'

// Server data lives only here. The keys are shared so one invalidation reaches every view.
export const keys = {
  me: ['me'] as const,
  books: ['books'] as const,
  // Book text depends on the language, so it is part of the key: switching refetches.
  bookList: (filters: BookFilters, locale: string) => ['books', 'list', filters, locale] as const,
  book: (id: string, locale: string) => ['books', 'detail', id, locale] as const,
  pages: (id: string, locale: string) => ['books', 'pages', id, locale] as const,
  orders: ['orders'] as const,
  plans: ['plans'] as const,
  creatorBooks: ['creator-books'] as const,
}

// A kid token is refused by /me, so it is only fetched in parent mode.
export const useMe = () => {
  const { token, mode } = useSessionStore()
  return useQuery({ queryKey: keys.me, queryFn: authApi.me, enabled: !!token && mode === 'parent' })
}

export const useBooks = (filters: BookFilters) => {
  const locale = useLocaleStore((s) => s.locale)
  return useQuery({
    queryKey: keys.bookList(filters, locale),
    queryFn: () => booksApi.list(filters),
    placeholderData: keepPreviousData,
  })
}

export const useBook = (id: string | undefined) => {
  const locale = useLocaleStore((s) => s.locale)
  return useQuery({ queryKey: keys.book(id ?? '', locale), queryFn: () => booksApi.get(id!), enabled: !!id })
}

export const useBookPages = (id: string | undefined) => {
  const locale = useLocaleStore((s) => s.locale)
  return useQuery({ queryKey: keys.pages(id ?? '', locale), queryFn: () => booksApi.pages(id!), enabled: !!id })
}

// Order history carries book titles, so it follows the language too.
export const useOrders = () => {
  const locale = useLocaleStore((s) => s.locale)
  return useQuery({ queryKey: [...keys.orders, locale], queryFn: checkoutApi.orders })
}

export const usePlans = (enabled = true) =>
  useQuery({ queryKey: keys.plans, queryFn: checkoutApi.plans, enabled })

export const useCreatorBooks = () =>
  useQuery({ queryKey: keys.creatorBooks, queryFn: creatorApi.list })
