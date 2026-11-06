import { createBrowserRouter } from 'react-router'
import { NotFound } from '@/components/NotFound'
import { AccountPage } from '@/features/account/AccountPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { BookDetailPage } from '@/features/book/BookDetailPage'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'
import { BookFormPage } from '@/features/creator/BookFormPage'
import { CreatorDashboard } from '@/features/creator/CreatorDashboard'
import { KidLibraryPage } from '@/features/kid/KidLibraryPage'
import { KidShell } from '@/features/kid/KidShell'
import { LibraryPage } from '@/features/library/LibraryPage'
import { ReaderPage } from '@/features/reader/ReaderPage'
import { ParentShell } from './ParentShell'
import { RoleGuard } from './RoleGuard'
import { SessionGate } from './SessionGate'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <SessionGate />,
    children: [
      {
        element: <ParentShell />,
        children: [
          { path: '/', element: <LibraryPage /> },
          { path: '/books/:id', element: <BookDetailPage /> },
          { path: '/books/:id/read', element: <ReaderPage /> },
          { path: '/account', element: <AccountPage /> },
          {
            element: <RoleGuard role="parent" />,
            children: [
              { path: '/checkout/book/:id', element: <CheckoutPage kind="book" /> },
              { path: '/checkout/subscription', element: <CheckoutPage kind="subscription" /> },
            ],
          },
          {
            element: <RoleGuard role="creator" />,
            children: [
              { path: '/creator', element: <CreatorDashboard /> },
              { path: '/creator/new', element: <BookFormPage /> },
              { path: '/creator/:id/edit', element: <BookFormPage /> },
            ],
          },
        ],
      },
      {
        path: '/kid',
        element: <KidShell />,
        children: [
          { index: true, element: <KidLibraryPage /> },
          { path: 'books/:id/read', element: <ReaderPage kid /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
])
