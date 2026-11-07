import { Loader2, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useBooks } from '@/api/queries'
import type { BookSummaryDto } from '@storylib/shared'
import { BookCard } from '@/components/BookCard'
import { Empty, ErrorNotice, Loading } from '@/components/PageState'
import { Input } from '@/components/ui/input'
import { type TranslationKey, useT } from '@/i18n'
import { BookPreviewDialog } from '@/features/library/BookPreviewDialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Tab = 'all' | 'full' | 'locked'

const TABS: Array<{ value: Tab; label: TranslationKey; empty: TranslationKey }> = [
  { value: 'all', label: 'library.tab.all', empty: 'library.empty.all' },
  { value: 'full', label: 'library.tab.full', empty: 'library.empty.full' },
  { value: 'locked', label: 'library.tab.locked', empty: 'library.empty.locked' },
]

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

export function LibraryPage() {
  const { t } = useT()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [previewing, setPreviewing] = useState<BookSummaryDto | null>(null)
  const q = useDebounced(search.trim(), 300)

  const books = useBooks({ access: tab, q: q || undefined })
  const emptyKey = TABS.find((x) => x.value === tab)!.empty

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">{t('library.title')}</h1>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            {TABS.map((x) => (
              <TabsTrigger key={x.value} value={x.value}>
                {t(x.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('library.searchPlaceholder')}
              aria-label={t('library.search')}
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {books.isPending && <Loading />}
      {books.isError && <ErrorNotice error={books.error} title={t('library.loadError')} />}
      {books.data && (
        // The previous results stay on screen while a new tab or search loads; dim them and say so.
        <div className="relative" aria-busy={books.isPlaceholderData}>
          <div className={books.isPlaceholderData ? 'pointer-events-none opacity-40 transition-opacity' : 'transition-opacity'}>
            {books.data.books.length === 0 ? (
              <Empty>{t(emptyKey)}</Empty>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
                {books.data.books.map((book) => (
                  <BookCard key={book.id} book={book} onPreview={setPreviewing} />
                ))}
              </div>
            )}
          </div>
          {books.isPlaceholderData && (
            <div role="status" className="absolute inset-x-0 top-12 flex justify-center">
              <span className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm shadow-sm">
                <Loader2 className="size-4 animate-spin" /> {t('library.updating')}
              </span>
            </div>
          )}
        </div>
      )}
      {previewing && <BookPreviewDialog key={previewing.id} book={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  )
}
