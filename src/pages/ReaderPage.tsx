import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { PageHeading } from "../components/catalogue/Catalogue";
import {
  useBorrowingApi,
  useLibrary,
  type Chapter,
} from "../features/borrowing/api";
export function Component() {
  const { loanId } = useParams(),
    library = useLibrary(),
    api = useBorrowingApi();
  const loan = library.data?.loans.find((item) => item.id === loanId);
  const [chapter, setChapter] = useState(1),
    [revision, setRevision] = useState(0),
    [size, setSize] = useState(18);
  const key = `${library.session?.user.id}:${loanId}:${chapter}:${revision}`;
  const [result, setResult] = useState<{
    key: string;
    data?: Chapter;
    error?: boolean;
  }>();
  useEffect(() => {
    if (!loan || loan.status !== "active") return;
    let live = true,
      timer: number | undefined;
    const started = performance.now();
    void api<Chapter>({
      action: "read",
      loanId: loan.id,
      bookId: loan.book_id,
      chapter,
    })
      .then((data) => {
        if (!live) return;
        const ttl =
          Date.parse(data.expires_at) -
          Date.parse(data.server_time) -
          (performance.now() - started);
        if (ttl <= 0) {
          setResult({ key, error: true });
          return;
        }
        setResult({ key, data });
        timer = window.setTimeout(
          () => {
            setResult({ key, error: true });
          },
          Math.min(ttl, 2147483647),
        );
      })
      .catch(() => {
        if (live) setResult({ key, error: true });
      });
    const refresh = () => setRevision((value) => value + 1);
    const visibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const poll = window.setInterval(refresh, 30000);
    const returned = (event: StorageEvent) => {
      if (event.key === "shelf:last-returned-loan" && event.newValue === loan.id) {
        live = false;
        setResult({ key, error: true });
      }
    };
    window.addEventListener("storage", returned);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      live = false;
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener("storage", returned);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [api, loan, chapter, key]);
  const data =
    result?.key === key && loan?.status === "active" ? result.data : undefined;
  const denied = result?.key === key && result.error;
  return (
    <div className="reader-shell">
      <div className="reader-toolbar">
        <Link to="/library" className="back-link">
          <ArrowLeft size={16} /> My Library
        </Link>
        <span className="eyebrow">YOUR READING SPACE</span>
      </div>
      <PageHeading
        eyebrow="TAKE A MOMENT. TURN A PAGE."
        title="Reading Interface"
        description={loan?.title ?? "A quiet space for your next chapter."}
      />
      {!library.session ? (
        <section className="reader-locked">
          <LockKeyhole />
          <h2>Sign in to read</h2>
          <p>Protected chapters require your account and an active loan.</p>
        </section>
      ) : library.loading ? (
        <p role="status">Checking your loan…</p>
      ) : library.error ? (
        <p role="alert">
          {library.error}
          <button onClick={library.reload}>Try again</button>
        </p>
      ) : !loan || loan.status !== "active" || denied ? (
        <section className="reader-locked" role="alert">
          <LockKeyhole />
          <h2>Reading access unavailable</h2>
          <p>
            Your loan may have expired or been returned, or this chapter could
            not load. No protected content is displayed.
          </p>
          <button
            className="button-secondary"
            onClick={() => {
              library.reload();
              setRevision((v) => v + 1);
            }}
          >
            Check access again
          </button>
        </section>
      ) : !data ? (
        <p role="status">Loading authorized chapter…</p>
      ) : (
        <>
          <div className="reader-controls">
            <label>
              Chapter{" "}
              <select
                value={chapter}
                onChange={(event) => setChapter(Number(event.target.value))}
              >
                {data.chapters.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Text size{" "}
              <input
                aria-label="Text size"
                type="range"
                min="16"
                max="28"
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
              />
            </label>
          </div>
          <article className="reading-text" style={{ fontSize: size }}>
            <p className="eyebrow">CHAPTER {data.chapter}</p>
            <h2>{data.title}</h2>
            {data.paragraphs.map((p, index) => (
              <p key={index}>{p}</p>
            ))}
          </article>
          <p className="fine-print">
            Reading access ends {new Date(data.expires_at).toLocaleString()}.
            Downloaded text cannot be recalled; this is access control, not DRM.
          </p>
        </>
      )}
    </div>
  );
}
