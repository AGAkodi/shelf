import { BookOpen, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { useState } from 'react'
import { useServices } from '../../app/services'
import { formatUsdt, type CatalogueBook } from '../../features/catalogue/catalogue'
export function BookCover({ book, large = false }: { book: CatalogueBook; large?: boolean }) {
  const { supabase } = useServices()
  const [failed, setFailed] = useState(false)
  const url = book.cover_path && supabase?.storage.from('covers').getPublicUrl(book.cover_path).data.publicUrl
  const hue = [...book.title].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 360
  return <div className={`book-cover ${large ? 'book-cover-large' : ''}`} style={{ background: `linear-gradient(145deg,hsl(${hue} 28% 42%),hsl(${hue} 28% 17%))` }}>
    {url && !failed ? <img src={url} alt={book.cover_alt || book.title} onError={() => setFailed(true)} /> : <><span className="cover-kicker">SHELF · DIGITAL EDITION</span><strong>{book.title}</strong><BookOpen className="cover-symbol" aria-hidden="true"/><span className="cover-author">{book.author}</span></>}
  </div>
}
export function BookGrid({ books }: { books: CatalogueBook[] }) {
  return <div className="book-grid">{books.map(book => <Link className="book-card" to={`/books/${book.id}`} key={book.id}>
    <div className="book-cover-wrap"><BookCover book={book}/><span className="book-category">{book.category}</span></div>
    <h3>{book.title}</h3><p>{book.author}</p><div className="book-card-foot"><span>{book.borrowing_plans.length ? <>From <strong>{formatUsdt(Math.min(...book.borrowing_plans.map(plan => plan.price_units)))} USDT</strong></> : 'No borrowing plans'}</span><ArrowUpRight size={15} aria-hidden="true"/></div>
  </Link>)}</div>
}
export function CatalogueState({ status, retry }: { status: string; retry: () => void }) {
  if (status === 'ready') return null
  return <div className="state-card catalogue-state" role={status === 'error' ? 'alert' : 'status'}>
    <BookOpen size={26} className="text-accent" aria-hidden="true"/>
    <h2>{status === 'loading' ? 'Opening the library…' : status === 'error' ? 'The catalogue could not load' : 'The catalogue is unavailable'}</h2>
    <p>{status === 'loading' ? 'Finding your next read.' : status === 'error' ? 'Check your connection and try again.' : 'Connect a Supabase project to browse its published books.'}</p>
    {status === 'error' && <button className="button-secondary" onClick={retry}>Try again</button>}
  </div>
}
export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="page-intro"><p className="eyebrow">{eyebrow}</p><h1 className="page-title">{title}</h1><p>{description}</p></header>
}
export function EmptyPanel({ title, text }: { title: string; text: string }) {
  return <section className="empty-panel"><BookOpen size={32} aria-hidden="true"/><h2>{title}</h2><p>{text}</p><Link to="/explore" className="button-primary">Explore books <ArrowUpRight size={16} aria-hidden="true"/></Link></section>
}
