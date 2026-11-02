import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

export function ErrorState({ title = 'This page could not load', children, onRetry }: {
  title?: string; children?: ReactNode; onRetry?: () => void
}) {
  return (
    <section role="alert" className="state-card mx-auto my-12 max-w-xl text-center">
      <AlertCircle aria-hidden="true" className="mx-auto mb-5 size-8 text-accent" />
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="mt-4 text-sm leading-7 text-muted">{children ?? 'Please try again. If the problem continues, reload Shelf.'}</p>
      {onRetry && <button className="button-primary mt-6" onClick={onRetry}>Try again</button>}
      <a className="button-secondary mt-4" href="/">Back to home</a>
    </section>
  )
}
