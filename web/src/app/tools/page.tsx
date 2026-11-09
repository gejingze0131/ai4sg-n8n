import type { Metadata } from "next";
import Link from "next/link";
import { viewer } from "@/auth/session";
import { Chip, DomainChips, Empty, Pagination } from "@/components/ui";
import { flatten, type RawParams } from "@/lib/filters";
import { listTools } from "@/lib/queries/misc";
import { fmtNum } from "@/lib/vocab";

export const metadata: Metadata = { title: "Tools" };

export default async function Tools({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = flatten(await searchParams);
  const v = await viewer();
  const { total, page, pageSize, items } = await listTools({ q: sp.q?.trim() || undefined, page: Math.max(1, Number(sp.page) || 1), sort: sp.sort }, v);
  return (
    <div className="flex flex-col gap-4">
      <div><h1 className="page-title">Tools</h1><p className="sub">An AI tool (an app, a model, a platform) can be deployed several times. Each deployment is a project.</p></div>
      <form className="flex gap-2 flex-wrap" action="/tools">
        <input type="search" name="q" defaultValue={sp.q ?? ""} className="input flex-1 min-w-[220px]" placeholder="Search tool, developer, alias…" aria-label="Search tools" />
        <select name="sort" defaultValue={sp.sort ?? ""} className="select" aria-label="Sort"><option value="">Most deployments first</option><option value="name">Name A–Z</option></select>
        <button className="btn">Search</button>
      </form>
      <div className="note">{fmtNum(total)} tool{total === 1 ? "" : "s"}</div>
      {items.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((t) => (
            <Link key={t.code} href={`/tools/${t.code}`} className="card p-4 text-ink hover:border-accent hover:no-underline flex flex-col gap-1.5">
              <div className="note uppercase tracking-wide text-[12px]">{t.code} · {t.n_analysed_projects} analysed of {t.n_projects} deployment{t.n_projects === 1 ? "" : "s"}</div>
              <h3 className="text-[16px] font-semibold orig">{t.name}</h3>
              {t.developer && <div className="text-ink-2 text-[14px]">{t.developer}</div>}
              <div className="chips mt-auto"><DomainChips tags={t.domain_tags} />{(t.countries ?? []).slice(0, 4).map((c: string) => <Chip key={c}>{c}</Chip>)}</div>
            </Link>
          ))}
        </div>
      ) : <Empty>No tool matches.</Empty>}
      <Pagination total={total} page={page} pageSize={pageSize} base="/tools" params={sp} />
    </div>
  );
}
