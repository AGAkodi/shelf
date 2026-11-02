import { ArrowUpRight, BookOpen } from 'lucide-react'
import { Link } from 'react-router'

export function Component() {
  return (
    <section className="home-foundation">
      <div>
        <p className="eyebrow">YOUR DIGITAL LIBRARY</p>
        <h1 className="page-title home-title">Your next great read<br /><em>starts here.</em></h1>
        <p className="max-w-md text-sm leading-7 text-muted">A home for stories, ideas, and new perspectives.</p>
        <Link to="/explore" className="button-primary mt-7">Explore the library <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
      <div aria-hidden="true" className="hero-art"><div className="hero-glow" /><div className="hero-book hero-book-back"><span>A WORLD OF</span><strong>IDEAS</strong><BookOpen size={28} /></div><div className="hero-book hero-book-front"><span>TURN THE PAGE.</span><strong>Your<br />next<br />chapter.</strong><span>SHELF</span></div></div>
      <div className="state-card home-note">
        <p className="eyebrow mb-3">APPLICATION FOUNDATION</p>
        <h2 className="font-display text-2xl">The first chapter is taking shape.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">Navigation and page foundations are ready. The catalogue, borrowing, reader, and wallet features will be added in later phases.</p>
      </div>
    </section>
  )
}
