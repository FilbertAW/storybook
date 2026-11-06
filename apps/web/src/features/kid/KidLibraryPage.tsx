import { Link } from 'react-router'
import { useBooks } from '@/api/queries'
import { Empty, ErrorNotice, Loading } from '@/components/PageState'

export function KidLibraryPage() {
  const books = useBooks({})

  if (books.isPending) return <Loading />
  if (books.isError) return <ErrorNotice error={books.error} title="Could not load books" />
  if (books.data.books.length === 0) return <Empty>No books to read yet. Ask a grown-up to unlock some.</Empty>

  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
      {books.data.books.map((book) => (
        <Link
          key={book.id}
          to={`/kid/books/${book.id}/read`}
          className="flex flex-col gap-2 rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
        >
          <img src={book.coverUrl} alt="" className="aspect-[3/4] w-full rounded-2xl bg-muted object-cover shadow-md" />
          <span className="text-center text-base leading-tight font-medium">{book.title}</span>
        </Link>
      ))}
    </div>
  )
}
