"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { JobWatcher } from "./JobWatcher";

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const out = await res?.json().catch(() => null);
  if (!res?.ok) throw new Error(out?.error ?? "network error");
  return out;
}

export function SourceProjectActions({ sourceId }: { sourceId: number }) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [msg, setMsg] = useState("");
  const [job, setJob] = useState<string | null>(null);
  const run = async (path: string, body: unknown) => {
    setMsg("Saving…");
    try {
      const r = await post(path, body);
      setMsg(`Saved: now in ${r.code}.`);
      if (r.job_id) setJob(r.job_id);
      router.refresh();
    } catch (e) { setMsg(`Could not save (${(e as Error).message}).`); }
  };
  return (
    <div className="flex flex-wrap gap-2 items-center mt-2">
      <button className="btn" onClick={() => run("/api/projects/detach", { source_id: sourceId })}>Not this project</button>
      <span className="text-muted">or move to</span>
      <input className="input w-28" aria-label="Target project code" placeholder="P-00012" value={target} onChange={(e) => setTarget(e.target.value)} />
      <button className="btn" onClick={() => { const t = target.trim().toUpperCase(); if (!/^P-\d{5}$/.test(t)) { setMsg("Enter a project code like P-00012."); return; } run("/api/projects/move", { source_id: sourceId, target: t }); }}>Move</button>
      {msg && <span className="note" role="status">{msg}</span>}
      {job && <JobWatcher id={job} doneNote="Project summaries rewritten." />}
    </div>
  );
}

export function MergeForm({ code }: { code: string }) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [msg, setMsg] = useState("");
  const submit = async () => {
    const t = target.trim().toUpperCase();
    if (!/^P-\d{5}$/.test(t) || t === code) { setMsg("Enter another project code like P-00012."); return; }
    if (!confirm(`Move every source of ${code} into ${t}? ${code} will disappear and its name will become an alias.`)) return;
    setMsg("Saving…");
    try { const r = await post("/api/projects/merge", { project: code, target: t }); router.push(`/projects/${r.code}`); }
    catch (e) { setMsg(`Could not save (${(e as Error).message}).`); }
  };
  return (
    <div className="flex flex-wrap gap-2 items-center mt-2">
      <span>Merge {code} into</span>
      <input className="input w-28" aria-label="Target project code" placeholder="P-00012" value={target} onChange={(e) => setTarget(e.target.value)} />
      <button className="btn" onClick={submit}>Merge</button>
      {msg && <span className="note" role="status">{msg}</span>}
    </div>
  );
}
