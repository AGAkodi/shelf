import { ArrowUpRight, BookOpen } from 'lucide-react'
import { Link } from 'react-router'
import { useState, type ReactNode } from 'react'
import { useServices } from '../../app/services'
import { formatUsdt, type CatalogueBook } from '../../features/catalogue/catalogue'
import { shortDate, timeLeftLabel } from '../../lib/format'
import { coverColor } from '../../lib/cover'

type CoverBook = Pick<CatalogueBook, 'title' | 'author'> & Partial<Pick<CatalogueBook, 'cover_path' | 'cover_alt'>>


/** A book cover rendered as an object: cloth, spine shading and a soft shadow. Uses the uploaded cover when present. */
export function BookCover({ book, className = '' }: { book: CoverBook; className?: string }) {
  const { supabase } = useServices()
  const [failed, setFailed] = useState(false)
  const url = book.cover_path && supabase?.storage.from('covers').getPublicUrl(book.cover_path).data.publicUrl
  return <div className={`cover ${className}`} style={{ background: coverColor(book.title) }}>
    {url && !failed
      ? <img src={url} alt={book.cover_alt || book.title} loading="lazy" onError={() => setFailed(true)} />
      : <><span className="cover-kicker">Shelf edition</span><span className="cover-title">{book.title}</span><span className="cover-rule" /><span className="cover-author">{book.author}</span></>}
  </div>
}

export function BookCard({ book }: { book: CatalogueBook }) {
  const from = book.borrowing_plans.length ? Math.min(...book.borrowing_plans.map(plan => plan.price_units)) : undefined
  return <Link className="book-card" to={`/books/${book.id}`}>
    <BookCover book={book} />
    <div><h3>{book.title}</h3><p>{book.author}</p></div>
    <div className="book-card-foot"><span>{from === undefined ? 'Not available' : <>From <strong>{formatUsdt(from)} USDT</strong></>}</span><ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" /></div>
  </Link>
}

export function BookGrid({ books }: { books: CatalogueBook[] }) {
  return <div className="book-grid">{books.map(book => <BookCard key={book.id} book={book} />)}</div>
}

export function BookShelf({ books, label }: { books: CatalogueBook[]; label: string }) {
  return <div className="book-shelf" role="list" aria-label={label}>{books.map(book => <div role="listitem" key={book.id}><BookCard book={book} /></div>)}</div>
}

export function CatalogueState({ status, retry }: { status: string; retry: () => void }) {
  if (status === 'ready') return null
  return <div className="state-card catalogue-state" role={status === 'error' ? 'alert' : 'status'}>
    <h2>{status === 'loading' ? 'Opening the library…' : status === 'error' ? 'The catalogue could not load' : 'The catalogue is unavailable'}</h2>
    <p>{status === 'loading' ? 'Finding the books on the shelf.' : status === 'error' ? 'Check your connection and try again.' : 'Connect a Supabase project to browse its published books.'}</p>
    {status === 'error' && <button className="button-secondary" onClick={retry}>Try again</button>}
  </div>
}

export function PageHeading({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <header className="page-intro"><h1 className="page-title">{title}</h1>{description && <p>{description}</p>}{children}</header>
}

export function EmptyPanel({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <section className="empty-panel"><BookOpen size={28} strokeWidth={1.5} aria-hidden="true" /><h2>{title}</h2><p>{text}</p>
    {action ?? <Link to="/explore" className="button-primary">Explore books <ArrowUpRight size={16} aria-hidden="true" /></Link>}</section>
}

/** Shelf's signature: the library date-due stamp, shown only on loans. */
export function DueStamp({ expires, now }: { expires: string; now: number }) {
  const ended = Date.parse(expires) <= now
  return <span className={`due-stamp ${ended ? 'due-stamp-ended' : ''}`} aria-label={`${ended ? 'Was due' : 'Due'} ${shortDate(expires)}`}>
    <span>{ended ? 'Was due' : 'Due'}</span><strong>{shortDate(expires)}</strong>
  </span>
}

export function LoanStatus({ status, expires, now }: { status: string; expires: string | null; now: number }) {
  if (status === 'active' && expires && Date.parse(expires) > now) return <span className="status status-active">Active · {timeLeftLabel(expires, now)}</span>
  if (status === 'pending_payment') return <span className="status status-pending">Awaiting payment</span>
  const label = status === 'active' ? 'Expired' : status === 'returned' ? 'Returned' : status === 'expired' ? 'Expired' : 'Cancelled'
  return <span className="status status-ended">{label}</span>
}
