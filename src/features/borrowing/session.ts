import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";
export const SessionContext = createContext<{
  session: Session | null;
  ready: boolean;
}>({ session: null, ready: false });
export const useSession = () => useContext(SessionContext);
export const developmentBorrowing =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BORROWING === "enabled";
