import { ArrowUpRight, BookOpen } from 'lucide-react'
import { Link } from 'react-router'
import { BookGrid, CatalogueState } from '../components/catalogue/Catalogue'
import { useCatalogue } from '../features/catalogue/catalogue'
export function Component() {
  const catalogue = useCatalogue()
  return <><section className="home-foundation"><div><p className="eyebrow">YOUR DIGITAL LIBRARY</p><h1 className="page-title home-title">Your next great read<br/><em>starts here.</em></h1><p className="hero-copy">A home for stories, ideas, and new perspectives. Find a book that stays with you long after the last page.</p><Link to="/explore" className="button-primary mt-7">Explore the library <ArrowUpRight size={16}/></Link></div><div aria-hidden="true" className="hero-art"><div className="hero-glow"/><div className="hero-book hero-book-back"><span>A WORLD OF</span><strong>IDEAS</strong><BookOpen size={28}/></div><div className="hero-book hero-book-front"><span>TURN THE PAGE.</span><strong>Your<br/>next<br/>chapter.</strong><span>SHELF</span></div></div></section>
    <div className="reading-strip"><span><BookOpen size={20}/> Discover something new</span><span>Choose your reading time</span><span>A library that goes with you</span></div>
    <section><div className="section-heading"><div><p className="eyebrow">ON THE SHELF</p><h2>Find your next favourite</h2></div><Link to="/explore">View all <ArrowUpRight size={15}/></Link></div><CatalogueState {...catalogue}/>{catalogue.status === 'ready' && (catalogue.books.length ? <BookGrid books={catalogue.books.slice(0,4)}/> : <p className="state-card text-muted">The library is waiting for its first published book.</p>)}</section>
    <aside className="quote-banner"><span aria-hidden="true">“</span><div><p>Make a little room for a new perspective.</p><small>ONE BOOK. A WORLD OF POSSIBILITIES.</small></div></aside></>
}
