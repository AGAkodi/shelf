import { useEffect, useState, type ReactNode } from "react";
import { useServices } from "../../app/services";
import { SessionContext } from "./session";
import type { Session } from "@supabase/supabase-js";
export function SessionProvider({ children }: { children: ReactNode }) {
  const { supabase } = useServices();
  const [state, setState] = useState<{
    session: Session | null;
    ready: boolean;
  }>({ session: null, ready: !supabase });
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (live) setState({ session, ready: true });
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);
  return (
    <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
  );
}
