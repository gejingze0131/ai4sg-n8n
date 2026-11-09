"use client";

import Link from "next/link";
import { useState } from "react";
import { DOMAIN_TAGS } from "@/lib/vocab";
import { JobWatcher } from "./JobWatcher";

export type QueueRow = { id: number; headline: string; meta: string; url: string; tags: string[]; text: string; why: string; projectCode?: string; projectName?: string; guess?: string; label: string };

export function QueueTable({ rows, canAnalyse }: { rows: QueueRow[]; canAnalyse: boolean }) {
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [sent, setSent] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState("");
  const [jobs, setJobs] = useState<string[]>([]);

  const toggle = (id: number, on: boolean) => setSel((s) => { const n = new Set(s); if (on) { if (n.size < 30) n.add(id); } else n.delete(id); return n; });
  const analyse = async (ids: number[]) => {
    ids = ids.filter((id) => !sent.has(id)).slice(0, 30);
    if (!ids.length) return;
    setMsg("Sending…");
    const res = await fetch("/api/analyse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_ids: ids }) }).catch(() => null);
    const out = await res?.json().catch(() => null);
    if (!res?.ok) { setMsg(`Could not send (${out?.error ?? "network error"}).`); return; }
    setSent((s) => new Set([...s, ...ids]));
    setSel(new Set());
    setJobs((j) => [out.job_id, ...j]);
    setMsg(`Sent ${out.sources} source${out.sources === 1 ? "" : "s"} to the analysis: about ${Math.max(1, out.sources)} minute${out.sources === 1 ? "" : "s"}.${out.skipped?.length ? ` ${out.skipped.length} already being analysed.` : ""}`);
  };
  const free = rows.filter((r) => !sent.has(r.id));
  return (
    <div>
      {canAnalyse && (
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <button className="btn btn-primary" disabled={!sel.size} onClick={() => analyse([...sel])}>▶ Analyse selected ({sel.size})</button>
          <span className="note">At most 30 at a time. One GPT-6 Sol call each; a source without text is downloaded first.</span>
          {msg && <span className="note" role="status">{msg}</span>}
          {jobs.map((j) => <JobWatcher key={j} id={j} doneNote="Results are on the source pages." />)}
        </div>
      )}
      <div className="tbl-wrap card">
        <table className="qt min-w-[860px]">
          <thead>
            <tr>
              {canAnalyse && <th><input type="checkbox" aria-label="Select all shown" checked={free.length > 0 && free.slice(0, 30).every((r) => sel.has(r.id))} onChange={(e) => setSel(e.target.checked ? new Set(free.slice(0, 30).map((r) => r.id)) : new Set())} /></th>}
              <th>Source</th><th>Text</th><th>Why not analysed</th><th>Deployment</th>{canAnalyse && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {canAnalyse && <td><input type="checkbox" aria-label={`Select S${r.id}`} disabled={sent.has(r.id)} checked={sel.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} /></td>}
                <td>
                  <Link href={`/sources/${r.id}`} className="orig">{r.headline}</Link>
                  <div className="note">{r.tags.map((t) => DOMAIN_TAGS[t] ?? t).join(", ")} · {r.meta} · <a href={r.url} target="_blank" rel="noopener noreferrer">open ↗</a></div>
                </td>
                <td>{r.text}</td>
                <td className="text-ink-2 text-[14px]">{r.why}</td>
                <td>{r.projectCode ? <><Link href={`/projects/${r.projectCode}`}>{r.projectCode}</Link> {r.projectName}</> : r.guess}</td>
                {canAnalyse && <td>{sent.has(r.id) ? <span className="ver ver-ok">sent</span> : <button className="btn" onClick={() => analyse([r.id])}>{r.label}</button>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
