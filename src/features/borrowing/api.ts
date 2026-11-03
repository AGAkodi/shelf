import { useCallback, useEffect, useState } from "react";
import { useServices } from "../../app/services";
import { useSession } from "./session";
import type { Database } from "../../lib/supabase/database.types";
export type Loan = Database["public"]["Tables"]["loans"]["Row"] & {
  title: string;
  author: string;
};
export type Payment = Database["public"]["Tables"]["payments"]["Row"] & {
  title: string;
};
export type LibraryState = {
  loans: Loan[];
  payments: Payment[];
  server_time: string;
};
export type Checkout = { loan: Loan; payment: Payment };
export type Chapter = {
  title: string;
  paragraphs: string[];
  chapter: number;
  chapters: number[];
  expires_at: string;
  server_time: string;
};
export function useBorrowingApi() {
  const { supabase } = useServices();
  return useCallback(
    async <T>(body: Record<string, unknown>): Promise<T> => {
      if (!supabase) throw new Error("Library connection unavailable");
      const { data, error } = await supabase.functions.invoke("shelf-api", {
        body,
      });
      if (error || data?.error)
        throw new Error(
          "Request could not be completed. Check your connection and access, then try again.",
        );
      return data as T;
    },
    [supabase],
  );
}
export function useLibrary() {
  const api = useBorrowingApi(),
    { session, ready } = useSession();
  const [revision, setRevision] = useState(0);
  const key = `${session?.user.id ?? ""}:${revision}`;
  const [result, setResult] = useState<{
    key: string;
    data?: LibraryState;
    error?: string;
  }>();
  useEffect(() => {
    if (!session) return;
    let live = true;
    void api<LibraryState>({ action: "library" })
      .then((data) => {
        if (live) setResult({ key, data });
      })
      .catch(() => {
        if (live)
          setResult({
            key,
            error: "Your library could not load. Please try again.",
          });
      });
    const refresh = () => setRevision((value) => value + 1);
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [api, session, key]);
  const data = result?.key === key ? result.data : undefined;
  useEffect(() => {
    if (!data) return;
    const times = data.loans
      .filter((l) => l.status === "active" && l.expires_at)
      .map((l) => Date.parse(l.expires_at!) - Date.parse(data.server_time));
    if (!times.length) return;
    const timer = window.setTimeout(
      () => setRevision((value) => value + 1),
      Math.min(2147483647, Math.max(1, Math.min(...times) + 50)),
    );
    return () => window.clearTimeout(timer);
  }, [data]);
  return {
    data,
    error: result?.key === key ? result.error : undefined,
    loading:
      !ready || (!!session && !data && !(result?.key === key && result.error)),
    session,
    reload: () => setRevision((value) => value + 1),
  };
}
