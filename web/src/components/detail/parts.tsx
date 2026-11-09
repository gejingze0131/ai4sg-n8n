import Link from "next/link";
import { EVIDENCE, fmtNum, langName } from "@/lib/vocab";

export type Quote = { id?: string; field?: string; quote_original?: string; quote_en?: string; found?: boolean };

const present = (v: unknown) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length);

export function Kv({ pairs }: { pairs: [string, unknown][] }) {
  const shown = pairs.filter(([, v]) => present(v));
  if (!shown.length) return null;
  return <dl className="kv">{shown.map(([k, v]) => <div key={k} className="contents"><dt>{k}</dt><dd>{Array.isArray(v) ? v.join(", ") : String(v)}</dd></div>)}</dl>;
}

export function quotesFor(evidence: Quote[], block: any, name: string) {
  const refs: string[] = block?.evidence_refs ?? [];
  return evidence.filter((e) => refs.includes(e.id ?? "") || (!refs.length && e.field === name));
}

export function VerBadge({ qs }: { qs: Quote[] }) {
  if (!qs.length) return <span className="ver ver-none">No quote</span>;
  return qs.every((q) => q.found !== false) ? <span className="ver ver-ok">✓ Quote verified</span> : <span className="ver ver-no">✗ Quote not found in source</span>;
}

export function Tick({ q }: { q?: Quote }) {
  if (!q) return <span className="ver ver-none">—</span>;
  return q.found === false ? <span className="ver ver-no" title="Quote not found in the source">✗</span> : <span className="ver ver-ok" title="Quote found in the source">✓</span>;
}

function QuoteRow({ q, lang }: { q: Quote; lang: string }) {
  const nf = q.found === false ? <> <span className="ver ver-no">not found</span></> : null;
  if (!q.quote_en || q.quote_en.trim() === String(q.quote_original ?? "").trim()) {
    return <div className="q q-one"><div><span className="lab">Quote · {langName(lang)}</span>{q.quote_original}{nf}</div></div>;
  }
  return (
    <div className="q">
      <div><span className="lab">Original · {langName(lang)}</span><span className="orig" lang={lang}>{q.quote_original}</span></div>
      <div><span className="lab">English</span>{q.quote_en}{nf}</div>
    </div>
  );
}

export function Quotes({ qs, lang }: { qs: Quote[]; lang: string }) {
  if (!qs.length) return null;
  return <details><summary>Show {qs.length} quote{qs.length > 1 ? "s" : ""}</summary><div className="quotes">{qs.map((q, i) => <QuoteRow key={i} q={q} lang={lang} />)}</div></details>;
}

export function Fact({ title, badge, wide, children }: { title: React.ReactNode; badge?: React.ReactNode; wide?: boolean; children: React.ReactNode }) {
  return <div className={`fact ${wide ? "fact-wide" : ""}`}><div className="fact-h"><b>{title}</b>{badge}</div>{children}</div>;
}

export function FactCard({ evidence, lang, title, name, block, wide, children }: { evidence: Quote[]; lang: string; title: React.ReactNode; name: string; block: any; wide?: boolean; children: React.ReactNode }) {
  const b = block ?? {};
  const qs = quotesFor(evidence, b, name);
  return <Fact title={title} wide={wide} badge={b.stated === false ? <span className="ver ver-none">Not stated</span> : <VerBadge qs={qs} />}>{children}<Quotes qs={qs} lang={lang} /></Fact>;
}

export function STag({ sid, known }: { sid: number | string; known?: Set<number> }) {
  if (known && !known.has(Number(sid))) return <span className="stag ver ver-none ml-1">S{sid}</span>;
  return <Link href={`/sources/${sid}`} className="stag">S{sid}</Link>;
}

export function STags({ list, known }: { list?: (number | string)[]; known?: Set<number> }) {
  return <>{[...new Set((list ?? []).map(Number))].map((id) => <STag key={id} sid={id} known={known} />)}</>;
}

export function groupTexts(items?: { text: string; sid: number }[]) {
  const m = new Map<string, { text: string; sids: number[] }>();
  for (const x of items ?? []) {
    const k = String(x.text).trim().toLowerCase();
    if (!k) continue;
    if (m.has(k)) m.get(k)!.sids.push(x.sid);
    else m.set(k, { text: String(x.text).trim(), sids: [x.sid] });
  }
  return [...m.values()];
}

export function Tagged({ items, known }: { items: { text: string; sids?: number[]; sid?: number }[]; known?: Set<number> }) {
  if (!items.length) return <div className="na">Not stated.</div>;
  return <ul className="plain">{items.map((x, i) => <li key={i}>{x.text}<STags list={x.sids ?? [x.sid!]} known={known} /></li>)}</ul>;
}

// "[S12]" in a generated text becomes a link to that source
export function LinkS({ text, known }: { text: string; known?: Set<number> }) {
  const parts = String(text ?? "").split(/(\[S\d+\])/g);
  return <>{parts.map((p, i) => { const m = p.match(/^\[S(\d+)\]$/); return m ? <STag key={i} sid={m[1]} known={known} /> : <span key={i}>{p}</span>; })}</>;
}

export function Ladder({ type }: { type: string }) {
  const idx = EVIDENCE.findIndex((e) => e[0] === type);
  return (
    <>
      <div className="ladder">{EVIDENCE.map((e, i) => <span key={e[0]} className={i >= idx && idx >= 0 ? "on" : ""} title={e[1]} />).reverse()}</div>
      <div className="ladder-l"><span>None</span><span>RCT</span></div>
    </>
  );
}

export const Sec = ({ title, children, right }: { title: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) => <div className="sec"><h3 className="flex justify-between items-baseline gap-3"><span>{title}</span>{right}</h3>{children}</div>;
export const num = (v: unknown) => fmtNum(Number(v));
