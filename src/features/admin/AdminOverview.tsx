import { useEffect, useRef, useState } from "react";
import type { Dashboard } from "./data";
import { formatUsdt } from "../catalogue/catalogue";
import { initials } from "../../lib/format";

const DAY = 86400000;

/** Loans started per day over the last 30 days: the dashboard's one main chart. */
function ActivityChart({ days }: { days: { date: number; count: number }[] }) {
  // Match the drawing width to the rendered width so labels stay a true 11px on every screen.
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const h = w < 480 ? 200 : 260, left = 28, bottom = 24, top = 12;
  const max = Math.max(4, ...days.map((d) => d.count));
  const step = Math.ceil(max / 4);
  const ceiling = step * 4;
  const x = (i: number) => left + (i / (days.length - 1)) * (w - left - 8);
  const y = (v: number) => top + (1 - v / ceiling) * (h - top - bottom);
  const points = days.map((d, i) => [x(i), y(d.count)] as const);
  const line = points.map(([px, py], i) => {
    if (i === 0) return `M${px},${py}`;
    const [qx, qy] = points[i - 1];
    const mid = (qx + px) / 2;
    return `C${mid},${qy} ${mid},${py} ${px},${py}`;
  }).join(" ");
  const area = `${line} L${x(days.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const labels = w < 480 ? [0, 14, days.length - 1] : [0, 7, 14, 21, days.length - 1];
  return (
    <div ref={box} className="chart-box">
    <svg className="chart" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Loans started per day for the last 30 days, ${days.reduce((s, d) => s + d.count, 0)} in total`}>
      <defs>
        <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e3a33f" stopOpacity="0.22" />
          <stop offset="1" stopColor="#e3a33f" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line x1={left} x2={w - 8} y1={y(i * step)} y2={y(i * step)} stroke="#e9ede9" strokeOpacity="0.06" />
          <text x={left - 8} y={y(i * step) + 4} textAnchor="end">{i * step}</text>
        </g>
      ))}
      <path d={area} fill="url(#activityFill)" />
      <path d={line} fill="none" stroke="#e3a33f" strokeWidth="2" />
      {labels.map((i) => (
        <text key={i} x={x(i)} y={h - 6} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"}>
          {new Date(days[i].date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </text>
      ))}
    </svg>
    </div>
  );
}

export function AdminOverview({ data, decide }: { data: Dashboard; decide: (id: string, status: "approved" | "rejected") => void }) {
  const now = data.loadedAt;
  const published = data.books.filter((b) => b.status === "published").length;
  const readers = new Set(data.loans.filter((l) => l.status === "active" && l.expires_at && Date.parse(l.expires_at) > now).map((l) => l.user_id)).size;
  const confirmed = data.payments.filter((p) => p.status === "confirmed");
  const failed = data.payments.filter((p) => p.status === "failed").length;
  const settled = confirmed.length + failed;
  const gross = confirmed.reduce((s, p) => s + BigInt(p.gross_amount), 0n);
  const platform = confirmed.reduce((s, p) => s + BigInt(p.platform_share), 0n);
  const today = Math.floor(now / DAY) * DAY;
  const days = Array.from({ length: 30 }, (_, i) => ({ date: today - (29 - i) * DAY, count: 0 }));
  let previous = 0;
  for (const l of data.loans) {
    if (!l.started_at) continue;
    const t = Math.floor(Date.parse(l.started_at) / DAY) * DAY;
    const offset = (today - t) / DAY;
    if (offset >= 0 && offset < 30) days[29 - offset].count++;
    else if (offset >= 30 && offset < 60) previous++;
  }
  const total = days.reduce((s, d) => s + d.count, 0);
  const change = total - previous;
  const pending = data.applications.filter((a) => a.status === "pending");
  const recent = (pending.length ? pending : data.applications).slice(0, 4);
  return (
    <>
      <div className="stat-row">
        <div className="stat-card"><span>Books</span><strong>{data.books.length}</strong><small className="tabular">{published} published</small></div>
        <div className="stat-card"><span>Active readers</span><strong>{readers}</strong><small>With a loan open now</small></div>
        <div className="stat-card"><span>Confirmed revenue</span><strong>{formatUsdt(gross)}</strong><small className="tabular">USDT · {formatUsdt(platform)} platform share</small></div>
        <div className="stat-card"><span>Payment success</span><strong>{settled ? `${Math.round((confirmed.length / settled) * 100)}%` : "–"}</strong><small className="tabular">{settled ? `${confirmed.length} of ${settled} settled payments` : "No settled payments yet"}</small></div>
      </div>
      <div className="admin-overview">
        <section className="card chart-card" aria-labelledby="activity-heading">
          <header>
            <h2 id="activity-heading">Loans started, last 30 days</h2>
            <span className="meta tabular">{total} · {change === 0 ? "same as" : `${change > 0 ? "+" : "−"}${Math.abs(change)} vs`} previous 30 days</span>
          </header>
          <ActivityChart days={days} />
        </section>
        <section className="card recent-card" aria-labelledby="recent-heading">
          <header><h2 id="recent-heading">{pending.length ? "Pending applications" : "Recent applications"}</h2><span className="meta tabular">{pending.length} pending</span></header>
          {!recent.length ? <p className="meta">No applications yet.</p> : (
            <div className="recent-list">
              {recent.map((a) => (
                <div className="recent-item" key={a.id}>
                  <span className="avatar" aria-hidden="true">{initials(a.name.replace(/\s+/g, "."))}</span>
                  <div className="min-w-0"><strong>{a.name}</strong><span>{a.contributor_type === "publisher" ? "Publisher" : "Author"} application · {a.status}</span></div>
                  {a.status === "pending" && (
                    <div className="recent-actions">
                      <button className="button-positive button-secondary" onClick={() => decide(a.id, "approved")}>Approve</button>
                      <button className="button-ghost" onClick={() => decide(a.id, "rejected")}>Reject</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
