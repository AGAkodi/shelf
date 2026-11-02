import { useState } from 'react'
import { EmptyPanel, PageHeading } from '../components/catalogue/Catalogue'
export function Component() {
  const [tab, setTab] = useState('Currently reading')
  return <><PageHeading eyebrow="YOUR PERSONAL BOOKSHELF" title="My Library" description="A home for the books you borrow and the stories you finish."/><div className="tab-row" role="tablist" aria-label="Library views">{['Currently reading','Reading history'].map(value => <button id={`tab-${value.replaceAll(' ','-')}`} key={value} role="tab" aria-selected={tab === value} aria-controls="library-panel" className={tab === value ? 'selected' : ''} onClick={() => setTab(value)}>{value}</button>)}</div><div role="tabpanel" id="library-panel" aria-labelledby={`tab-${tab.replaceAll(' ','-')}`}><EmptyPanel title={tab === 'Currently reading' ? 'Your reading journey starts here' : 'Your stories will live here'} text="Sign-in and borrowing are not available yet. Browse the catalogue and preview a book while your library takes shape."/></div></>
}
