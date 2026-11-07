import { EmptyPanel, PageHeading } from "../components/catalogue/Catalogue";
import { useLibrary } from "../features/borrowing/api";
import { LoadingState } from "../components/states/LoadingState";
import { formatUsdt } from "../features/catalogue/catalogue";
export function Component() {
  const library = useLibrary();
  return (
    <>
      <PageHeading
        eyebrow="YOUR READING JOURNEY"
        title="Transactions"
        description="Your borrowing payments, together in one place."
      />
      {library.loading ? (
        <LoadingState label="Loading transactions…" />
      ) : !library.session ? (
        <EmptyPanel
          title="Your payment history is private"
          text="Sign in to see your borrowing payments."
        />
      ) : library.error ? (
        <div role="alert" className="notice">
          {library.error}
          <button className="button-secondary" onClick={library.reload}>
            Try again
          </button>
        </div>
      ) : !library.data?.payments.length ? (
        <EmptyPanel
          title="No payments yet"
          text="Payments will appear here after you create a borrowing checkout."
        />
      ) : (
        <div className="loan-list">
          {library.data.payments.map((p) => (
            <article className="state-card" key={p.id}>
              <span className="eyebrow">
                {p.environment === "development"
                  ? "Development simulation · No money moved"
                  : "USDT · Polygon"}
              </span>
              <h2 className="font-display text-2xl mt-3">{p.title}</h2>
              <dl className="summary-lines">
                <div>
                  <dt>Rental fee</dt>
                  <dd>{formatUsdt(p.gross_amount)} USDT</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{p.status}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{new Date(p.created_at).toLocaleString()}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
