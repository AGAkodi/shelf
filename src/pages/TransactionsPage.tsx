import { EmptyPanel, PageHeading } from '../components/catalogue/Catalogue'
export function Component() {
  return <><PageHeading eyebrow="YOUR READING JOURNEY" title="Transactions" description="Your borrowing payments, together in one place."/><section className="state-card"><div className="section-heading"><h2>Payment history</h2><span className="phase-badge">USDT · Polygon</span></div><EmptyPanel title="Your payment history is private" text="Sign-in and payments are not available yet. Verified borrowing payments will appear here once secure checkout is enabled."/></section></>
}
