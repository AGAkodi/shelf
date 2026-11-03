import { useState } from "react";
import { Link } from "react-router";
import { developmentBorrowing, useSession } from "./session";
import { useBorrowingApi, type Checkout } from "./api";
export function DevelopmentCheckout({
  bookId,
  planId,
}: {
  bookId: string;
  planId: string;
}) {
  const { session } = useSession(),
    api = useBorrowingApi();
  const [checkout, setCheckout] = useState<Checkout>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!developmentBorrowing)
    return (
      <>
        <h2 className="font-display text-2xl">Payments are not open yet</h2>
        <p className="description">
          No payment or loan has been created. Secure checkout will be available
          in a later release.
        </p>
        <button className="button-primary w-full" disabled>
          Payment unavailable
        </button>
      </>
    );
  async function run(action: "checkout" | "complete" | "cancel") {
    setBusy(true);
    setError("");
    try {
      if (action === "checkout") {
        const storageKey = `checkout:${session!.user.id}:${bookId}:${planId}`;
        const key = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
        sessionStorage.setItem(storageKey, key);
        const result = await api<Checkout>({ action, bookId, planId, key });
        setCheckout(result);
        if (result.loan.status !== "pending_payment")
          sessionStorage.removeItem(storageKey);
      } else if (action === "complete") {
        setCheckout(
          await api<Checkout>({ action, paymentId: checkout!.payment.id }),
        );
        sessionStorage.removeItem(
          `checkout:${session!.user.id}:${bookId}:${planId}`,
        );
      } else {
        await api({ action, paymentId: checkout!.payment.id });
        setCheckout(undefined);
        sessionStorage.removeItem(
          `checkout:${session!.user.id}:${bookId}:${planId}`,
        );
      }
    } catch {
      setError(
        "Checkout unavailable. Check My Library for an existing loan, or retry the pending request.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h2 className="font-display text-2xl">Development payment adapter</h2>
      <p className="notice">
        Temporary local test. No USDT is transferred and no blockchain
        transaction is fabricated.
      </p>
      {!session ? (
        <p className="description">
          Use the local test account form above to sign in.
        </p>
      ) : checkout?.loan.status === "active" ? (
        <>
          <p className="description" role="status">
            Development payment confirmed. Your loan is active.
          </p>
          <Link to="/library" className="button-primary">
            Open My Library
          </Link>
        </>
      ) : (
        <div className="mt-5 flex flex-wrap gap-3">
          {checkout ? (
            <>
              <p className="w-full text-muted">
                Pending payment · {checkout.loan.duration_days} days
              </p>
              <button
                disabled={busy}
                className="button-primary"
                onClick={() => void run("complete")}
              >
                Simulate development payment
              </button>
              <button
                disabled={busy}
                className="button-secondary"
                onClick={() => void run("cancel")}
              >
                Cancel checkout
              </button>
            </>
          ) : (
            <button
              disabled={busy}
              className="button-primary"
              onClick={() => void run("checkout")}
            >
              Create development checkout
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
    </>
  );
}
