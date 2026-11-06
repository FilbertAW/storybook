import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { setUnauthenticatedHandler } from '@/api/client'
import { queryClient } from '@/app/queryClient'
import { router } from '@/app/router'
import { endSession } from '@/features/session/actions'
import './index.css'

// A token the server rejects ends the session; the gate then sends the user to /login.
setUnauthenticatedHandler(endSession)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
