import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createBookRequestSchema } from '@storylib/shared'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { creatorApi } from '@/api/endpoints'
import { keys, useBookPages, useCreatorBooks } from '@/api/queries'
import { LoadingButton } from '@/components/LoadingButton'
import { ErrorNotice, Loading } from '@/components/PageState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface PageDraft {
  text: string
  imageUrl: string
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
  pages: PageDraft[]
}

// Placeholder pictures so a new book can be filled in quickly; the creator can paste real URLs.
const sample = (seed: string, size: string) => `https://picsum.photos/seed/${seed}/${size}`
const randomSeed = () => Math.random().toString(36).slice(2, 8)
const newPage = (): PageDraft => ({ text: '', imageUrl: sample(randomSeed(), '800/600') })

const blank = (): FormValues => ({
  title: '',
  authorName: '',
  description: '',
  coverUrl: sample(randomSeed(), '600/800'),
  ageMin: '3',
  ageMax: '6',
  priceIdr: '15000',
  previewPageCount: '2',
  pages: [newPage(), newPage()],
})

export function BookFormPage() {
  const { id } = useParams()
  const editing = !!id
  const books = useCreatorBooks()
  const pages = useBookPages(id)

  if (!editing) return <BookForm initial={blank()} />
  if (books.isPending || pages.isPending) return <Loading />
  if (books.isError) return <ErrorNotice error={books.error} />
  if (pages.isError) return <ErrorNotice error={pages.error} />

  const book = books.data.books.find((b) => b.id === id)
  if (!book) return <ErrorNotice error={new Error('Book not found.')} title="Not found" />

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
        pages: pages.data.pages.map((p) => ({ text: p.text, imageUrl: p.imageUrl })),
      }}
    />
  )
}

function BookForm({ initial, bookId }: { initial: FormValues; bookId?: string }) {
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
      pages: values.pages,
    })
    if (!result.success) {
      setProblems(result.error.issues.map((i) => `${i.path.join(' › ') || 'Form'}: ${i.message}`))
      return
    }
    setProblems([])
    save.mutate(result.data)
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start" render={<Link to="/creator" />} nativeButton={false}>
        <ArrowLeft /> Your books
      </Button>
      <h1 className="text-xl font-semibold">{bookId ? 'Edit book' : 'New book'}</h1>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-4">
            <Field label="Title" id="title">
              <Input id="title" value={values.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="Author name (defaults to your name)" id="author">
              <Input id="author" value={values.authorName} onChange={(e) => set('authorName', e.target.value)} />
            </Field>
            <Field label="Description" id="description">
              <Textarea id="description" rows={3} value={values.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
            <Field label="Cover image URL" id="cover">
              <Input id="cover" value={values.coverUrl} onChange={(e) => set('coverUrl', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Age from" id="age-min">
                <Input id="age-min" type="number" min={0} max={12} value={values.ageMin} onChange={(e) => set('ageMin', e.target.value)} />
              </Field>
              <Field label="Age to" id="age-max">
                <Input id="age-max" type="number" min={0} max={12} value={values.ageMax} onChange={(e) => set('ageMax', e.target.value)} />
              </Field>
              <Field label="Price (Rp)" id="price">
                <Input id="price" type="number" min={1} step={1000} value={values.priceIdr} onChange={(e) => set('priceIdr', e.target.value)} />
              </Field>
              <Field label="Free preview pages" id="preview">
                <Input id="preview" type="number" min={0} value={values.previewPageCount} onChange={(e) => set('previewPageCount', e.target.value)} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pages ({values.pages.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {values.pages.map((page, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Page {i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove page ${i + 1}`}
                    disabled={values.pages.length === 1}
                    onClick={() => set('pages', values.pages.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <Textarea aria-label={`Page ${i + 1} text`} rows={2} placeholder="A line or two of story" value={page.text} onChange={(e) => setPage(i, { text: e.target.value })} />
                <Input aria-label={`Page ${i + 1} image URL`} placeholder="Image URL" value={page.imageUrl} onChange={(e) => setPage(i, { imageUrl: e.target.value })} />
              </div>
            ))}
            <Button type="button" variant="outline" className="self-start" onClick={() => set('pages', [...values.pages, newPage()])}>
              <Plus /> Add a page
            </Button>
          </CardContent>
        </Card>

        {problems.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Please fix these</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {save.isError && <ErrorNotice error={save.error} title="Could not save the book" />}

        <div className="flex gap-2">
          <LoadingButton type="submit" size="lg" pending={save.isPending}>
            {bookId ? 'Save changes' : 'Publish book'}
          </LoadingButton>
          <Button type="button" size="lg" variant="ghost" render={<Link to="/creator" />} nativeButton={false}>
            Cancel
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
