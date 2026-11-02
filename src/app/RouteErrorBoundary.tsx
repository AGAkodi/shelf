import { isRouteErrorResponse, useRevalidator, useRouteError } from 'react-router'
import { ErrorState } from '../components/states/ErrorState'

export function RouteErrorBoundary() {
  const error = useRouteError()
  const revalidator = useRevalidator()
  const unavailable = isRouteErrorResponse(error) && error.status === 404
  return <ErrorState title={unavailable ? 'Page not found' : undefined} onRetry={() => { void revalidator.revalidate() }} />
}
