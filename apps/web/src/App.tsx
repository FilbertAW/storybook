import { useEffect, useState } from 'react'
import { healthResponseSchema } from '@storylib/shared'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

type ApiStatus = 'checking' | 'ok' | 'down'

export default function App() {
  const [status, setStatus] = useState<ApiStatus>('checking')

  useEffect(() => {
    fetch(`${API_URL}/api/v1/health`)
      .then((res) => res.json())
      .then((body) => {
        healthResponseSchema.parse(body)
        setStatus('ok')
      })
      .catch(() => setStatus('down'))
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 p-6">
      <h1 className="text-2xl font-semibold">Storybook Library</h1>
      <p className="text-sm text-neutral-600">API: {status}</p>
    </main>
  )
}
