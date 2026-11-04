import { useState } from "react";
import { useServices } from "../../app/services";
import { useSession } from "../borrowing/session";
export function EmailSignIn() {
  const { supabase } = useServices(),
    { session, ready } = useSession();
  const [email, setEmail] = useState(""),
    [sentTo, setSentTo] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  if (!supabase) return null;
  async function send() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const target = email.trim().toLowerCase();
    try {
      const { error } = await supabase!.auth.signInWithOtp({
        email: target,
        options: { shouldCreateUser: true },
      });
      if (error) {
        setMessage(
          "A code could not be sent. Check your email and try again shortly.",
        );
        return;
      }
      setSentTo(target);
      setCode("");
      setMessage(
        "If this address can receive a sign-in code, it has been sent. Check your inbox.",
      );
    } catch {
      setMessage("Unable to reach sign-in. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase!.auth.verifyOtp({
        email: sentTo,
        token: code.trim(),
        type: "email",
      });
      setMessage(
        error
          ? "Code invalid or expired. Retry or request a new code."
          : "Signed in to Shelf.",
      );
      if (!error) {
        setCode("");
        setSentTo("");
      }
    } catch {
      setMessage("Unable to verify the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    try {
      const { error } = await supabase!.auth.signOut({ scope: "local" });
      setMessage(error ? "Sign-out failed. Please try again." : "");
      if (!error) {
        setCode("");
        setSentTo("");
      }
    } catch {
      setMessage("Sign-out failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="config-notice" aria-label="Shelf account">
      <strong>{session ? "Your Shelf account" : "Sign in to Shelf"}</strong>
      {!ready ? (
        <p role="status">Checking your session…</p>
      ) : session ? (
        <div>
          <p className="break-all">{session.user.email}</p>
          <button
            className="button-secondary mt-3"
            disabled={busy}
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      ) : sentTo ? (
        <form
          className="dev-account-form"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <p>Enter the code sent to {sentTo}.</p>
          <label>
            Sign-in code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button className="button-primary" disabled={busy}>
            Verify email code
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={busy}
            onClick={() => {
              setSentTo("");
              setCode("");
              setMessage("");
            }}
          >
            Use another email or request a new code
          </button>
        </form>
      ) : (
        <form
          className="dev-account-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <p>
            Use an email code to access your library. Wallet verification is a
            separate step.
          </p>
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="button-primary" disabled={busy}>
            Send sign-in code
          </button>
        </form>
      )}
      {message && (
        <p role="status" className="mt-3">
          {message}
        </p>
      )}
    </section>
  );
}
