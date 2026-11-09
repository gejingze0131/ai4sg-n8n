"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { JOB_TYPE } from "@/lib/vocab";

const TEXT: Record<string, string> = { queued: "Waiting for the pipeline…", running: "Running…", done: "Finished.", failed: "Failed." };

// follows one job until it ends, then reloads what is on the page
export function JobWatcher({ id, doneNote }: { id: string; doneNote?: string }) {
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const j = await fetch(`/api/jobs/${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (stop) return;
      if (j) setJob(j);
      if (j && (j.status === "done" || j.status === "failed")) { router.refresh(); return; }
      t = setTimeout(tick, 4000);
    };
    tick();
    return () => { stop = true; clearTimeout(t); };
  }, [id, router]);
  if (!job) return <span className="note">Sent…</span>;
  const cls = job.status === "done" ? "ver-ok" : job.status === "failed" ? "ver-no" : "ver-none";
  return <span role="status" className="inline-flex flex-wrap items-center gap-1.5 text-[14px]"><span className={`ver ${cls}`}>{JOB_TYPE[job.type] ?? job.type}: {TEXT[job.status]}</span>{job.status === "done" && doneNote && <span className="note">{doneNote}</span>}{job.error && <span className="note text-bad">{job.error}</span>}</span>;
}
