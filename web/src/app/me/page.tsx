import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/auth/session";
import { isExpert } from "@/auth/roles";
import { JobsTable } from "@/components/actions/AdminActions";
import { ChangePassword } from "@/components/actions/AuthForms";
import { DecisionChip } from "@/components/ui";
import { w } from "@/db/client";
import { fmtDateTime } from "@/lib/vocab";

export const metadata: Metadata = { title: "My account" };

export default async function Me() {
  const v = await requireRole("visitor", "/me");
  const reviews = await w(`SELECT id, headline, review_decision, review_comment, reviewed_at FROM api.source_cards WHERE reviewer_id = $1 ORDER BY reviewed_at DESC LIMIT 100`, [v.id]);
  return (
    <div className="flex flex-col gap-6 max-w-[1000px]">
      <div><h1 className="page-title">{v.name}</h1><p className="sub">{v.email}</p></div>
      {v.requestedRole === "expert" && !v.approved && <div className="banner banner-warn !my-0">Your request to be an expert is waiting for an administrator. Until then you have visitor access.</div>}
      {isExpert(v) && <section><h2 className="text-[17px] font-semibold mb-2">My analysis requests</h2><JobsTable mine /></section>}
      {isExpert(v) && (
        <section>
          <h2 className="text-[17px] font-semibold mb-2">My reviews ({reviews.length})</h2>
          {reviews.length ? <div className="tbl-wrap card"><table className="qt min-w-[640px]"><thead><tr><th>Source</th><th>Decision</th><th>Comment</th><th>When</th></tr></thead><tbody>{reviews.map((r) => <tr key={r.id}><td><Link href={`/sources/${r.id}`} className="orig">{r.headline}</Link></td><td><DecisionChip decision={r.review_decision} /></td><td>{r.review_comment}</td><td className="whitespace-nowrap">{fmtDateTime(r.reviewed_at)}</td></tr>)}</tbody></table></div> : <p className="na">No reviews yet.</p>}
        </section>
      )}
      <section><h2 className="text-[17px] font-semibold mb-2">Password</h2><ChangePassword /></section>
    </div>
  );
}
