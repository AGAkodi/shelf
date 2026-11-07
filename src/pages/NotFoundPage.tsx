import { Link } from 'react-router'
export function Component() {
  return <section className="empty-panel enter"><p className="meta tabular">404</p><h1 className="page-title mt-2">Page not found</h1><p>This page is not on the shelf.</p><Link to="/" className="button-primary">Back to home</Link></section>
}
