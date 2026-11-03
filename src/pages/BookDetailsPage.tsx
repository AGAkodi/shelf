import { developmentBorrowing } from '../features/borrowing/session'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Clock, ArrowUpRight } from 'lucide-react'
import { BookCover, CatalogueState, PageHeading } from '../components/catalogue/Catalogue'
import { formatUsdt, useCatalogue, type CatalogueBook } from '../features/catalogue/catalogue'
function Details({ book }: { book: CatalogueBook }) {
  const [selected, setSelected] = useState(book.borrowing_plans[0]?.id ?? '')
  const plan = book.borrowing_plans.find(item => item.id === selected)
  return <><Link to="/explore" className="back-link"><ArrowLeft size={15}/> Back to explore</Link><div className="details-layout"><div className="details-cover"><BookCover book={book} large/></div><section><p className="eyebrow">{book.category}</p><h1 className="page-title">{book.title}</h1><p className="text-muted">by {book.author}</p><p className="description">{book.description}</p><fieldset className="plan-selector"><legend>Choose your borrowing period</legend>{book.borrowing_plans.map(option => <label key={option.id} className={option.id === selected ? 'plan selected' : 'plan'}><input type="radio" name="plan" value={option.id} checked={option.id === selected} onChange={() => setSelected(option.id)}/><span>{option.duration_days} days</span><strong>{formatUsdt(option.price_units)} USDT</strong></label>)}</fieldset>{plan ? <Link to={`/checkout/${book.id}?plan=${plan.id}`} className="button-primary w-full">Review borrowing option <ArrowUpRight size={16}/></Link> : <p className="notice">Borrowing plans are not available for this book.</p>}<p className="fine-print"><Clock size={14}/> Rental fee · No refund on expiry or early return</p><p className="notice">{developmentBorrowing ? 'Local development borrowing is enabled. No real payment is made.' : 'Borrowing and payments are not available yet. You can explore the available plans and public preview.'}</p></section></div><section className="preview-section"><div className="section-heading"><h2>A glimpse inside</h2><span className="eyebrow">PUBLIC PREVIEW</span></div><div className="preview-box"><h3>{book.title}</h3><p>{book.public_preview || 'A preview has not been published for this book.'}</p></div></section></>
}
export function Component() {
  const { bookId } = useParams()
  const catalogue = useCatalogue()
  const book = catalogue.books.find(item => item.id === bookId)
  if (catalogue.status !== 'ready') return <><PageHeading eyebrow="THE LIBRARY" title="Book details" description="Take a closer look at your next read."/><CatalogueState {...catalogue}/></>
  if (!book) return <><PageHeading eyebrow="THE LIBRARY" title="Book not found" description="This book is unavailable or has not been published."/><Link to="/explore" className="button-primary">Back to explore</Link></>
  return <Details key={book.id} book={book}/>
}
