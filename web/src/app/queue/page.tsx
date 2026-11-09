import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/auth/session";
import { QueueTable, type QueueRow } from "@/components/actions/QueueTable";
import { Empty, Pagination } from "@/components/ui";
import { flatten, parseSources, type RawParams } from "@/lib/filters";
import { listSources, stateCounts } from "@/lib/queries/sources";
import { DOMAIN_COLOR, DOMAIN_ORDER, DOMAIN_TAGS, SOURCE_STATES, SOURCE_TYPE, langName } from "@/lib/vocab";

export const metadata: Metadata = { title: "Not analysed yet" };

const ORDER = ["queued", "duplicate", "filtered", "download_failed", "not_screened", "judged_out", "extraction_failed"];
const SORTS: [string, string][] = [["default", "Default order"], ["relevance", "Screen relevance"], ["new", "Newest first"], ["domain", "Domain"], ["country", "Country"], ["type", "Source type"]];

function why(r: any, state: string) {
  const sc = r.screen ?? {};
  const pct = sc.relevance != null ? `${Math.round(100 * sc.relevance)}%` : "";
  if (state === "queued" && r.pick?.selected === false) return [`Not chosen for analysis: ${r.pick.reason ?? ""}`, pct && `screen ${pct}`].filter(Boolean).join(" · ");
  if (state === "queued" || state === "filtered") return [pct && `Screen ${pct}`, sc.in_domain === false && "outside the domain", sc.is_ai4sg === false && "not AI4SG", sc.reason].filter(Boolean).join(" · ");
  if (state === "duplicate") return `Same document as S${r.duplicate_of}${r.pick?.group_reason ? ` · ${r.pick.group_reason}` : ""}`;
  if (state === "download_failed") return "No readable text (blocked, bot check, unsupported file)";
  if (state === "judged_out") return r.summary || "Judged not AI4SG by the in-depth analysis";
  if (sc.error) return `The screen failed (${sc.error}); it is screened again in the next run of this domain`;
  return r.raw_status === "candidate" ? "Not downloaded yet" : "Downloaded, not screened";
}
const textLabel = (r: any) => (r.text_level === "full" || r.text_chars >= 3000 ? "Full text" : r.text_chars >= 300 ? "Abstract" : r.text_chars ? "Too short" : "None");

export default async function Queue({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = await searchParams;
  await requireRole("expert", "/queue");
  const raw = flatten(sp);
  const parsed = parseSources({ ...sp, status: raw.status ?? "queued" });
  const f = parsed.status === "analysed" ? { ...parsed, status: "queued" as const } : parsed;
  const state = Object.keys(SOURCE_STATES).find((k) => SOURCE_STATES[k].api === f.status) ?? "queued";
  const [{ total, page, pageSize, items }, counts] = await Promise.all([listSources(f), stateCounts(f.domain)]);
  const can = state !== "judged_out" && state !== "extraction_failed";
  const rows: QueueRow[] = items.map((r) => ({
    id: Number(r.id), headline: r.headline, url: r.url, tags: r.domain_tags, text: textLabel(r), why: why(r, state),
    meta: [r.country, SOURCE_TYPE[r.source_type] ?? r.source_type, langName(r.language), r.run_id ? `run ${r.run_id}` : "", r.cascaded ? "cascade" : ""].filter(Boolean).join(" · "),
    projectCode: r.project_code ?? undefined, projectName: r.project_name ?? undefined, guess: r.project_guess ?? undefined, label: r.text_chars >= 300 ? "Analyse" : "Download & analyse",
  }));
  const link = (change: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: f.status as string, domain: f.domain, q: f.q, sort: f.sort === "default" ? undefined : f.sort, ...change })) if (v) s.set(k, v);
    return `/queue?${s}`;
  };
  const totalOpen = ORDER.filter((k) => k !== "judged_out").reduce((n, k) => n + (counts[k] ?? 0), 0);
  return (
    <div className="flex flex-col gap-3.5">
      <div><h1 className="page-title">Not analysed yet <span className="font-normal text-muted text-[18px]">· {totalOpen} sources</span></h1><p className="sub">Every source found is kept. Open one to read it, and send the ones worth it to the analysis.</p></div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Domain">
        <Link href={link({ domain: undefined })} className={`tab ${!f.domain ? "tab-on" : ""}`}>All domains</Link>
        {DOMAIN_ORDER.map((d) => <Link key={d} href={link({ domain: d })} className={`tab inline-flex items-center gap-1.5 ${f.domain === d ? "tab-on" : ""}`}><span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: DOMAIN_COLOR[d] }} />{DOMAIN_TAGS[d]}</Link>)}
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {ORDER.map((k) => <Link key={k} role="tab" aria-selected={k === state} href={link({ status: SOURCE_STATES[k].api })} className={`tab ${k === state ? "tab-on" : ""}`}>{SOURCE_STATES[k].label} ({counts[k] ?? 0})</Link>)}
      </div>
      <p className="note">{SOURCE_STATES[state].help}</p>
      <form action="/queue" className="flex flex-wrap gap-2">
        <input type="hidden" name="status" value={f.status} />
        {f.domain && <input type="hidden" name="domain" value={f.domain} />}
        <input type="search" name="q" defaultValue={f.q ?? ""} className="input min-w-[240px] flex-1" placeholder="Search these sources…" aria-label="Search these sources" />
        <select name="sort" defaultValue={f.sort} className="select" aria-label="Sort">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <button className="btn">Apply</button>
      </form>
      {rows.length ? <QueueTable rows={rows} canAnalyse={can} /> : <Empty>Nothing here.</Empty>}
      <Pagination total={total} page={page} pageSize={pageSize} base="/queue" params={{ ...raw, status: f.status }} />
    </div>
  );
}
