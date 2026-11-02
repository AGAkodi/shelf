import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppErrorBoundary } from '../../src/app/AppErrorBoundary'
import { RouteErrorBoundary } from '../../src/app/RouteErrorBoundary'
import { LoadingState } from '../../src/components/states/LoadingState'

function BrokenChild(): never { throw new Error('Internal failure must not be shown') }

describe('failure and loading states', () => {
  it('provides an accessible loading announcement', () => {
    render(<LoadingState />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading page')
  })
  it('contains render failures without showing internal details', () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(<AppErrorBoundary><BrokenChild /></AppErrorBoundary>)
      expect(screen.getByRole('alert')).toHaveTextContent('This page could not load')
      expect(screen.queryByText('Internal failure must not be shown')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
    } finally { errorLog.mockRestore() }
  })
  it('renders a route error boundary for failed route loaders', async () => {
    const router = createMemoryRouter([{
      path: '/', loader: () => { throw new Error('Private loader detail') },
      Component: () => <p>Unexpected success</p>, ErrorBoundary: RouteErrorBoundary,
      HydrateFallback: LoadingState,
    }])
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('This page could not load')
    expect(screen.queryByText('Private loader detail')).not.toBeInTheDocument()
  })
})
