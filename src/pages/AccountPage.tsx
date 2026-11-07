import { ChevronRight, LayoutDashboard, PenLine, ReceiptText } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeading } from '../components/catalogue/Catalogue'
import { EmailSignIn } from '../features/auth/EmailSignIn'
import { WalletConnection } from '../features/wallet/WalletConnection'
import { useIsAdmin } from '../features/account/useRole'
import { useSession } from '../features/borrowing/session'

export function Component() {
  const admin = useIsAdmin()
  const { session } = useSession()
  return <div className="enter">
    <PageHeading title="Account" description="Sign in with an email code, then verify your Nimiq Pay wallet to borrow. Connecting a wallet never signs you in on its own" />
    <div className="account-grid">
      <div className="card"><EmailSignIn /></div>
      <div className="card"><WalletConnection />{!session && <p className="fine-print">Sign in by email first to verify wallet ownership</p>}</div>
    </div>
    <section className="card mt-6" aria-labelledby="more-heading">
      <h2 id="more-heading" className="text-[15px] font-medium">More</h2>
      <div className="link-list">
        <Link to="/transactions"><ReceiptText size={18} strokeWidth={1.5} aria-hidden="true" />Transactions<ChevronRight size={16} aria-hidden="true" /></Link>
        <Link to="/contribute"><PenLine size={18} strokeWidth={1.5} aria-hidden="true" />Contribute a book<ChevronRight size={16} aria-hidden="true" /></Link>
        {admin && <Link to="/admin"><LayoutDashboard size={18} strokeWidth={1.5} aria-hidden="true" />Admin dashboard<ChevronRight size={16} aria-hidden="true" /></Link>}
      </div>
    </section>
  </div>
}
