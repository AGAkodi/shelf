import { useCallback, useEffect, useState } from "react";
import { useServices } from "../../app/services";
import { useSession } from "../borrowing/session";

const empty: ReadonlySet<string> = new Set();

/** The signed-in reader's favorite book IDs. Owner-only by database policy. */
export function useFavorites() {
  const { supabase } = useServices(), { session } = useSession();
  const user = session?.user.id;
  const [state, setState] = useState<{ user: string; ids: ReadonlySet<string>; error?: string }>();
  const [pending, setPending] = useState<string>();
  useEffect(() => {
    if (!supabase || !user) return;
    let live = true;
    void Promise.resolve(supabase.from("favorites").select("book_id").eq("user_id", user))
      .then(({ data, error }) => {
        if (!live) return;
        setState({ user, ids: new Set((data ?? []).map((r) => r.book_id)), error: error ? "Favorites could not load." : undefined });
      })
      .catch(() => {
        if (live) setState({ user, ids: new Set(), error: "Favorites could not load." });
      });
    return () => {
      live = false;
    };
  }, [supabase, user]);
  const current = state && user && state.user === user ? state : undefined;
  const ids = current?.ids ?? empty;
  const toggle = useCallback(async (bookId: string) => {
    if (!supabase || !user || pending) return;
    const has = ids.has(bookId);
    setPending(bookId);
    const result = has
      ? await supabase.from("favorites").delete().eq("user_id", user).eq("book_id", bookId)
      : await supabase.from("favorites").insert({ user_id: user, book_id: bookId });
    setPending(undefined);
    if (result.error && result.error.code !== "23505") {
      setState({ user, ids, error: has ? "Could not remove the favorite. Try again." : "Could not save the favorite. Try again." });
      return;
    }
    const next = new Set(ids);
    if (has) next.delete(bookId);
    else next.add(bookId);
    setState({ user, ids: next });
  }, [supabase, user, ids, pending]);
  return {
    ids,
    ready: !user || !!current,
    error: current?.error,
    pending,
    toggle,
    signedIn: !!user,
  };
}
