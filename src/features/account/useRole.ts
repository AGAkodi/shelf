import { useEffect, useState } from "react";
import { useServices } from "../../app/services";
import { useSession } from "../borrowing/session";

/**
 * Whether the signed-in user holds the admin role. Used only to show or hide navigation; every
 * admin action is still authorized by database policies, never by this flag.
 */
export function useIsAdmin() {
  const { supabase } = useServices(), { session } = useSession();
  const user = session?.user.id;
  const [result, setResult] = useState<{ user: string; admin: boolean }>();
  useEffect(() => {
    if (!supabase || !user) return;
    let live = true;
    void Promise.resolve(
      supabase.from("user_roles").select("role").eq("user_id", user).eq("role", "admin").maybeSingle(),
    ).then(({ data }) => {
      if (live) setResult({ user, admin: !!data });
    }).catch(() => {
      if (live) setResult({ user, admin: false });
    });
    return () => {
      live = false;
    };
  }, [supabase, user]);
  return !!user && result?.user === user && result.admin;
}
