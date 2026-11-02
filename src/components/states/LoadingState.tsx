import { LoaderCircle } from 'lucide-react'

export function LoadingState({ label = 'Loading page…' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-56 flex-col items-center justify-center gap-4 p-8 text-muted">
      <LoaderCircle aria-hidden="true" className="size-6 animate-spin motion-reduce:animate-none text-accent" />
      <span>{label}</span>
    </div>
  )
}
