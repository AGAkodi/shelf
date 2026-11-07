import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, Check } from 'lucide-react'
import { PaymentCheckout } from '../features/payments/PaymentCheckout'
import { useSession } from '../features/borrowing/session'
import { EmailSignIn } from '../features/auth/EmailSignIn'
import { WalletConnection } from '../features/wallet/WalletConnection'
import { BookCover, CatalogueState, PageHeading } from '../components/catalogue/Catalogue'
import { formatUsdt, useCatalogue } from '../features/catalogue/catalogue'

function Stepper({ confirmed }: { confirmed: boolean }) {
  const steps = [['Borrow', 'done'], ['Payment', confirmed ? 'done' : 'current'], ['Access', confirmed ? 'done' : 'todo']] as const
  return <ol className="stepper" aria-label="Checkout progress">{steps.map(([label, state], i) =>
    <li key={label} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
      <span>{state === 'done' ? <Check size={13} strokeWidth={2} aria-hidden="true" /> : i + 1}</span>{label}
    </li>)}</ol>
}

export function Component() {
  const { bookId } = useParams()
  const { session } = useSession()
  const [params] = useSearchParams()
  const catalogue = useCatalogue()
  const [status, setStatus] = useState<string>()
  const book = catalogue.books.find(item => item.id === bookId)
  const plan = book?.borrowing_plans.find(item => item.id === params.get('plan'))
  return <div className="enter">
    <Link className="back-link mb-2" to={book ? `/books/${book.id}` : '/explore'}><ArrowLeft size={16} aria-hidden="true" /> Back</Link>
    <PageHeading title="Complete your borrowing" />
    <CatalogueState {...catalogue} />
    {catalogue.status === 'ready' && (!book || !plan
      ? <section className="state-card"><h2 className="text-[17px] font-medium">Choose an available borrowing plan</h2><p className="description">This book or plan is unavailable. Return to the catalogue to choose an enabled option.</p><Link className="button-secondary" to={book ? `/books/${book.id}` : '/explore'}>Back to books</Link></section>
      : <>
        <Stepper confirmed={status === 'confirmed'} />
        <div className="checkout-layout">
          <section className="card">
            <div className="checkout-book"><BookCover book={book} /><div><h2>{book.title}</h2><p>{plan.duration_days}-day access</p></div></div>
            <dl className="summary-lines">
              <div><dt>Borrowing fee</dt><dd>{formatUsdt(plan.price_units)} USDT</dd></div>
              <div><dt>Access duration</dt><dd>{plan.duration_days} days</dd></div>
              <div><dt>Network</dt><dd>USDT · Polygon</dd></div>
            </dl>
            <p className="fine-print">The fee is a rental, not a deposit. It is not refunded on expiry or early return</p>
            <Link className="back-link mt-2" to={`/books/${book.id}`}>Change borrowing period</Link>
          </section>
          <section className="card" aria-label="Pay with Nimiq Pay">
            <div className="pay-steps">
              <div className="pay-step" data-done={!!session}>
                <div className="pay-step-head"><span>{session ? <Check size={12} strokeWidth={2} aria-hidden="true" /> : 1}</span>Sign in</div>
                {session ? <p className="meta break-all">{session.user.email}</p> : <EmailSignIn />}
              </div>
              {session && status !== 'confirmed' && <div className="pay-step">
                <div className="pay-step-head"><span>2</span>Connect and verify your wallet</div>
                <WalletConnection compact />
              </div>}
              <div className="pay-step">
                <div className="pay-step-head"><span>{session && status !== 'confirmed' ? 3 : 2}</span>Pay USDT</div>
                <PaymentCheckout key={`${session?.user.id}:${book.id}:${plan.id}`} bookId={book.id} planId={plan.id} onStatus={setStatus} />
              </div>
            </div>
          </section>
        </div>
      </>)}
  </div>
}
