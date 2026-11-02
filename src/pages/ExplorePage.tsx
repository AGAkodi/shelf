import { Search } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { BookGrid, CatalogueState, PageHeading } from '../components/catalogue/Catalogue'
import { filterBooks, useCatalogue } from '../features/catalogue/catalogue'
export function Component() {
  const catalogue = useCatalogue()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key,value); else next.delete(key); setParams(next, { replace: true }) }
  const categories = [...new Set(catalogue.books.map(book => book.category))].sort()
  const books = filterBooks(catalogue.books,query,category)
  return <><PageHeading eyebrow="FIND YOUR NEXT CHAPTER" title="Explore the library" description="A little curiosity can take you somewhere new. Discover stories and ideas at your own pace."/>
    <label className="search-box"><Search size={19} aria-hidden="true"/><span className="sr-only">Search books</span><input value={query} onChange={event => update('q',event.target.value)} placeholder="Search by title, author, or category…" type="search"/></label>
    <div className="category-row" aria-label="Book categories">{['',...categories].map(value => <button key={value} className={`category ${category === value ? 'selected' : ''}`} aria-pressed={category === value} onClick={() => update('category',value)}>{value || 'All books'}</button>)}</div>
    <CatalogueState {...catalogue}/>{catalogue.status === 'ready' && <><p className="result-count" role="status">{books.length} {books.length === 1 ? 'book' : 'books'} found</p>{books.length ? <BookGrid books={books}/> : <div className="empty-panel"><h2>No books found</h2><p>Try another title or choose a different category.</p><button className="button-secondary" onClick={() => setParams({})}>Clear filters</button></div>}</>}
  </>
}
