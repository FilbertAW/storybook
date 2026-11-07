import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createBookRequestSchema } from '@storylib/shared'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '@/api/errors'
import { creatorApi } from '@/api/endpoints'
import { keys, useCreatorBook } from '@/api/queries'
import { LoadingButton } from '@/components/LoadingButton'
import { ErrorNotice, Loading } from '@/components/PageState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { type TranslationKey, useT } from '@/i18n'

interface PageDraft {
  text: string
  imageUrl: string
  idText: string // the page in Indonesian, '' for none
}

interface FormValues {
  title: string
  authorName: string
  description: string
  coverUrl: string
  ageMin: string
  ageMax: string
  priceIdr: string
  previewPageCount: string
  idTitle: string
  idDescription: string
  pages: PageDraft[]
}

// Placeholder pictures so a new book can be filled in quickly; the creator can paste real URLs.
const sample = (seed: string, size: string) => `https://picsum.photos/seed/${seed}/${size}`
const randomSeed = () => Math.random().toString(36).slice(2, 8)
const newPage = (): PageDraft => ({ text: '', imageUrl: sample(randomSeed(), '800/600'), idText: '' })

const blank = (): FormValues => ({
  title: '',
  authorName: '',
  description: '',
  coverUrl: sample(randomSeed(), '600/800'),
  ageMin: '3',
  ageMax: '6',
  priceIdr: '15000',
  previewPageCount: '2',
  idTitle: '',
  idDescription: '',
  pages: [newPage(), newPage()],
})

const FIELD_LABEL: Record<string, TranslationKey> = {
  title: 'form.title',
  authorName: 'form.author',
  description: 'form.description',
  coverUrl: 'form.cover',
  ageMin: 'form.ageMin',
  ageMax: 'form.ageMax',
  priceIdr: 'form.price',
  previewPageCount: 'form.preview',
}

export function BookFormPage() {
  const { t } = useT()
  const { id } = useParams()
  const editing = !!id
  // The creator's own copy: the original text, whatever language the app is shown in.
  const loaded = useCreatorBook(id)

  if (!editing) return <BookForm initial={blank()} />
  if (loaded.isPending) return <Loading />
  if (loaded.isError) {
    return loaded.error instanceof ApiError && loaded.error.code === 'NOT_FOUND' ? (
      <ErrorNotice message={t('form.bookNotFound')} title={t('common.notFound')} />
    ) : (
      <ErrorNotice error={loaded.error} />
    )
  }

  const book = loaded.data
  const idVersion = book.translations.id

  return (
    <BookForm
      bookId={book.id}
      initial={{
        title: book.title,
        authorName: book.authorName,
        description: book.description,
        coverUrl: book.coverUrl,
        ageMin: String(book.ageMin),
        ageMax: String(book.ageMax),
        priceIdr: String(book.priceIdr),
        previewPageCount: String(book.previewPageCount),
        idTitle: idVersion?.title ?? '',
        idDescription: idVersion?.description ?? '',
        pages: book.pages.map((p, i) => ({ text: p.text, imageUrl: p.imageUrl, idText: idVersion?.pages[i] ?? '' })),
      }}
    />
  )
}

function BookForm({ initial, bookId }: { initial: FormValues; bookId?: string }) {
  const { t } = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState(initial)
  const [problems, setProblems] = useState<string[]>([])

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((v) => ({ ...v, [key]: value }))
  const setPage = (index: number, patch: Partial<PageDraft>) =>
    set('pages', values.pages.map((p, i) => (i === index ? { ...p, ...patch } : p)))

  const save = useMutation({
    mutationFn: async (body: ReturnType<typeof createBookRequestSchema.parse>) => {
      return bookId ? creatorApi.update(bookId, body) : creatorApi.create(body)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.creatorBooks }),
        queryClient.invalidateQueries({ queryKey: keys.books }),
      ])
      navigate('/creator')
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    // The same schema the server uses, so the form and the API agree on what is valid.
    const result = createBookRequestSchema.safeParse({
      title: values.title,
      authorName: values.authorName.trim() || undefined,
      description: values.description,
      coverUrl: values.coverUrl,
      ageMin: Number(values.ageMin),
      ageMax: Number(values.ageMax),
      priceIdr: Number(values.priceIdr),
      previewPageCount: Number(values.previewPageCount),
      pages: values.pages.map((p) => ({ text: p.text, imageUrl: p.imageUrl })),
      // Always sent, so emptying the fields removes an existing translation.
      translations: {
        id: { title: values.idTitle, description: values.idDescription, pages: values.pages.map((p) => p.idText) },
      },
    })
    if (!result.success) {
      setProblems(
        result.error.issues.map((issue) => {
          const [head, index, sub] = issue.path
          if (head === 'ageMax' && issue.code === 'custom') return t('form.ageRange')
          if (head === 'translations') return t('form.translationPair')
          const field =
            head === 'pages' && typeof index === 'number'
              ? t(sub === 'imageUrl' ? 'form.pageImage' : 'form.pageText', { n: index + 1 })
              : head === 'pages'
                ? t('form.pages', { count: values.pages.length })
                : t(FIELD_LABEL[String(head)] ?? 'common.error')
          return t('form.problem', { field })
        }),
      )
      return
    }
    setProblems([])
    save.mutate(result.data)
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start" render={<Link to="/creator" />} nativeButton={false}>
        <ArrowLeft /> {t('form.back')}
      </Button>
      <h1 className="text-xl font-semibold">{bookId ? t('form.edit') : t('form.new')}</h1>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-4">
            <Field label={t('form.title')} id="title">
              <Input id="title" value={values.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label={t('form.author')} id="author">
              <Input id="author" value={values.authorName} onChange={(e) => set('authorName', e.target.value)} />
            </Field>
            <Field label={t('form.description')} id="description">
              <Textarea id="description" rows={3} value={values.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
            <Field label={t('form.cover')} id="cover">
              <Input id="cover" value={values.coverUrl} onChange={(e) => set('coverUrl', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label={t('form.ageMin')} id="age-min">
                <Input id="age-min" type="number" min={0} max={12} value={values.ageMin} onChange={(e) => set('ageMin', e.target.value)} />
              </Field>
              <Field label={t('form.ageMax')} id="age-max">
                <Input id="age-max" type="number" min={0} max={12} value={values.ageMax} onChange={(e) => set('ageMax', e.target.value)} />
              </Field>
              <Field label={t('form.price')} id="price">
                <Input id="price" type="number" min={1} step={1000} value={values.priceIdr} onChange={(e) => set('priceIdr', e.target.value)} />
              </Field>
              <Field label={t('form.preview')} id="preview">
                <Input id="preview" type="number" min={0} value={values.previewPageCount} onChange={(e) => set('previewPageCount', e.target.value)} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('form.idSection')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('form.idHint')}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label={t('form.idTitle')} id="id-title">
              <Input id="id-title" value={values.idTitle} onChange={(e) => set('idTitle', e.target.value)} />
            </Field>
            <Field label={t('form.idDescription')} id="id-description">
              <Textarea id="id-description" rows={3} value={values.idDescription} onChange={(e) => set('idDescription', e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('form.pages', { count: values.pages.length })}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {values.pages.map((page, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('form.page', { n: i + 1 })}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('form.removePage', { n: i + 1 })}
                    disabled={values.pages.length === 1}
                    onClick={() => set('pages', values.pages.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <Textarea aria-label={t('form.pageText', { n: i + 1 })} rows={2} placeholder={t('form.storyPlaceholder')} value={page.text} onChange={(e) => setPage(i, { text: e.target.value })} />
                <Textarea aria-label={t('form.idPageText', { n: i + 1 })} rows={2} placeholder={t('form.idPagePlaceholder')} value={page.idText} onChange={(e) => setPage(i, { idText: e.target.value })} />
                <Input aria-label={t('form.pageImage', { n: i + 1 })} placeholder={t('form.imagePlaceholder')} value={page.imageUrl} onChange={(e) => setPage(i, { imageUrl: e.target.value })} />
              </div>
            ))}
            <Button type="button" variant="outline" className="self-start" onClick={() => set('pages', [...values.pages, newPage()])}>
              <Plus /> {t('form.addPage')}
            </Button>
          </CardContent>
        </Card>

        {problems.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>{t('form.fix')}</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {save.isError && <ErrorNotice error={save.error} title={t('form.saveError')} />}

        <div className="flex gap-2">
          <LoadingButton type="submit" size="lg" pending={save.isPending}>
            {bookId ? t('form.save') : t('form.publish')}
          </LoadingButton>
          <Button type="button" size="lg" variant="ghost" render={<Link to="/creator" />} nativeButton={false}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
