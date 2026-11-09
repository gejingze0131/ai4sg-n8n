import Link from "next/link";
import { DOMAIN_TAGS, EVIDENCE_LABEL, FLAGS, REVIEW_STATE, fmtNum } from "@/lib/vocab";

export function DomainChips({ tags }: { tags: string[] }) {
  return <>{(tags ?? []).map((d) => <span key={d} className={`chip d-${d}`}>{DOMAIN_TAGS[d] ?? d}</span>)}</>;
}

export const Chip = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <span className={`chip ${className}`}>{children}</span>;

export function DecisionChip({ decision }: { decision?: string | null }) {
  if (decision === "approved") return <span className="chip chip-pass">✓ Passed</span>;
  if (decision === "rejected") return <span className="chip chip-fail">✗ Failed</span>;
  return null;
}

export function ReviewChip({ p }: { p: { review_state: string; n_analysed: number; n_waiting: number } }) {
  if (p.review_state === "none") return null;
  if (p.review_state === "awaiting") return <span className="chip">{p.n_analysed - p.n_waiting}/{p.n_analysed} sources reviewed</span>;
  return p.review_state === "failed" ? <span className="chip chip-fail">✗ {REVIEW_STATE.failed}</span> : <span className="chip chip-pass">✓ {REVIEW_STATE.passed}</span>;
}

export function EvidenceChip({ type }: { type: string }) {
  return <span className="chip">{EVIDENCE_LABEL[type] ?? "No evidence"}</span>;
}

export function FlagChips({ flags, counts }: { flags: string[]; counts?: Record<string, number> }) {
  return <>{flags.map((f) => <span key={f} className={`chip ${(FLAGS[f] ?? [])[1] === "bad" ? "chip-bad" : "chip-flag"}`}>⚠ {(FLAGS[f] ?? [f])[0]}{counts?.[f] ? ` · ${counts[f]} source${counts[f] > 1 ? "s" : ""}` : ""}</span>)}</>;
}

export function Meter({ label, score }: { label: string; score: number | null | undefined }) {
  return <div className="meter">{label}<span className="m"><i style={{ width: `${score ?? 0}%` }} /></span>{score != null ? `${score} / 100` : "not scored"}</div>;
}

export function Pagination({ total, page, pageSize, base, params }: { total: number; page: number; pageSize: number; base: string; params: Record<string, string | undefined> }) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (last <= 1) return null;
  const href = (n: number) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") s.set(k, v);
    if (n > 1) s.set("page", String(n));
    const q = s.toString();
    return q ? `${base}?${q}` : base;
  };
  return (
    <nav className="flex items-center justify-between gap-3 mt-4" aria-label="Pages">
      {page > 1 ? <Link className="btn" href={href(page - 1)}>← Previous</Link> : <span />}
      <span className="note">Page {page} of {fmtNum(last)} · {fmtNum(total)} in all</span>
      {page < last ? <Link className="btn" href={href(page + 1)}>Next →</Link> : <span />}
    </nav>
  );
}

export const Empty = ({ children }: { children: React.ReactNode }) => <div className="card p-10 text-center text-muted">{children}</div>;

export function BarList({ entries, formatValue }: { entries: { key: string; label: string; n: number; href?: string; color?: string; active?: boolean; hint?: string }[]; formatValue?: (n: number) => string }) {
  const max = Math.max(1, ...entries.map((e) => e.n));
  if (!entries.length) return <div className="na">No data for these filters.</div>;
  return (
    <div className="flex flex-col gap-0.5">
      {entries.map((e) => {
        const row = (
          <>
            <span className="truncate text-ink-2 text-[14px]">{e.label}</span>
            <span className="h-3 block"><span className="block h-full rounded-r-[4px]" style={{ width: `${(100 * e.n) / max}%`, minWidth: e.n ? 3 : 0, background: e.color ?? "var(--color-accent)" }} /></span>
            <span className="text-right text-[14px] tabular-nums text-ink">{formatValue ? formatValue(e.n) : fmtNum(e.n)}</span>
          </>
        );
        const cls = `grid grid-cols-[minmax(0,44%)_1fr_auto] gap-2.5 items-center px-1 py-[3px] rounded-md ${e.active ? "bg-accent-soft" : ""}`;
        const title = e.hint ?? `${e.label}: ${e.n}`;
        return e.href ? <Link key={e.key} href={e.href} scroll={false} title={title} className={`${cls} hover:bg-surface-2 hover:no-underline`}>{row}</Link> : <div key={e.key} title={title} className={cls}>{row}</div>;
      })}
    </div>
  );
}
