import { type FormEvent, useCallback, useEffect, useState } from "react";
import { BookOpen, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router";
import { PageHeading } from "../components/catalogue/Catalogue";
import { type AppServices, useServices } from "../app/services";
import { useSession } from "../features/borrowing/session";
import type { Database } from "../lib/supabase/database.types";

type Application = Pick<
  Database["public"]["Tables"]["contributor_applications"]["Row"],
  "id" | "status" | "created_at"
>;
function ApplicationForm(
  { db, user }: { db: NonNullable<AppServices["supabase"]>; user: string },
) {
  const [latest, setLatest] = useState<Application | null>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [revision, refresh] = useState(0);
  const read = useCallback(
    () =>
      db.from("contributor_applications").select("id,status,created_at")
        .eq("user_id", user).order("created_at", { ascending: false }).order(
          "id",
        ).limit(1).maybeSingle(),
    [db, user],
  );
  useEffect(() => {
    let live = true;
    void Promise.resolve(read()).then(({ data, error }) => {
      if (live) {
        setLatest(error ? undefined : data);
        setError(error ? "Could not load your application. Please retry." : "");
      }
    }).catch(() => {
      if (live) {
        setLatest(undefined);
        setError("Could not load your application. Please retry.");
      }
    });
    return () => {
      live = false;
    };
  }, [read, revision]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy || latest === undefined || latest?.status === "pending" ||
      latest?.status === "approved"
    ) return;
    const f = new FormData(event.currentTarget);
    const text = (key: string) => String(f.get(key) ?? "").trim();
    const type = text("type"),
      name = text("name"),
      contact = text("contact"),
      description = text("description"),
      rights = text("rights");
    if (
      !name || contact.length < 3 || !description || !rights ||
      (type !== "author" && type !== "publisher")
    ) {
      setError(
        "Enter your name, contact details, contributor type, description and rights information.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await db.from("contributor_applications").insert({
        user_id: user,
        name,
        contact,
        contributor_type: type,
        description,
        rights_information: rights,
      }).select("id,status,created_at").single();
      if (result.error) {
        const existing = await read();
        if (
          existing.error || !existing.data || existing.data.id === latest?.id
        ) throw new Error();
        setLatest(existing.data);
      } else setLatest(result.data);
    } catch {
      setError(
        "Could not confirm submission. Check your status before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card admin-editor">
      {error && <p role="alert" className="notice">{error}</p>}
      {latest === undefined && !error && (
        <p role="status">Checking your application…</p>
      )}
      {latest && (
        <div role="status">
          <h2>Application {latest.status}</h2>
          <p className="description">
            {latest.status === "pending"
              ? "Your application is waiting for administrator review."
              : latest.status === "approved"
              ? "You are registered as a Shelf contributor."
              : "You may submit a new application with updated information."}
          </p>
          <p className="fine-print">
            Submitted {new Date(latest.created_at).toLocaleDateString()}
          </p>
        </div>
      )}
      {(latest || error) && (
        <button
          className="button-secondary"
          disabled={busy}
          onClick={() => refresh((v) => v + 1)}
        >
          Check application status
        </button>
      )}
      {(latest === null || latest?.status === "rejected") && (
        <form onSubmit={submit}>
          <h2 className="text-[17px] font-medium">Apply to contribute</h2>
          <label>
            Name<input
              name="name"
              autoComplete="name"
              required
              maxLength={120}
            />
          </label>
          <label>
            Contact information<input
              name="contact"
              required
              minLength={3}
              maxLength={320}
            />
          </label>
          <label>
            Contributor type<select name="type" required defaultValue="">
              <option value="" disabled>Select a type</option>
              <option value="author">Author</option>
              <option value="publisher">Publisher</option>
            </select>
          </label>
          <label>
            Description of your work<textarea
              name="description"
              required
              maxLength={5000}
            />
          </label>
          <label>
            Ownership or distribution rights<textarea
              name="rights"
              required
              maxLength={10000}
            />
          </label>
          <button className="button-primary" disabled={busy}>
            {busy ? "Submitting…" : "Submit application"}
          </button>
        </form>
      )}
    </section>
  );
}
export function Component() {
  const { supabase } = useServices(), { ready, session } = useSession();
  return (
    <>
      <PageHeading
        title="Contribute your books"
        description="Authors and publishers can offer original work for time-limited borrowing on Shelf"
      />
      <div className="contribute-layout">
        <section className="card">
          <div className="contributor-point">
            <BookOpen />
            <div>
              <h2>Your work, a new audience</h2>
              <p>
                Authors and publishers can apply to offer their books for
                time-limited borrowing.
              </p>
            </div>
          </div>
          <div className="contributor-point">
            <ShieldCheck />
            <div>
              <h2>Rights come first</h2>
              <p>
                Describe how you own the work or have permission to distribute
                it. An administrator reviews each application.
              </p>
            </div>
          </div>
          <div className="contributor-point">
            <Users />
            <div>
              <h2>Rental revenue</h2>
              <p>
                Shelf records 80% of contributor-owned rental fees for the
                contributor and 20% for the platform. Payouts require manual
                processing.
              </p>
            </div>
          </div>
        </section>
        {!ready
          ? <p role="status">Checking sign-in…</p>
          : !supabase
          ? <p className="notice">Library connection unavailable.</p>
          : session
          ? (
            <ApplicationForm
              key={session.user.id}
              user={session.user.id}
              db={supabase}
            />
          )
          : (
            <section className="card">
              <h2 className="text-[17px] font-medium">Sign in to apply</h2>
              <p className="description">
                Sign in with an email code to submit an application and check its status.
              </p>
              <Link className="button-primary" to="/account">Sign in</Link>
            </section>
          )}
      </div>
    </>
  );
}
