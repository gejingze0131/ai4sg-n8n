import type { Metadata } from "next";
import Link from "next/link";
import { viewer } from "@/auth/session";
import { flatten, type RawParams } from "@/lib/filters";
import { search } from "@/lib/queries/misc";
import { STAGE } from "@/lib/vocab";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const text = flatten(await searchParams).q?.trim() ?? "";
  const r = await search(text, await viewer(), 30);
  const none = text.length >= 2 && !r.projects.length && !r.tools.length && !r.sources.length;
  return (
    <div className="flex flex-col gap-5 max-w-[900px]">
      <h1 className="page-title">Search{text && <span className="text-muted font-normal"> · “{text}”</span>}</h1>
      <form action="/search" className="flex gap-2"><input type="search" name="q" defaultValue={text} className="input flex-1" aria-label="Search" placeholder="Project, tool, organisation, place, source title…" /><button className="btn btn-primary">Search</button></form>
      {none && <p className="na">Nothing found.</p>}
      {r.projects.length > 0 && <section><h2 className="font-semibold mb-1.5">Projects ({r.projects.length})</h2><div className="flex flex-col gap-1.5">{r.projects.map((p: any) => <Link key={p.code} href={`/projects/${p.code}`} className="card px-3.5 py-2.5 text-ink hover:border-accent hover:no-underline"><span className="orig font-medium">{p.name}</span><div className="note">{p.code} · {[...(p.countries ?? []), STAGE[p.stage], p.tool_name, p.analysed ? "" : "not analysed yet"].filter(Boolean).join(" · ")}</div></Link>)}</div></section>}
      {r.tools.length > 0 && <section><h2 className="font-semibold mb-1.5">Tools ({r.tools.length})</h2><div className="flex flex-col gap-1.5">{r.tools.map((t: any) => <Link key={t.code} href={`/tools/${t.code}`} className="card px-3.5 py-2.5 text-ink hover:border-accent hover:no-underline"><span className="orig font-medium">{t.name}</span><div className="note">{t.code} · {t.n_projects} deployment{t.n_projects === 1 ? "" : "s"}{t.developer ? ` · ${t.developer}` : ""}</div></Link>)}</div></section>}
      {r.sources.length > 0 && <section><h2 className="font-semibold mb-1.5">Sources ({r.sources.length})</h2><div className="flex flex-col gap-1.5">{r.sources.map((s: any) => <Link key={s.id} href={`/sources/${s.id}`} className="card px-3.5 py-2.5 text-ink hover:border-accent hover:no-underline"><span className="orig font-medium">{s.headline}</span><div className="note">S{s.id} · {[s.country, s.state === "analysed" ? "" : "not analysed"].filter(Boolean).join(" · ")}</div></Link>)}</div></section>}
    </div>
  );
}
