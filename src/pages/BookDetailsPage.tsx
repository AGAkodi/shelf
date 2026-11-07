import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, BookOpenText, CalendarDays, Coins, Eye, Heart, Share2 } from 'lucide-react'
import { BookCover, BookGrid, CatalogueState, PageHeading } from '../components/catalogue/Catalogue'
import { formatUsdt, useCatalogue, type CatalogueBook } from '../features/catalogue/catalogue'
import { useFavorites } from '../features/library/useFavorites'

function FavoriteButton({ bookId }: { bookId: string }) {
  const favorites = useFavorites()
  const navigate = useNavigate()
  const saved = favorites.ids.has(bookId)
  return <button className="icon-button" aria-pressed={saved} disabled={favorites.pending === bookId || !favorites.ready}
    aria-label={!favorites.signedIn ? 'Sign in to save favorites' : saved ? 'Remove from favorites' : 'Save to favorites'}
    title={favorites.error ?? undefined}
    onClick={() => (favorites.signedIn ? void favorites.toggle(bookId) : navigate('/account'))}>
    <Heart size={18} strokeWidth={1.5} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
  </button>
}

function ShareButton({ book }: { book: CatalogueBook }) {
  const [copied, setCopied] = useState(false)
  async function share() {
    const url = `${window.location.origin}/books/${book.id}`
    try {
      if (navigator.share) await navigator.share({ title: book.title, text: `${book.title} by ${book.author} on Shelf`, url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }
    } catch { /* The share sheet was dismissed. */ }
  }
  return <button className="icon-button" aria-label={copied ? 'Link copied' : 'Share this book'} title={copied ? 'Link copied' : undefined} onClick={() => void share()}><Share2 size={18} strokeWidth={1.5} aria-hidden="true" /></button>
}

const tabs = ['Overview', 'Preview', 'Similar books'] as const

function Details({ book, similar }: { book: CatalogueBook; similar: CatalogueBook[] }) {
  const [selected, setSelected] = useState(book.borrowing_plans[0]?.id ?? '')
  const [tab, setTab] = useState<typeof tabs[number]>('Overview')
  const plan = book.borrowing_plans.find(item => item.id === selected)
  const durations = book.borrowing_plans.map(p => p.duration_days)
  const from = book.borrowing_plans.length ? Math.min(...book.borrowing_plans.map(p => p.price_units)) : undefined
  return <div className="enter">
    <div className="details-top">
      <Link to="/explore" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> Back</Link>
      <div className="details-actions"><FavoriteButton bookId={book.id} /><ShareButton book={book} /></div>
    </div>
    <div className="details-layout">
      <div className="details-cover"><BookCover book={book} /></div>
      <section>
        <p className="meta">{book.category}</p>
        <h1 className="mt-2">{book.title}</h1>
        <p className="details-author">{book.author}</p>
        <p className="description">{book.description}</p>
        <div className="info-chips">
          <div className="info-chip"><CalendarDays size={18} strokeWidth={1.5} aria-hidden="true" /><div><strong>{durations.length ? `${durations.join(' · ')} days` : 'None'}</strong><span>Borrow period</span></div></div>
          <div className="info-chip"><Coins size={18} strokeWidth={1.5} aria-hidden="true" /><div><strong>{from === undefined ? '–' : `${formatUsdt(from)} USDT`}</strong><span>{durations.length > 1 ? 'From' : 'Borrow fee'}</span></div></div>
          <div className="info-chip"><BookOpenText size={18} strokeWidth={1.5} aria-hidden="true" /><div><strong>Text chapters</strong><span>Read in Shelf</span></div></div>
        </div>
        {book.borrowing_plans.length
          ? <fieldset className="plan-selector"><legend>Choose your borrowing period</legend>{book.borrowing_plans.map(option => <label key={option.id} className={option.id === selected ? 'plan selected' : 'plan'}><input type="radio" name="plan" value={option.id} checked={option.id === selected} onChange={() => setSelected(option.id)} /><span>{option.duration_days} days</span><strong>{formatUsdt(option.price_units)} USDT</strong></label>)}</fieldset>
          : <p className="notice">Borrowing plans are not available for this book.</p>}
        <div className="details-cta">
          {plan && <Link to={`/checkout/${book.id}?plan=${plan.id}`} className="button-primary">Borrow for {plan.duration_days} days</Link>}
          <button className="button-secondary" onClick={() => { setTab('Preview'); document.getElementById('book-tabs')?.scrollIntoView({ block: 'start' }) }}><Eye size={16} strokeWidth={1.5} aria-hidden="true" /> Preview</button>
        </div>
        <p className="fine-print">Pay in USDT on Polygon through Nimiq Pay. Access starts once the payment is verified. The fee is not refunded on expiry or early return</p>
      </section>
    </div>
    <div className="tab-row" id="book-tabs" role="tablist">{tabs.map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
    {tab === 'Overview' && <div className="max-w-3xl"><dl className="summary-lines mt-0">
      <div><dt>Author</dt><dd>{book.author}</dd></div>
      <div><dt>Category</dt><dd>{book.category}</dd></div>
      <div><dt>Ownership</dt><dd>{book.ownership === 'contributor' ? 'Contributor book' : 'Shelf book'}</dd></div>
      {book.borrowing_plans.map(p => <div key={p.id}><dt>{p.duration_days}-day loan</dt><dd>{formatUsdt(p.price_units)} USDT</dd></div>)}
    </dl></div>}
    {tab === 'Preview' && <section aria-label="Public preview"><div className="preview-box"><h3>{book.title}</h3><p>{book.public_preview || 'A preview has not been published for this book.'}</p></div></section>}
    {tab === 'Similar books' && (similar.length ? <BookGrid books={similar} /> : <p className="meta">No other books in {book.category} yet.</p>)}
  </div>
}
export function Component() {
  const { bookId } = useParams()
  const catalogue = useCatalogue()
  const book = catalogue.books.find(item => item.id === bookId)
  if (catalogue.status !== 'ready') return <><PageHeading title="Book details" /><CatalogueState {...catalogue} /></>
  if (!book) return <><PageHeading title="Book not found" description="This book is unavailable or has not been published." /><Link to="/explore" className="button-primary">Back to explore</Link></>
  return <Details key={book.id} book={book} similar={catalogue.books.filter(b => b.category === book.category && b.id !== book.id)} />
}
