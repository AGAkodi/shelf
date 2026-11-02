import type { RouteObject } from 'react-router'
import { AppLayout } from '../components/layout/AppLayout'
import { LoadingState } from '../components/states/LoadingState'
import { RouteErrorBoundary } from './RouteErrorBoundary'

export const routes: RouteObject[] = [{
  Component: AppLayout,
  ErrorBoundary: RouteErrorBoundary,
  HydrateFallback: LoadingState,
  children: [
    { index: true, handle: { title: 'Home' }, lazy: () => import('../pages/HomePage') },
    { path: 'explore', handle: { title: 'Explore' }, lazy: () => import('../pages/ExplorePage') },
    { path: 'books/:bookId', handle: { title: 'Book Details' }, lazy: () => import('../pages/BookDetailsPage') },
    { path: 'checkout/:bookId', handle: { title: 'Payment / Checkout' }, lazy: () => import('../pages/CheckoutPage') },
    { path: 'library', handle: { title: 'My Library' }, lazy: () => import('../pages/LibraryPage') },
    { path: 'read/:loanId', handle: { title: 'Reading Interface' }, lazy: () => import('../pages/ReaderPage') },
    { path: 'transactions', handle: { title: 'Transactions' }, lazy: () => import('../pages/TransactionsPage') },
    { path: 'admin', handle: { title: 'Admin Dashboard' }, lazy: () => import('../pages/AdminPage') },
    { path: 'contribute', handle: { title: 'Contributor Application' }, lazy: () => import('../pages/ContributePage') },
    { path: '*', handle: { title: 'Page not found' }, lazy: () => import('../pages/NotFoundPage') },
  ],
}]
