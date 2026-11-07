import { useEffect, useState } from "react";
import { EmptyPanel, PageHeading } from "../components/catalogue/Catalogue";
import { useSession } from "../features/borrowing/session";
import { useServices } from "../app/services";
import {
  checked,
  type Client,
  type Dashboard,
  loadAdmin,
} from "../features/admin/data";
import { CatalogueEditor } from "../features/admin/CatalogueEditor";
import { formatUsdt } from "../features/catalogue/catalogue";
import { LoadingState } from "../components/states/LoadingState";
import { AdminOverview } from "../features/admin/AdminOverview";

const sections = [
  "Catalogue",
  "Loans",
  "Payments & revenue",
  "Applications",
] as const;
function Workspace({ db, user }: { db: Client; user: string }) {
  const [data, setData] = useState<Dashboard | null>(),
    [section, setSection] = useState<typeof sections[number]>("Catalogue");
  const [revision, refresh] = useState(0),
    [busy, setBusy] = useState(false),
    [message, notify] = useState(""),
    [error, fail] = useState("");
  useEffect(() => {
    let live = true;
    loadAdmin(db, user).then((value) => {
      if (live) setData(value);
    }).catch(() => {
      if (live) {
        setData(undefined);
        fail("Could not load dashboard records.");
      }
    });
    return () => {
      live = false;
    };
  }, [db, user, revision]);
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    fail("");
    notify("");
    try {
      await work();
      setData(await loadAdmin(db, user));
      notify("Saved.");
    } catch (e) {
      fail(
        e instanceof Error
          ? e.message
          : "The request failed. Refresh to check the saved state.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (data === null) {
    return (
      <section className="state-card">
        <h2>Administrator access required</h2>
        <p>Your signed-in account has reader access.</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="state-card">
        {error
          ? (
            <div role="alert" className="notice">
              {error}
              <button
                className="button-secondary"
                onClick={() => {
                  fail("");
                  refresh((r) => r + 1);
                }}
              >
                Try again
              </button>
            </div>
          )
          : <LoadingState label="Checking administrator access…" />}
      </section>
    );
  }
  const confirmed = data.payments.filter((p) => p.status === "confirmed");
  const title = (id: string) =>
    data.books.find((b) => b.id === id)?.title ?? id;
  const decide = (id: string, status: "approved" | "rejected") =>
    run(async () => {
      checked(
        await db.from("contributor_applications").update({ status }).eq("id", id)
          .eq("status", "pending").select("id").single(),
      );
    });
  return (
    <div className="admin-dashboard">
      <AdminOverview data={data} decide={decide} />
      <nav aria-label="Admin sections">
        {sections.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={section === s}
            onClick={() => {
              setSection(s);
              notify("");
              fail("");
            }}
          >
            {s}
          </button>
        ))}
      </nav>
      <p role="status">{busy ? "Saving…" : message}</p>
      {error && <p role="alert" className="notice">{error}</p>}
      <fieldset disabled={busy} className="card">
        {section === "Catalogue" && (
          <CatalogueEditor data={data} db={db} user={user} run={run} />
        )}
        {section === "Loans" && (
          <>
            <h2>Loans</h2>
            {!data.loans.length && <p>No loans yet.</p>}
            {data.loans.map((l) => (
              <article key={l.id}>
                <h3>{title(l.book_id)}</h3>
                <p>
                  {l.status === "active" && l.expires_at &&
                      Date.parse(l.expires_at) <= data.loadedAt
                    ? "expired"
                    : l.status} · {l.duration_days} days
                </p>
                <p className="mono">Reader {l.user_id}</p>
                <p className="mono">Loan {l.id}</p>
                {l.expires_at && (
                  <p>Access ends {new Date(l.expires_at).toLocaleString()}</p>
                )}
              </article>
            ))}
          </>
        )}
        {section === "Payments & revenue" && (
          <>
            <h2>Confirmed revenue</h2>
            <dl className="summary-lines">
              {([["Gross rental fees", "gross_amount"], [
                "Contributor share",
                "contributor_share",
              ], ["Platform share", "platform_share"]] as const).map((
                [label, key],
              ) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {formatUsdt(
                      confirmed.reduce(
                        (total, p) => total + BigInt(p[key]),
                        0n,
                      ),
                    )} USDT
                  </dd>
                </div>
              ))}
            </dl>
            <h2>Payments</h2>
            {!data.payments.length && <p>No payments yet.</p>}
            {data.payments.map((p) => (
              <article key={p.id}>
                <h3>
                  {title(
                    data.loans.find((l) => l.id === p.loan_id)?.book_id ?? "",
                  )}
                </h3>
                <p>{p.status} · {new Date(p.created_at).toLocaleString()}</p>
                <p>
                  Gross {formatUsdt(p.gross_amount)} USDT · Contributor{" "}
                  {formatUsdt(p.contributor_share)} · Platform{" "}
                  {formatUsdt(p.platform_share)}
                </p>
                <p className="mono">Payment {p.id}</p>
                {p.tx_hash && <p className="mono">Transaction {p.tx_hash}</p>}
              </article>
            ))}
          </>
        )}
        {section === "Applications" && (
          <>
            <h2>Contributor applications</h2>
            {!data.applications.length && <p>No applications yet.</p>}
            {data.applications.map((a) => (
              <article key={a.id}>
                <h3>{a.name}</h3>
                <p>{a.contributor_type} · {a.status}</p>
                <p>{a.contact}</p>
                <p>{a.description}</p>
                <p>Rights information · {a.rights_information}</p>
                {a.status === "pending" &&
                  (["approved", "rejected"] as const).map((status) => (
                    <button
                      key={status}
                      className="button-secondary"
                      onClick={() => decide(a.id, status)}
                    >
                      {status === "approved"
                        ? "Approve application"
                        : "Reject application"}
                    </button>
                  ))}
              </article>
            ))}
          </>
        )}
      </fieldset>
    </div>
  );
}
export function Component() {
  const { supabase } = useServices(), { session, ready } = useSession();
  return (
    <>
      <PageHeading title="Admin dashboard" description="Catalogue, loans, payments and contributor applications" />
      {!ready
        ? <LoadingState label="Checking session…" />
        : session && supabase
        ? (
          <Workspace
            key={session.user.id}
            db={supabase}
            user={session.user.id}
          />
        )
        : (
          <EmptyPanel
            title="Administrator sign-in required"
            text="Sign in by email with your administrator account."
          />
        )}
    </>
  );
}
