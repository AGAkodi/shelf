import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import { EmptyPanel, PageHeading } from "../components/catalogue/Catalogue";
import { useLibrary } from "../features/borrowing/api";
import { LoadingState } from "../components/states/LoadingState";
import { formatUsdt } from "../features/catalogue/catalogue";
import { dateTime } from "../lib/format";

const labels: Record<string, [string, string]> = {
  confirmed: ["Paid", "status-active"],
  pending: ["Awaiting payment", "status-pending"],
  submitted: ["Verifying", "status-pending"],
  verifying: ["Verifying", "status-pending"],
  failed: ["Failed", "status-failed"],
  cancelled: ["Cancelled", "status-ended"],
};

export function Component() {
  const library = useLibrary();
  const payments = library.data?.payments ?? [];
  const paid = payments.filter((p) => p.status === "confirmed").reduce((sum, p) => sum + BigInt(p.gross_amount), 0n);
  return (
    <div className="enter">
      <PageHeading title="Transactions" description="Every borrowing payment, checked on Polygon before access starts" />
      {library.loading ? (
        <LoadingState label="Loading transactions…" />
      ) : !library.session ? (
        <EmptyPanel title="Your payment history is private" text="Sign in to see your borrowing payments." action={<Link to="/account" className="button-primary">Sign in</Link>} />
      ) : library.error ? (
        <div role="alert" className="notice">
          {library.error}
          <button className="button-secondary" onClick={library.reload}>Try again</button>
        </div>
      ) : !payments.length ? (
        <EmptyPanel title="No payments yet" text="Payments appear here after you start a borrowing checkout." />
      ) : (
        <>
          <p className="meta mb-4 tabular">{payments.length} {payments.length === 1 ? "payment" : "payments"} · {formatUsdt(paid)} USDT paid</p>
          <div className="card card-tight overflow-x-auto">
            <table className="tx-table">
              <thead><tr><th>Book</th><th>Date</th><th>Status</th><th className="num">Amount</th><th>Transaction</th></tr></thead>
              <tbody>
                {payments.map((p) => {
                  const [label, tone] = labels[p.status] ?? [p.status, "status-ended"];
                  return (
                    <tr key={p.id}>
                      <td><strong className="font-medium">{p.title}</strong>{p.environment === "development" && <div className="meta">Development simulation · no money moved</div>}</td>
                      <td className="meta tabular">{dateTime(p.created_at)}</td>
                      <td><span className={`status ${tone}`}>{label}</span></td>
                      <td className="num">{formatUsdt(p.gross_amount)} USDT</td>
                      <td>{p.tx_hash
                        ? <a className="tx-hash inline-flex items-center gap-1 hover:text-ink" href={`https://polygonscan.com/tx/${p.tx_hash}`} target="_blank" rel="noreferrer noopener">{p.tx_hash.slice(0, 10)}…{p.tx_hash.slice(-6)} <ExternalLink size={12} aria-hidden="true" /></a>
                        : <span className="meta">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
