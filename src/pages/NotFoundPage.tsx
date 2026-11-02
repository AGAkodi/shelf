import { Link } from 'react-router'
export function Component() {
  return <section className="state-card"><p className="eyebrow">404</p><h1 className="page-title">Page not found</h1><p className="text-sm text-muted">This page is not on the shelf.</p><Link to="/" className="button-primary mt-6">Back to home</Link></section>
}
