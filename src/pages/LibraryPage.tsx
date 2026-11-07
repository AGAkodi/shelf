import { useState } from "react";
import { Link } from "react-router";
import { BookCheck, BookOpen, Heart } from "lucide-react";
import { BookCover, BookGrid, DueStamp, EmptyPanel, LoanStatus, PageHeading } from "../components/catalogue/Catalogue";
import { useBorrowingApi, useLibrary } from "../features/borrowing/api";
import { useCatalogue } from "../features/catalogue/catalogue";
import { useFavorites } from "../features/library/useFavorites";
import { LoadingState } from "../components/states/LoadingState";
import { ReadingLamp } from "../components/art/ReadingLamp";
import { dateTime } from "../lib/format";

type Tab = "active" | "history" | "favorites";

export function Component() {
  const [tab, setTab] = useState<Tab>("active"),
    [confirm, setConfirm] = useState<string>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const library = useLibrary(),
    api = useBorrowingApi(),
    catalogue = useCatalogue(),
    favorites = useFavorites();
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
  const now = library.data ? Date.parse(library.data.server_time) : 0;
  const all = library.data?.loans ?? [];
  const isOpen = (l: (typeof all)[number]) =>
    l.status === "pending_payment" || (l.status === "active" && !!l.expires_at && Date.parse(l.expires_at) > now);
  const open = all.filter(isOpen);
  const history = all.filter((l) => !isOpen(l));
  const loans = tab === "active" ? open : history;
  const read = new Set(all.filter((l) => l.started_at).map((l) => l.book_id)).size;
  const favoriteBooks = catalogue.books.filter((b) => favorites.ids.has(b.id));
  const tabs: [Tab, string][] = [["active", `Active loans${library.data ? ` (${open.length})` : ""}`], ["history", "Reading history"], ["favorites", "Favorites"]];
  return (
    <div className="enter">
      <PageHeading title="My Library" description="Your borrowed books and reading history" />
      {library.loading ? (
        <LoadingState label="Loading your library…" />
      ) : !library.session ? (
        <EmptyPanel
          title="Sign in to your library"
          text="Your borrowed books are private. Sign in with an email code to see them."
          action={<Link to="/account" className="button-primary">Sign in</Link>}
        />
      ) : library.error ? (
        <div role="alert" className="notice">
          {library.error}
          <button onClick={library.reload} className="button-secondary">Try again</button>
        </div>
      ) : (
        <div className="library-layout">
          <div className="min-w-0">
            <div className="tab-row tab-row-tight" role="tablist">
              {tabs.map(([value, label]) => (
                <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "selected" : ""} onClick={() => setTab(value)}>{label}</button>
              ))}
            </div>
            {tab === "favorites" ? (
              favoriteBooks.length ? <BookGrid books={favoriteBooks} /> : <EmptyPanel title="No favorites yet" text="Save books you want to read later with the heart on a book's page." />
            ) : !loans.length ? (
              <EmptyPanel title={tab === "active" ? "Nothing on loan right now" : "No reading history yet"} text="Explore the catalogue to find your next book." />
            ) : (
              <div className="loan-list">
                {loans.map((loan) => {
                  const book = catalogue.books.find((b) => b.id === loan.book_id) ?? { title: loan.title, author: loan.author };
                  const active = loan.status === "active" && isOpen(loan);
                  return (
                    <article className="loan-row" key={loan.id}>
                      <BookCover book={book} />
                      <div className="min-w-0">
                        <h3>{loan.title}</h3>
                        <p>{loan.author} · {loan.duration_days}-day loan</p>
                        <div className="loan-row-meta">
                          <LoanStatus status={loan.status} expires={loan.expires_at} now={now} />
                          {loan.returned_at && <span className="meta">Returned {dateTime(loan.returned_at)}</span>}
                        </div>
                      </div>
                      <div className="loan-row-actions">
                        {loan.expires_at && <DueStamp expires={loan.expires_at} now={now} />}
                        {active ? (
                          <>
                            <Link className="button-secondary" to={`/read/${loan.id}`}><BookOpen size={16} strokeWidth={1.5} aria-hidden="true" /> Read</Link>
                            <button className="button-ghost" onClick={() => setConfirm(loan.id)}>Return early</button>
                          </>
                        ) : loan.status === "pending_payment" ? (
                          <Link className="button-secondary" to={`/checkout/${loan.book_id}?plan=${loan.borrowing_plan_id}`}>Resume checkout</Link>
                        ) : (
                          <Link className="button-ghost" to={`/books/${loan.book_id}`}>Borrow again</Link>
                        )}
                      </div>
                      {confirm === loan.id && (
                        <div className="notice loan-confirm">
                          <p className="w-full">Return this book now? Reading access ends immediately. The rental fee is not refunded.</p>
                          <button disabled={busy} className="button-primary" onClick={() => void returnBook(loan.id)}>Confirm return</button>
                          <button disabled={busy} className="button-secondary" onClick={() => setConfirm(undefined)}>Keep reading</button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
            {error && <p role="alert" className="notice">{error}</p>}
          </div>
          <aside className="card stats-panel" aria-label="Library stats">
            <h2>Library stats</h2>
            <div className="stat-line"><BookOpen size={20} strokeWidth={1.5} aria-hidden="true" /><div><strong>{open.filter((l) => l.status === "active").length}</strong><span>Active loans</span></div></div>
            <div className="stat-line"><BookCheck size={20} strokeWidth={1.5} aria-hidden="true" /><div><strong>{read}</strong><span>Books borrowed</span></div></div>
            <div className="stat-line"><Heart size={20} strokeWidth={1.5} aria-hidden="true" /><div><strong>{favorites.ids.size}</strong><span>Favorites</span></div></div>
            <div className="stats-art" aria-hidden="true"><ReadingLamp compact titles={all.map((l) => l.title).filter((t, i, list) => list.indexOf(t) === i)} /></div>
          </aside>
        </div>
      )}
    </div>
  );
}
