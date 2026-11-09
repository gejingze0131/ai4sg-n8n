"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DecisionChip } from "@/components/ui";
import { fmtDateTime } from "@/lib/vocab";

export function ReviewBar({ sourceId, decision, comment, reviewer, reviewedAt }: { sourceId: number; decision?: string | null; comment?: string | null; reviewer?: string | null; reviewedAt?: string | null }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (d: "approved" | "rejected") => {
    setBusy(true); setMsg("Saving…");
    const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_id: sourceId, decision: d, comment: text.trim() }) }).catch(() => null);
    const out = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) { setMsg("Saved."); setText(""); router.refresh(); } else setMsg(`Could not save (${out?.error ?? "network error"}).`);
  };
  return (
    <div className="card sticky bottom-3 mt-6 p-3 shadow-md z-10">
      {decision && <div className="text-[14px] text-ink-2 mb-2 flex flex-wrap items-center gap-1.5"><DecisionChip decision={decision} />{reviewer && <>by {reviewer}</>}{reviewedAt && <> · {fmtDateTime(reviewedAt)}</>}{comment && <> · “{comment}”</>}<span className="text-muted">· you can change it below</span></div>}
      <div className="flex flex-wrap gap-2 items-center">
        <textarea className="input flex-1 min-w-[220px] h-10 min-h-10 resize-y" aria-label="Comment" placeholder="Comment on this source's extraction (optional): what is wrong or missing, what you corrected…" value={text} onChange={(e) => setText(e.target.value)} />
        <button disabled={busy} className="btn btn-pass" onClick={() => send("approved")}>✓ Pass</button>
        <button disabled={busy} className="btn btn-fail" onClick={() => send("rejected")}>✗ Fail</button>
      </div>
      {msg && <div className="note mt-1.5" role="status">{msg}</div>}
    </div>
  );
}
