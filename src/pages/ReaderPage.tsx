import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, LockKeyhole, Maximize2, Minimize2, Moon, Sun, Trash2, Type, Undo2 } from "lucide-react";
import { exitFullscreen, onFullscreenChange, requestFullscreen } from "@nimiq/mini-app-sdk";
import { PageHeading } from "../components/catalogue/Catalogue";
import { LoadingState } from "../components/states/LoadingState";
import { useBorrowingApi, useLibrary, type Chapter } from "../features/borrowing/api";
import { useBookmarks } from "../features/library/useBookmarks";
import { timeLeftLabel } from "../lib/format";

type Theme = "paper" | "night";
const read = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences are a convenience; storage can be unavailable.
  }
};
const host = () => typeof window !== "undefined" && typeof (window as unknown as { nimiqPay?: { requestFullscreen?: unknown } }).nimiqPay?.requestFullscreen === "function";

function useFullscreen() {
  const [on, setOn] = useState(false);
  const available = host() || (typeof document !== "undefined" && !!document.fullscreenEnabled);
  useEffect(() => {
    if (host()) {
      try {
        return onFullscreenChange(setOn);
      } catch {
        return;
      }
    }
    const change = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  async function toggle() {
    try {
      if (host()) await (on ? exitFullscreen() : requestFullscreen());
      else if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // The host or browser declined; the reader keeps working in the normal view.
    }
  }
  return { on, available, toggle };
}

function ProgressRing({ value }: { value: number }) {
  const r = 52, c = 2 * Math.PI * r;
  return <div className="progress-ring" role="img" aria-label={`${Math.round(value * 100)}% of chapters`}>
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-raised)" strokeWidth="8" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-positive)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} style={{ transition: "stroke-dashoffset 400ms var(--ease)" }} />
    </svg>
    <strong>{Math.round(value * 100)}%</strong>
  </div>;
}

export function Component() {
  const { loanId } = useParams(),
    library = useLibrary(),
    api = useBorrowingApi();
  const loan = library.data?.loans.find((item) => item.id === loanId);
  const [chapter, setChapter] = useState(1),
    [revision, setRevision] = useState(0),
    [size, setSize] = useState(() => Number(read("shelf:reader-size", "19")) || 19),
    [theme, setTheme] = useState<Theme>(() => (read("shelf:reader-theme", "paper") === "night" ? "night" : "paper")),
    [showSize, setShowSize] = useState(false),
    [confirmReturn, setConfirmReturn] = useState(false),
    [returning, setReturning] = useState(false);
  const scrollTo = useRef<number | undefined>(undefined);
  const fullscreen = useFullscreen();
  const bookmarks = useBookmarks(loan?.book_id);
  const textRef = useRef<HTMLElement>(null);
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

  useEffect(() => {
    if (!data || scrollTo.current === undefined) return;
    document.getElementById(`para-${scrollTo.current}`)?.scrollIntoView({ block: "start" });
    scrollTo.current = undefined;
  }, [data]);

  const chapters = data?.chapters ?? [];
  const index = Math.max(0, chapters.indexOf(chapter));
  const progress = chapters.length ? (index + 1) / chapters.length : 0;
  const now = data ? Date.parse(data.server_time) : 0;
  const marked = new Set(bookmarks.items.filter((b) => b.chapter === chapter).map((b) => b.paragraph));
  function go(target: number) {
    setChapter(target);
    window.scrollTo(0, 0);
  }
  function currentParagraph() {
    const nodes = textRef.current?.querySelectorAll<HTMLElement>("[data-para]") ?? [];
    for (const node of nodes) if (node.getBoundingClientRect().bottom > 96) return Number(node.dataset.para);
    return 0;
  }
  async function returnNow() {
    if (!loan) return;
    setReturning(true);
    try {
      await api({ action: "return", loanId: loan.id });
      try {
        localStorage.setItem("shelf:last-returned-loan", loan.id);
      } catch {
        // Storage can be disabled. Server checks and refresh still apply.
      }
      setResult({ key, error: true });
      library.reload();
    } catch {
      setConfirmReturn(false);
    } finally {
      setReturning(false);
    }
  }

  if (!library.session || library.loading || library.error || !loan || loan.status !== "active" || denied) {
    return (
      <div className="enter">
        <Link to="/library" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> My Library</Link>
        <PageHeading title={loan?.title ?? "Reader"} />
        {!library.session ? (
          <section className="reader-locked card">
            <LockKeyhole size={28} strokeWidth={1.5} aria-hidden="true" />
            <h2>Sign in to read</h2>
            <p>Protected chapters require your account and an active loan.</p>
            <Link className="button-primary" to="/account">Sign in</Link>
          </section>
        ) : library.loading ? (
          <LoadingState label="Checking your loan…" />
        ) : library.error ? (
          <div role="alert" className="notice">
            {library.error}
            <button className="button-secondary" onClick={library.reload}>Try again</button>
          </div>
        ) : (
          <section className="reader-locked card" role="alert">
            <LockKeyhole size={28} strokeWidth={1.5} aria-hidden="true" />
            <h2>Reading access unavailable</h2>
            <p>Your loan may have expired or been returned, or this chapter could not load. No protected content is displayed.</p>
            <button className="button-secondary" onClick={() => { library.reload(); setRevision((v) => v + 1); }}>Check access again</button>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="reader enter">
      <aside className="reader-side">
        <section className="card" aria-label="Reading progress">
          <h2 className="text-[15px] font-medium">Reading progress</h2>
          <ProgressRing value={progress} />
          <p className="mt-3 text-center text-sm text-soft tabular">{chapters.length ? `Chapter ${index + 1} of ${chapters.length}` : "Opening chapter…"}</p>
          {data && <p className="mt-1 text-center meta tabular">{timeLeftLabel(data.expires_at, now)}</p>}
          <div className="mt-4">
            {confirmReturn ? (
              <div className="grid gap-2">
                <p className="meta">Return now? Access ends immediately and the fee is not refunded.</p>
                <button className="button-primary" disabled={returning} onClick={() => void returnNow()}>Confirm return</button>
                <button className="button-secondary" disabled={returning} onClick={() => setConfirmReturn(false)}>Keep reading</button>
              </div>
            ) : (
              <button className="button-positive button-secondary" onClick={() => setConfirmReturn(true)}><Undo2 size={16} strokeWidth={1.5} aria-hidden="true" /> Return book</button>
            )}
          </div>
        </section>
        <section className="card" aria-label="Bookmarks">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-medium">Bookmarks</h2>
            <span className="meta tabular">{bookmarks.items.length}</span>
          </div>
          {bookmarks.items.length ? (
            <ul className="bookmark-list mt-2">
              {bookmarks.items.map((b) => (
                <li key={b.id}>
                  <button onClick={() => { if (b.chapter === chapter) document.getElementById(`para-${b.paragraph}`)?.scrollIntoView({ block: "start" }); else { scrollTo.current = b.paragraph; setChapter(b.chapter); } }}>
                    <Bookmark size={14} strokeWidth={1.5} aria-hidden="true" /><span className="tabular">Chapter {b.chapter} · paragraph {b.paragraph + 1}</span>
                  </button>
                  <button aria-label={`Remove bookmark at chapter ${b.chapter}, paragraph ${b.paragraph + 1}`} onClick={() => void bookmarks.remove(b.id)}><Trash2 size={14} strokeWidth={1.5} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          ) : <p className="meta mt-2">Add a bookmark to return to a passage.</p>}
          <button className="button-secondary mt-3 w-full" disabled={!data} onClick={() => void bookmarks.add(chapter, currentParagraph())}><Bookmark size={16} strokeWidth={1.5} aria-hidden="true" /> Add bookmark</button>
          {bookmarks.error && <p role="alert" className="meta mt-2">{bookmarks.error}</p>}
        </section>
      </aside>

      <div className="reader-main" data-theme={theme}>
        <div className="reader-toolbar">
          <Link to="/library" className="back-link" aria-label="Back to My Library"><ArrowLeft size={16} aria-hidden="true" /><span className="max-[560px]:hidden">Back</span></Link>
          <h1>{loan.title}</h1>
          <button className="icon-button" aria-label="Text size" aria-expanded={showSize} onClick={() => setShowSize((v) => !v)}><Type size={18} strokeWidth={1.5} aria-hidden="true" /></button>
          <button className="icon-button" aria-label={theme === "paper" ? "Night page" : "Paper page"} onClick={() => { const next = theme === "paper" ? "night" : "paper"; setTheme(next); save("shelf:reader-theme", next); }}>
            {theme === "paper" ? <Moon size={18} strokeWidth={1.5} aria-hidden="true" /> : <Sun size={18} strokeWidth={1.5} aria-hidden="true" />}
          </button>
          {fullscreen.available && <button className="icon-button" aria-label={fullscreen.on ? "Exit fullscreen" : "Go fullscreen"} onClick={() => void fullscreen.toggle()}>
            {fullscreen.on ? <Minimize2 size={18} strokeWidth={1.5} aria-hidden="true" /> : <Maximize2 size={18} strokeWidth={1.5} aria-hidden="true" />}
          </button>}
          <button className="icon-button" aria-label="Bookmark this passage" disabled={!data} onClick={() => void bookmarks.add(chapter, currentParagraph())}>
            {marked.size ? <BookmarkCheck size={18} strokeWidth={1.5} aria-hidden="true" /> : <Bookmark size={18} strokeWidth={1.5} aria-hidden="true" />}
          </button>
        </div>
        {showSize && <label className="text-size">Text size<input aria-label="Text size" type="range" min="16" max="28" value={size} onChange={(event) => { setSize(Number(event.target.value)); save("shelf:reader-size", event.target.value); }} /><span className="tabular">{size}px</span></label>}
        <div className="page">
          {!data ? (
            <p role="status" className="text-center">Loading authorized chapter…</p>
          ) : (
            <>
              <article ref={textRef} className="reading-text" style={{ fontSize: size }}>
                <p className="chapter-label">Chapter {data.chapter}</p>
                <h2>{data.title}</h2>
                <div className="chapter-rule" />
                {data.paragraphs.map((p, i) => (
                  <p key={i} id={`para-${i}`} data-para={i} className={marked.has(i) ? "marked" : undefined}>{p}</p>
                ))}
              </article>
              <div className="page-nav">
                <button className="icon-button" aria-label="Previous chapter" disabled={index === 0} onClick={() => go(chapters[index - 1])}><ChevronLeft size={18} aria-hidden="true" /></button>
                <span className="page-count">{index + 1} / {chapters.length}</span>
                <button className="icon-button" aria-label="Next chapter" disabled={index >= chapters.length - 1} onClick={() => go(chapters[index + 1])}><ChevronRight size={18} aria-hidden="true" /></button>
              </div>
              <div className="page-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>
              <p className="fine-print justify-center">Access ends {new Date(data.expires_at).toLocaleString()}. Text already shown cannot be recalled; this is access control, not DRM</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
