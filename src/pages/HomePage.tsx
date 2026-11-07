import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { BookCover, BookShelf, CatalogueState, DueStamp, LoanStatus } from '../components/catalogue/Catalogue'
import { ReadingLamp } from '../components/art/ReadingLamp'
import { useCatalogue } from '../features/catalogue/catalogue'
import { useLibrary } from '../features/borrowing/api'

function ContinueReading() {
  const library = useLibrary()
  const catalogue = useCatalogue()
  if (!library.data) return null
  const now = Date.parse(library.data.server_time)
  const active = library.data.loans.filter(l => l.status === 'active' && l.expires_at && Date.parse(l.expires_at) > now)
  if (!active.length) return null
  return <section className="mb-12" aria-labelledby="continue-heading">
    <div className="section-head"><h2 id="continue-heading">Continue reading</h2><Link to="/library">My Library <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" /></Link></div>
    <div className="loan-list">
      {active.slice(0, 2).map(loan => {
        const book = catalogue.books.find(b => b.id === loan.book_id) ?? { title: loan.title, author: loan.author }
        return <article className="loan-row" key={loan.id}>
          <BookCover book={book} />
          <div><h3>{loan.title}</h3><p>{loan.author}</p><div className="loan-row-meta"><LoanStatus status={loan.status} expires={loan.expires_at} now={now} /></div></div>
          <div className="loan-row-actions"><DueStamp expires={loan.expires_at!} now={now} /><Link className="button-secondary" to={`/read/${loan.id}`}>Read</Link></div>
        </article>
      })}
    </div>
  </section>
}

export function Component() {
  const catalogue = useCatalogue()
  return <div className="enter">
    <section className="hero" aria-labelledby="hero-heading">
      <div>
        <h1 id="hero-heading">Discover, borrow, <span>read</span></h1>
        <p>Original books to rent for 3, 7 or 14 days. Pay in USDT with Nimiq Pay and read them in Shelf until the loan is due.</p>
        <div className="hero-actions">
          <Link to="/explore" className="button-primary">Browse the library <ArrowRight size={16} aria-hidden="true" /></Link>
          <a href="#how-it-works" className="button-secondary">How borrowing works</a>
        </div>
      </div>
      <div className="hero-art"><ReadingLamp titles={catalogue.books.map(b => b.title)} /></div>
    </section>

    <ContinueReading />

    <section className="mb-12" aria-labelledby="shelf-heading">
      <div className="section-head"><h2 id="shelf-heading">On the shelf</h2><Link to="/explore">See all <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" /></Link></div>
      <CatalogueState {...catalogue} />
      {catalogue.status === 'ready' && (catalogue.books.length
        ? <BookShelf books={catalogue.books.slice(0, 8)} label="Published books" />
        : <p className="state-card text-soft">The library is waiting for its first published book.</p>)}
    </section>

    <section id="how-it-works" aria-labelledby="how-heading">
      <div className="section-head"><h2 id="how-heading">How borrowing works</h2></div>
      <div className="steps-strip">
        <div className="step-card"><span>1</span><h3>Choose a book and a period</h3><p>Each book offers 3, 7 or 14 days at its own price.</p></div>
        <div className="step-card"><span>2</span><h3>Pay with Nimiq Pay</h3><p>One USDT transfer on Polygon. Shelf checks it on the chain before access starts.</p></div>
        <div className="step-card"><span>3</span><h3>Read until it is due</h3><p>Read chapter by chapter in Shelf. Return early any time; access ends on the due date.</p></div>
      </div>
    </section>
  </div>
}
