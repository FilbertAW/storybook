import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreatorBookDto } from '@storylib/shared'
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { creatorApi } from '@/api/endpoints'
import { keys, useCreatorBooks } from '@/api/queries'
import { Empty, ErrorNotice, Loading } from '@/components/PageState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatIdr } from '@/lib/format'

const STATUS_VARIANT = { published: 'default', draft: 'secondary', archived: 'outline' } as const

export function CreatorDashboard() {
  const queryClient = useQueryClient()
  const books = useCreatorBooks()
  const [deleting, setDeleting] = useState<CreatorBookDto | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.creatorBooks }),
      queryClient.invalidateQueries({ queryKey: keys.books }),
    ])
  }

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'draft' | 'published' }) => creatorApi.update(id, { status }),
    onSuccess: refresh,
  })

  const remove = useMutation({
    mutationFn: (id: string) => creatorApi.remove(id),
    onSuccess: async ({ result }) => {
      setNotice(
        result === 'deleted'
          ? `"${deleting?.title}" was deleted.`
          : `"${deleting?.title}" has buyers, so it was retired instead. They can still read it.`,
      )
      setDeleting(null)
      await refresh()
    },
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Your books</h1>
        <Button render={<Link to="/creator/new" />} nativeButton={false}>
          <Plus /> New book
        </Button>
      </div>

      {notice && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {setStatus.isError && <ErrorNotice error={setStatus.error} title="Could not change the status" />}

      {books.isPending && <Loading />}
      {books.isError && <ErrorNotice error={books.error} />}
      {books.data && books.data.books.length === 0 && <Empty>You have no books yet. Create your first one.</Empty>}
      {books.data && books.data.books.length > 0 && (
        <ul className="flex flex-col divide-y rounded-xl border">
          {books.data.books.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 p-3">
              <img src={b.coverUrl} alt="" className="h-16 w-12 rounded-md bg-muted object-cover" />
              <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
                <span className="truncate font-medium">{b.title}</span>
                <span className="text-xs text-muted-foreground">
                  {b.pageCount} pages · {formatIdr(b.priceIdr)} · Ages {b.ageMin}–{b.ageMax}
                </span>
                <Badge variant={STATUS_VARIANT[b.status]} className="w-fit">
                  {b.status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {b.status !== 'archived' && (
                  <>
                    <Button variant="outline" size="sm" render={<Link to={`/creator/${b.id}/edit`} />} nativeButton={false}>
                      <Pencil /> Edit
                    </Button>
                    {b.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: b.id, status: 'published' })}
                      >
                        <Eye /> Publish
                      </Button>
                    )}
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => setDeleting(b)}>
                  <Trash2 /> {b.status === 'archived' ? 'Remove' : 'Delete'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleting?.title}"?</DialogTitle>
            <DialogDescription>
              If nobody has ordered it, it is deleted for good. If it has buyers, it is retired instead: hidden from the
              catalog, but still readable by everyone who bought it.
            </DialogDescription>
          </DialogHeader>
          {remove.isError && <ErrorNotice error={remove.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
