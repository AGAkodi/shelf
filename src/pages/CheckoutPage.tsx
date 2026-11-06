import { PaymentCheckout } from '../features/payments/PaymentCheckout'
import { useSession } from '../features/borrowing/session'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { BookCover, CatalogueState, PageHeading } from '../components/catalogue/Catalogue'
import { formatUsdt, useCatalogue } from '../features/catalogue/catalogue'
export function Component() {
  const { bookId } = useParams()
  const {session}=useSession()
  const [params] = useSearchParams()
  const catalogue = useCatalogue()
  const book = catalogue.books.find(item => item.id === bookId)
  const plan = book?.borrowing_plans.find(item => item.id === params.get('plan'))
  return <><PageHeading eyebrow="YOUR NEXT CHAPTER" title="Payment / Checkout" description="Review your reading time and rental fee."/><CatalogueState {...catalogue}/>{catalogue.status === 'ready' && (!book || !plan ? <section className="state-card"><h2 className="font-display text-2xl">Choose an available borrowing plan</h2><p className="description">This book or plan is unavailable. Return to the catalogue to choose an enabled option.</p><Link className="button-secondary" to={book ? `/books/${book.id}` : '/explore'}>Back to books</Link></section> : <div className="checkout-layout"><section className="state-card"><div className="checkout-book"><BookCover book={book}/><div><h2>{book.title}</h2><p>{book.author}</p></div></div><dl className="summary-lines"><div><dt>Borrowing period</dt><dd>{plan.duration_days} days</dd></div><div><dt>Currency</dt><dd>USDT · Polygon</dd></div><div><dt>Rental fee</dt><dd>{formatUsdt(plan.price_units)} USDT</dd></div></dl><p className="fine-print">The rental fee is not collateral. There is no refund on expiry or early return.</p><Link className="back-link mt-6" to={`/books/${book.id}`}><ArrowLeft size={15}/> Change borrowing period</Link></section><section className="state-card"><LockKeyhole className="text-accent"/><PaymentCheckout key={`${session?.user.id}:${book.id}:${plan.id}`} bookId={book.id} planId={plan.id}/></section></div>)}</>
}
