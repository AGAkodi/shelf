import { BookOpen } from 'lucide-react'
import { Link } from 'react-router'

export function PlaceholderPage({ eyebrow, title, description, detail }: {
  eyebrow: string; title: string; description: string; detail: string
}) {
  return (
    <section>
      <div className="mb-10 max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        <p className="max-w-xl text-sm leading-7 text-muted">{description}</p>
      </div>
      <div className="state-card">
        <div className="mb-6 inline-flex size-12 items-center justify-center rounded-xl border border-line bg-accent/10 text-accent"><BookOpen size={23} aria-hidden="true" /></div>
        <p className="eyebrow mb-3">Foundation placeholder</p>
        <h2 className="font-display text-2xl text-ink">A space for your next chapter.</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted">{detail}</p>
        <Link to="/" className="button-secondary mt-6">Back to home</Link>
      </div>
    </section>
  )
}
