import { Link } from 'react-router'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { PageHeading } from '../components/catalogue/Catalogue'
export function Component() {
  return <div className="reader-shell"><div className="reader-toolbar"><Link to="/library" className="back-link"><ArrowLeft size={16}/> My Library</Link><span className="eyebrow">YOUR READING SPACE</span></div><PageHeading eyebrow="TAKE A MOMENT. TURN A PAGE." title="Reading Interface" description="A quiet space for your next chapter."/><section className="reader-locked"><LockKeyhole size={28}/><h2>Protected reading is not available yet</h2><p>Full chapters require an authenticated reader and a verified, active loan. No protected content is loaded on this screen.</p><Link to="/explore" className="button-secondary">Explore public previews</Link></section></div>
}
