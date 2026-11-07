import { useCallback, useEffect, useState } from "react";
import { useServices } from "../../app/services";
import { useSession } from "../borrowing/session";

const none: Bookmark[] = [];

export type Bookmark = { id: string; chapter: number; paragraph: number; created_at: string };

/**
 * A reader's bookmarks for one book. Only positions are stored (chapter, paragraph index), never
 * text. Adding one requires an active loan, enforced by the database policy.
 */
export function useBookmarks(bookId: string | undefined) {
  const { supabase } = useServices(), { session } = useSession();
  const user = session?.user.id;
  const key = `${user}:${bookId}`;
  const [state, setState] = useState<{ key: string; items: Bookmark[]; error?: string }>();
  useEffect(() => {
    if (!supabase || !user || !bookId) return;
    let live = true;
    void Promise.resolve(
      supabase.from("bookmarks").select("id,chapter,paragraph,created_at").eq("user_id", user).eq("book_id", bookId)
        .order("chapter").order("paragraph"),
    ).then(({ data, error }) => {
      if (live) setState({ key, items: data ?? [], error: error ? "Bookmarks could not load." : undefined });
    }).catch(() => {
      if (live) setState({ key, items: [], error: "Bookmarks could not load." });
    });
    return () => {
      live = false;
    };
  }, [supabase, user, bookId, key]);
  const items = state?.key === key ? state.items : none;
  const sort = (list: Bookmark[]) => [...list].sort((a, b) => a.chapter - b.chapter || a.paragraph - b.paragraph);
  const add = useCallback(async (chapter: number, paragraph: number) => {
    if (!supabase || !user || !bookId) return;
    if (items.some((b) => b.chapter === chapter && b.paragraph === paragraph)) return;
    const { data, error } = await supabase.from("bookmarks")
      .insert({ user_id: user, book_id: bookId, chapter, paragraph })
      .select("id,chapter,paragraph,created_at").single();
    if (error || !data) {
      setState({ key, items, error: error?.code === "23514" ? "This book has reached its bookmark limit." : "Could not save the bookmark. Your loan must be active." });
      return;
    }
    setState({ key, items: sort([...items, data]) });
  }, [supabase, user, bookId, key, items]);
  const remove = useCallback(async (id: string) => {
    if (!supabase || !user) return;
    const { error } = await supabase.from("bookmarks").delete().eq("id", id).eq("user_id", user);
    if (error) {
      setState({ key, items, error: "Could not remove the bookmark. Try again." });
      return;
    }
    setState({ key, items: items.filter((b) => b.id !== id) });
  }, [supabase, user, key, items]);
  return { items, error: state?.key === key ? state.error : undefined, add, remove };
}
