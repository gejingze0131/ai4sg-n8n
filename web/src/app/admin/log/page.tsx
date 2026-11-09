import type { Metadata } from "next";
import { Empty, Pagination } from "@/components/ui";
import { w } from "@/db/client";
import { flatten, likePattern, Params, type RawParams } from "@/lib/filters";
import { fmtDateTime } from "@/lib/vocab";

export const metadata: Metadata = { title: "Audit log" };
const SIZE = 50;
const brief = (v: unknown) => (v == null ? "" : JSON.stringify(v).slice(0, 300));

export default async function Log({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = flatten(await searchParams);
  const p = new Params();
  const where: string[] = [];
  if (sp.action?.trim()) where.push(`action ILIKE ${p.add(likePattern(sp.action.trim()))}`);
  if (sp.actor?.trim()) where.push(`actor_name ILIKE ${p.add(likePattern(sp.actor.trim()))}`);
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const [[total], items] = await Promise.all([
    w<{ n: number }>(`SELECT count(*)::int AS n FROM web.audit_log ${clause}`, p.values),
    w(`SELECT * FROM web.audit_log ${clause} ORDER BY at DESC LIMIT ${SIZE} OFFSET ${(page - 1) * SIZE}`, p.values),
  ]);
  return (
    <section className="flex flex-col gap-3">
      <form className="flex flex-wrap gap-2" action="/admin/log">
        <input name="action" defaultValue={sp.action ?? ""} className="input" placeholder="Action, e.g. review" aria-label="Action" />
        <input name="actor" defaultValue={sp.actor ?? ""} className="input" placeholder="Person" aria-label="Person" />
        <button className="btn">Apply</button>
      </form>
      {items.length ? (
        <div className="tbl-wrap card"><table className="qt min-w-[860px]"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>On</th><th>Before</th><th>After</th></tr></thead>
          <tbody>{items.map((e) => <tr key={e.id}><td className="whitespace-nowrap">{fmtDateTime(e.at)}</td><td>{e.actor_name}</td><td>{e.action}</td><td>{e.target_type} {e.target_id}</td><td className="note break-all">{brief(e.before)}</td><td className="note break-all">{brief(e.after)}</td></tr>)}</tbody></table></div>
      ) : <Empty>Nothing logged yet.</Empty>}
      <Pagination total={total.n} page={page} pageSize={SIZE} base="/admin/log" params={sp} />
    </section>
  );
}
