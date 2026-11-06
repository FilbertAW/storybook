import { Link } from 'react-router'

export function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/" className="text-sm underline">
        Back to the library
      </Link>
    </div>
  )
}
