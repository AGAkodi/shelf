import { useState } from "react";
import { Link } from "react-router";
import { EmptyPanel, PageHeading } from "../components/catalogue/Catalogue";
import { useBorrowingApi, useLibrary } from "../features/borrowing/api";
export function Component() {
  const [tab, setTab] = useState("Currently reading"),
    [confirm, setConfirm] = useState<string>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const library = useLibrary(),
    api = useBorrowingApi();
  async function returnBook(id: string) {
    setBusy(true);
    setError("");
    try {
      await api({ action: "return", loanId: id });
      try {
        localStorage.setItem("shelf:last-returned-loan", id);
      } catch {
        // Storage can be disabled. Server checks and reader refresh still apply.
      }
      setConfirm(undefined);
      library.reload();
    } catch {
      setError("Return failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const loans =
    library.data?.loans.filter((l) =>
      tab === "Currently reading"
        ? l.status === "active" || l.status === "pending_payment"
        : ["returned", "expired", "cancelled"].includes(l.status),
    ) ?? [];
  return (
    <>
      <PageHeading
        eyebrow="YOUR PERSONAL BOOKSHELF"
        title="My Library"
        description="Your borrowed books and reading history."
      />
      <div className="tab-row">
        {["Currently reading", "Reading history"].map((value) => (
          <button
            key={value}
            aria-pressed={tab === value}
            className={tab === value ? "selected" : ""}
            onClick={() => setTab(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {library.loading ? (
        <p role="status" className="notice">
          Loading your library…
        </p>
      ) : !library.session ? (
        <EmptyPanel
          title="Sign in to your library"
          text="Your borrowed books are private. Secure wallet sign-in arrives in a later release."
        />
      ) : library.error ? (
        <div role="alert" className="notice">
          {library.error}
          <button onClick={library.reload} className="button-secondary">
            Try again
          </button>
        </div>
      ) : !loans.length ? (
        <EmptyPanel
          title={
            tab === "Currently reading"
              ? "Your next chapter is waiting"
              : "No reading history yet"
          }
          text="Explore the catalogue to find your next book."
        />
      ) : (
        <div className="loan-list">
          {loans.map((loan) => (
            <article className="state-card" key={loan.id}>
              <span className="eyebrow">{loan.status.replace("_", " ")}</span>
              <h2 className="font-display text-2xl mt-3">{loan.title}</h2>
              <p className="text-muted text-sm mt-2">
                {loan.author} · {loan.duration_days} days
              </p>
              {loan.expires_at && (
                <p className="fine-print">
                  Access ends {new Date(loan.expires_at).toLocaleString()}
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-5">
                {loan.status === "active" ? (
                  <>
                    <Link className="button-primary" to={`/read/${loan.id}`}>
                      Read book
                    </Link>
                    <button
                      className="button-secondary"
                      onClick={() => setConfirm(loan.id)}
                    >
                      Return early
                    </button>
                  </>
                ) : loan.status === "pending_payment" ? (
                  <Link
                    className="button-secondary"
                    to={`/checkout/${loan.book_id}?plan=${loan.borrowing_plan_id}`}
                  >
                    Resume checkout
                  </Link>
                ) : (
                  <Link
                    className="button-secondary"
                    to={`/books/${loan.book_id}`}
                  >
                    Borrow again
                  </Link>
                )}
              </div>
              {confirm === loan.id && (
                <div className="notice">
                  <p>
                    Return this book now? Reading access ends immediately. The
                    rental fee is not refunded.
                  </p>
                  <button
                    disabled={busy}
                    className="button-primary mt-3"
                    onClick={() => void returnBook(loan.id)}
                  >
                    Confirm return
                  </button>
                  <button
                    disabled={busy}
                    className="button-secondary"
                    onClick={() => setConfirm(undefined)}
                  >
                    Keep reading
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
