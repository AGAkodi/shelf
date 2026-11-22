import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useServices } from "../../app/services";
import { useSession } from "../borrowing/session";
import type { CatalogueBook } from "../catalogue/catalogue";

export function BookFigures({ book }: { book: CatalogueBook }) {
  const s = book.statistics;
  if (!s) return <p className="meta">Availability and ratings unavailable</p>;
  return (
    <div className="book-figures">
      <span>
        {s.rating_count
          ? `${s.average_rating} / 5 · ${s.rating_count} rating${
            s.rating_count === 1 ? "" : "s"
          }`
          : "No ratings yet"}
      </span>
      <span>{s.available} of {s.copies} copies available</span>
      <span>
        Borrowed {s.times_borrowed} {s.times_borrowed === 1 ? "time" : "times"}
      </span>
    </div>
  );
}
export function RateBook(
  { bookId, onSaved }: { bookId: string; onSaved: () => void },
) {
  const { supabase } = useServices(), { session } = useSession();
  const [state, setState] = useState<
    { key: string; stars: number; eligible: boolean; error?: string }
  >();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const key = `${session?.user.id}:${bookId}`;
  useEffect(() => {
    if (!supabase || !session) return;
    let live = true;
    void Promise.all([
      supabase.from("book_ratings").select("stars").eq("book_id", bookId).eq(
        "user_id",
        session.user.id,
      ).maybeSingle(),
      supabase.from("loans").select(
        "id,payments!inner(status,environment,verified_at)",
      ).eq("book_id", bookId)
        .eq("user_id", session.user.id).in("status", [
          "active",
          "returned",
          "expired",
        ]).not("started_at", "is", null)
        .eq("payments.status", "confirmed").eq(
          "payments.environment",
          "production",
        ).not("payments.verified_at", "is", null).limit(1),
    ]).then(([rating, loans]) => {
      if (live) {
        setState({
          key,
          stars: rating.data?.stars ?? 0,
          eligible: !!loans.data?.length,
          error: rating.error || loans.error
            ? "Could not check rating eligibility. Reload to retry."
            : undefined,
        });
      }
    }).catch(() => {
      if (live) {
        setState({
          key,
          stars: 0,
          eligible: false,
          error: "Could not check rating eligibility. Reload to retry.",
        });
      }
    });
    return () => {
      live = false;
    };
  }, [supabase, session, bookId, key]);
  async function rate(stars: number) {
    if (!supabase || !session || busy) return;
    setBusy(true);
    setMessage("");
    try {
      let result = state?.stars
        ? await supabase.from("book_ratings").update({ stars }).eq(
          "book_id",
          bookId,
        ).eq("user_id", session.user.id).select("stars").single()
        : await supabase.from("book_ratings").insert({
          book_id: bookId,
          user_id: session.user.id,
          stars,
        }).select("stars").single();
      if (result.error?.code === "23505") {
        result = await supabase.from("book_ratings").update({ stars }).eq(
          "book_id",
          bookId,
        ).eq("user_id", session.user.id).select("stars").single();
      }
      if (result.error) throw result.error;
      setState({ key, stars: result.data.stars, eligible: true });
      setMessage("Your rating was saved.");
      onSaved();
    } catch {
      setMessage(
        "Rating could not be saved. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!session) {
    return (
      <p className="fine-print">Sign in and borrow this book to rate it.</p>
    );
  }
  if (state?.key !== key) {
    return <p role="status" className="meta">Checking your rating…</p>;
  }
  if (state.error) return <p role="alert">{state.error}</p>;
  if (!state.eligible) {
    return (
      <p className="fine-print">
        You can rate this book after your borrowing payment is verified.
      </p>
    );
  }
  return (
    <section className="book-rating" aria-label="Your book rating">
      <h3>Your rating</h3>
      <div role="group" aria-label="Choose one to five stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className="icon-button"
            aria-label={`Rate ${n} ${n === 1 ? "star" : "stars"}`}
            aria-pressed={state.stars === n}
            disabled={busy}
            onClick={() => void rate(n)}
          >
            <Star size={24} fill={n <= state.stars ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
      <p role="status" className="fine-print">
        {message || "You can update your rating at any time."}
      </p>
    </section>
  );
}
