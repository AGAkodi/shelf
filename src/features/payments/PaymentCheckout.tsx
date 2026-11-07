import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Link } from "react-router";
import { checkoutKey } from "./checkoutKey";
import { useServices } from "../../app/services";
import { useSession } from "../borrowing/session";
import { walletClient } from "../../lib/nimiq/wallet";
import { PreflightError, type PaymentQuote } from "../../lib/nimiq/payments";
type State = {
  payment: PaymentQuote & {
    id: string;
    status: string;
    tx_hash: string | null;
  };
  loan: { id: string; status: string; book_id: string; borrowing_plan_id: string; expires_at: string | null };
  claim_token?: string;
  prompted: boolean;
  prompted_at?: string | null;
  candidate_hash: string | null;
  message?: string;
};
export function PaymentCheckout(
  { bookId, planId }: { bookId: string; planId: string },
) {
  const { supabase } = useServices(), { session } = useSession();
  const wallet = useSyncExternalStore(
    walletClient.subscribe,
    walletClient.getSnapshot,
  );
  const [state, setState] = useState<State>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [hash, setHash] = useState("");
  const pending = useRef(false);
  const storageKey = `payment:${session?.user.id}:${bookId}:${planId}`;
  const api = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      if (!supabase || !session) throw new Error("Sign in first");
      const r = await supabase.functions.invoke("payments", {
        body: { action, ...extra },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (r.error || r.data?.error) {
        if (action === "checkout" && r.error?.context instanceof Response) {
          const detail = await r.error.context.clone().json().catch(() => null);
          if (detail?.error === "OPEN_CHECKOUT") throw new Error("Open My Library and select Resume checkout for your existing borrowing period.");
          if (detail?.error === "POLYGON_UNAVAILABLE") throw new Error("Shelf could not reach Polygon to price this checkout. Try Prepare checkout again later.");
          if (r.error.context.status === 401) throw new Error("Sign in by email again to prepare checkout.");
        }
        if (action === "release" && r.error?.context instanceof Response) {
          const detail = await r.error.context.clone().json().catch(() => null);
          if (detail?.error === "RELEASE_TOO_EARLY") {
            const at = Date.parse(detail.prompted_at) + 15 * 60 * 1000;
            throw new Error(`You can start over from ${new Date(at).toLocaleTimeString()}, 15 minutes after the wallet request. Check Nimiq Pay history first.`);
          }
          if (detail?.error === "TRANSFER_FOUND") throw new Error("Polygon shows a transfer or pending transaction from your wallet. Enter its transaction hash from Nimiq Pay history and select Check payment. Do not send again.");
          if (detail?.error === "POLYGON_UNAVAILABLE") throw new Error("Shelf could not confirm on Polygon that nothing was sent, so this checkout stays reserved. Try again later. If this request is more than a day old, contact Shelf support.");
        }
        throw new Error(
          "Checkout unavailable or verification pending. Check your wallet and connection. Do not send again after an uncertain outcome.",
        );
      }
      return r.data as State;
    },
    [supabase, session],
  );
  useEffect(() => {
    let live = true;
    const id = localStorage.getItem(storageKey);
    if (id) {
      void api("status", { paymentId: id }).then((s) => {
        if (!live) return;
        if (s.loan.book_id !== bookId || s.loan.borrowing_plan_id !== planId ||
          ["expired", "returned"].includes(s.loan.status) ||
          (s.loan.expires_at && Date.parse(s.loan.expires_at) <= Date.now())) {
          localStorage.removeItem(storageKey);
          localStorage.removeItem(storageKey + ":key");
          return;
        }
        setState(s);
      }).catch(() => {
        if (live) {
          setError(
            "Could not restore checkout. Retry to recover the existing payment.",
          );
        }
      });
    }
    return () => {
      live = false;
    };
  }, [api, storageKey, bookId, planId]);
  const check = useCallback(async (id: string, candidate?: string) => {
    const saved = candidate || localStorage.getItem(`payment-hash:${id}`);
    const result = await api("verify", {
      paymentId: id,
      ...((candidate || saved) ? { hash: candidate || saved } : {}),
    });
    setState(result);
    return result;
  }, [api]);
  useEffect(() => {
    if (!state?.candidate_hash || state.payment.status !== "pending") return;
    let checks = 0, live = true, inFlight = false;
    const timer = window.setInterval(() => {
      if (++checks > 12) {
        window.clearInterval(timer);
        return;
      }
      if (inFlight || pending.current) return;
      inFlight = true;
      void api("verify", { paymentId: state.payment.id }).then((s) => {
        if (live) setState(s);
      }).catch(() => {
        if (live) {
          setError(
            "Verification is still unresolved. You can check again; do not send another payment.",
          );
        }
      }).finally(() => {
        inFlight = false;
      });
    }, 10000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [api, state?.candidate_hash, state?.payment.id, state?.payment.status]);
  async function run(action: "checkout" | "pay" | "verify" | "cancel" | "release") {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (action === "checkout") {
        const key = localStorage.getItem(`${storageKey}:key`) ??
          checkoutKey();
        localStorage.setItem(`${storageKey}:key`, key);
        const s = await api("checkout", { bookId, planId, key });
        localStorage.setItem(storageKey, s.payment.id);
        setState(s);
      } else if (state) {
        if (action === "pay") {
          // Read-only balance and gas checks run before Shelf reserves the wallet prompt.
          try {
            await walletClient.preflight(state.payment);
          } catch (e) {
            setError(
              e instanceof PreflightError
                ? e.message
                : "Shelf could not check your wallet balance. Try again in a moment.",
            );
            return;
          }
          const claimed = await api("claim", { paymentId: state.payment.id });
          setState(claimed);
          if (claimed.payment.status !== "pending") return;
          let tx: string;
          try {
            tx = await walletClient.pay(claimed.payment);
          } catch (e) {
            if (
              typeof e === "object" && e !== null && "code" in e &&
              e.code === 4001
            ) {
              setState(await api("rejected", { paymentId: state.payment.id, claimToken: claimed.claim_token }));
              setError("Payment rejected in wallet. No loan was activated.");
              return;
            }
            throw e;
          }
          setHash(tx);
          try {
            localStorage.setItem(`payment-hash:${state.payment.id}`, tx);
          } catch { /* The server can still verify the submitted hash. */ }
          await check(state.payment.id, tx);
        } else if (action === "verify") {
          await check(state.payment.id, hash.trim() || undefined);
        } else if (action === "release") {
          setState(await api("release", { paymentId: state.payment.id }));
        } else {
          await api("cancel", { paymentId: state.payment.id });
          localStorage.removeItem(storageKey);
          localStorage.removeItem(`${storageKey}:key`);
          setState(undefined);
        }
      }
    } catch (cause) {
      setError(
        action === "checkout" || action === "release"
          ? cause instanceof Error ? cause.message : "Shelf could not prepare checkout. Open My Library to check your existing loans."
          : "Check your wallet history and use Check payment to verify any submitted transfer before sending again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (!session) {
    return (
      <>
        <h2 className="font-display text-2xl">Sign in to borrow</h2>
        <p className="description">
          Sign in by email, then connect and verify your Polygon wallet above.
        </p>
        <button className="button-primary" disabled>Payment unavailable</button>
      </>
    );
  }
  if (state && ["failed", "cancelled"].includes(state.payment.status)) {
    return (
      <>
        <h2 className="font-display text-2xl">
          Payment {state.payment.status}
        </h2>
        <p className="description">
          No reading access was activated. A failed blockchain transaction may
          still cost network gas.
        </p>
        <button
          className="button-secondary"
          onClick={() => {
            localStorage.removeItem(storageKey);
            localStorage.removeItem(`${storageKey}:key`);
            setState(undefined);
          }}
        >
          Start a new checkout
        </button>
      </>
    );
  }
  if (state?.payment.status === "confirmed") {
    return (
      <>
        <h2 className="font-display text-2xl">Payment verified</h2>
        <p role="status" className="description">
          Your payment is confirmed. View your loan and reading access in My
          Library.
        </p>
        <Link className="button-primary" to="/library">Open My Library</Link>
        <Link className="back-link" to="/transactions">View transaction</Link>
      </>
    );
  }
  return (
    <>
      <h2 className="font-display text-2xl">Pay with Nimiq Pay</h2>
      <p className="description">
        USDT on Polygon. Your wallet also needs POL for network gas. Reading
        access starts only after independent payment verification.
      </p>
      {state && (
        <>
          <p className="break-all text-sm text-muted">
            Recipient: {state.payment.recipient}
          </p>
          <p className="mt-3">
            Fee: {(BigInt(state.payment.gross_amount) / 1000000n)
              .toString()}.{(BigInt(state.payment.gross_amount) % 1000000n)
              .toString().padStart(6, "0")} USDT
          </p>
        </>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        {!state
          ? (
            <button
              disabled={busy || !wallet.snapshot ||
                wallet.snapshot.chainId !== "0x89"}
              className="button-primary"
              onClick={() => void run("checkout")}
            >
              Prepare checkout
            </button>
          )
          : !state.prompted
          ? (
            <>
              <button
                disabled={busy || wallet.busy ||
                  wallet.snapshot?.account.toLowerCase() !==
                    state.payment.expected_sender.toLowerCase() ||
                  wallet.snapshot?.chainId !== "0x89"}
                className="button-primary"
                onClick={() => void run("pay")}
              >
                Pay USDT
              </button>
              <button
                disabled={busy}
                className="button-secondary"
                onClick={() => void run("cancel")}
              >
                Cancel checkout
              </button>
            </>
          )
          : (
            <>
              <p role="status" className="description">
                {state.message ??
                  "Shelf reserved a wallet request for this checkout. Check Nimiq Pay history. If you see the transfer, enter its transaction hash below."}
              </p>
              <label className="w-full text-sm">
                Transaction hash (from wallet history)<input
                  className="mt-2 w-full rounded-lg border border-white/20 bg-transparent p-3"
                  value={hash}
                  onChange={(e) => setHash(e.target.value)}
                  placeholder="0x…"
                />
              </label>
              <button
                disabled={busy}
                className="button-secondary"
                onClick={() => void run("verify")}
              >
                Check payment
              </button>
              {!state.candidate_hash && (
                <div className="w-full">
                  <p className="description">
                    Did Nimiq Pay show an error, with no transfer in its
                    history? 15 minutes after the request you can start over.
                    Shelf first checks Polygon to confirm nothing was sent.
                  </p>
                  <button
                    disabled={busy}
                    className="button-secondary mt-3"
                    onClick={() => void run("release")}
                  >
                    Nothing was sent – start over
                  </button>
                </div>
              )}
            </>
          )}
      </div>
      {error && <p role="alert" className="notice mt-4">{error}</p>}
      {error && !state && <Link className="back-link" to="/library">Open My Library</Link>}
    </>
  );
}
