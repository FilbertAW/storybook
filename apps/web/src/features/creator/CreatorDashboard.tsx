import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreatorBookDto } from '@storylib/shared'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { creatorApi } from '@/api/endpoints'
import { keys, useCreatorBooks } from '@/api/queries'
import { LoadingButton } from '@/components/LoadingButton'
import { Empty, ErrorNotice, Loading } from '@/components/PageState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useT } from '@/i18n'
import { formatIdr } from '@/lib/format'

const STATUS_VARIANT = { published: 'default', archived: 'outline' } as const

export function CreatorDashboard() {
  const { t } = useT()
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

  const remove = useMutation({
    mutationFn: (id: string) => creatorApi.remove(id),
    onSuccess: async ({ result }) => {
      setNotice(
        result === 'deleted'
          ? t('creator.deleted', { title: deleting?.title ?? '' })
          : t('creator.retired', { title: deleting?.title ?? '' }),
      )
      setDeleting(null)
      await refresh()
    },
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('creator.title')}</h1>
        <Button render={<Link to="/creator/new" />} nativeButton={false}>
          <Plus /> {t('creator.new')}
        </Button>
      </div>

      {notice && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {books.isPending && <Loading />}
      {books.isError && <ErrorNotice error={books.error} />}
      {books.data && books.data.books.length === 0 && <Empty>{t('creator.empty')}</Empty>}
      {books.data && books.data.books.length > 0 && (
        <ul className="flex flex-col divide-y rounded-xl border">
          {books.data.books.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 p-3">
              <img src={b.coverUrl} alt="" className="h-16 w-12 rounded-md bg-muted object-cover" />
              <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
                <span className="truncate font-medium">{b.title}</span>
                <span className="text-xs text-muted-foreground">
                  {t('creator.row', { pages: b.pageCount, price: formatIdr(b.priceIdr), min: b.ageMin, max: b.ageMax })}
                </span>
                <Badge variant={STATUS_VARIANT[b.status]} className="w-fit">
                  {t(b.status === 'published' ? 'creator.status.published' : 'creator.status.archived')}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {b.status !== 'archived' && (
                  <>
                    <Button variant="outline" size="sm" render={<Link to={`/creator/${b.id}/edit`} />} nativeButton={false}>
                      <Pencil /> {t('creator.edit')}
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => setDeleting(b)}>
                  <Trash2 /> {b.status === 'archived' ? t('creator.remove') : t('creator.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('creator.dialogTitle', { title: deleting?.title ?? '' })}</DialogTitle>
            <DialogDescription>
              {t('creator.dialogBody')}
            </DialogDescription>
          </DialogHeader>
          {remove.isError && <ErrorNotice error={remove.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('creator.keep')}
            </Button>
            <LoadingButton variant="destructive" pending={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>
              {t('creator.delete')}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
