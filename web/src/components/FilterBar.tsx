"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { DOMAIN_COLOR, DOMAIN_ORDER, DOMAIN_TAGS, EVIDENCE, SOURCE_TYPE, STAGE, TECH } from "@/lib/vocab";

export type Facets = { countries: string[]; techs: string[]; runs: { id: string; domain: string | null; started_at: string }[] };
type Field = "q" | "domain" | "country" | "tech" | "stage" | "evidence" | "review" | "source_type" | "run" | "has_outcomes" | "has_cost" | "sort" | "include_pending";

export function FilterBar({ facets, fields, sorts, searchPlaceholder }: { facets: Facets; fields: Field[]; sorts?: [string, string][]; searchPlaceholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [text, setText] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const has = (f: Field) => fields.includes(f);

  useEffect(() => { setText(params.get("q") ?? ""); }, [params]);

  const push = (change: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    for (const [k, v] of Object.entries(change)) { if (v) next.set(k, v); else next.delete(k); }
    const s = next.toString();
    start(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };
  const select = (name: Field, label: string, options: [string, string][]) => (
    <select className="select" aria-label={label} value={params.get(name) ?? ""} onChange={(e) => push({ [name]: e.target.value })}>
      <option value="">{label}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  const check = (name: Field, label: string) => (
    <label className="inline-flex items-center gap-1.5 text-[14px] whitespace-nowrap">
      <input type="checkbox" checked={params.get(name) === "1"} onChange={(e) => push({ [name]: e.target.checked ? "1" : null })} />{label}
    </label>
  );
  const domain = params.get("domain") ?? "";
  const anyActive = [...params.keys()].some((k) => k !== "page" && k !== "sort");

  return (
    <div className={`flex flex-col gap-2.5 ${pending ? "opacity-70" : ""}`} aria-busy={pending}>
      {has("domain") && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Domain">
          <button onClick={() => push({ domain: null })} className={`tab ${!domain ? "tab-on" : ""}`}>All domains</button>
          {DOMAIN_ORDER.map((d) => (
            <button key={d} onClick={() => push({ domain: domain === d ? null : d })} className={`tab inline-flex items-center gap-1.5 ${domain === d ? "tab-on" : ""}`}>
              <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: DOMAIN_COLOR[d] }} />{DOMAIN_TAGS[d]}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        {has("q") && <input type="search" className="input flex-1 min-w-[220px]" placeholder={searchPlaceholder ?? "Search name, organisation, place, source title…"} aria-label="Search" value={text}
          onChange={(e) => { const v = e.target.value; setText(v); clearTimeout(timer.current); timer.current = setTimeout(() => push({ q: v.trim() || null }), 300); }} />}
        {has("country") && select("country", "All countries", facets.countries.map((c) => [c, c]))}
        {has("tech") && select("tech", "All AI technologies", facets.techs.map((t) => [t, TECH[t] ?? t]))}
        {has("stage") && select("stage", "All stages", Object.entries(STAGE))}
        {has("evidence") && select("evidence", "All evidence", EVIDENCE)}
        {has("review") && select("review", "Any review state", [["awaiting", "Awaiting review"], ["passed", "Passed"], ["failed", "Failed"], ["attention", "Needs attention (warning flags)"]])}
        {has("source_type") && select("source_type", "All source types", Object.entries(SOURCE_TYPE))}
        {has("run") && select("run", "All runs", facets.runs.map((r) => [String(r.id), `Run ${r.id}${r.domain ? ` · ${DOMAIN_TAGS[r.domain] ?? r.domain}` : ""}`]))}
        {has("has_outcomes") && check("has_outcomes", "Has outcomes")}
        {has("has_cost") && check("has_cost", "Has cost")}
        {has("include_pending") && check("include_pending", "Include projects not analysed yet")}
        {sorts && (
          <select className="select" aria-label="Sort" value={params.get("sort") ?? sorts[0][0]} onChange={(e) => push({ sort: e.target.value === sorts[0][0] ? null : e.target.value })}>
            {sorts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        {anyActive && <button className="btn" onClick={() => { setText(""); start(() => router.replace(pathname, { scroll: false })); }}>Reset</button>}
      </div>
    </div>
  );
}
