import { useState } from "react";
import { useServices } from "../../app/services";
import { developmentBorrowing, useSession } from "./session";
export function DevelopmentAccount() {
  const { supabase } = useServices();
  const { session } = useSession();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  if (!developmentBorrowing || !supabase) return null;
  async function login(create: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const { error } = create
        ? await supabase!.auth.signUp({ email, password })
        : await supabase!.auth.signInWithPassword({ email, password });
      setMessage(
        error
          ? "Unable to sign in. Check your local account details."
          : "Local account ready. No wallet is connected.",
      );
      setPassword("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="config-notice">
      <strong>Development borrowing · Local only · No money moves</strong>
      {session ? (
        <div>
          <p>Signed in as {session.user.email}</p>
          <button
            className="button-secondary mt-3"
            onClick={() => void supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void login(false);
          }}
          className="dev-account-form"
        >
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              minLength={8}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="button-primary" disabled={busy}>
            Local sign in
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={busy || !email || password.length < 8}
            onClick={() => void login(true)}
          >
            Create local test account
          </button>
        </form>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
