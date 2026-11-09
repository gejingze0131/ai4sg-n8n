import Link from "next/link";
import { isExpert } from "@/auth/roles";
import { viewer } from "@/auth/session";
import { FilterBar } from "@/components/FilterBar";
import { ProjectMapLazy } from "@/components/ProjectMapLazy";
import { TrendChart } from "@/components/TrendChart";
import { BarList } from "@/components/ui";
import { parseProjects, projectQuery, type ProjectFilters, type RawParams } from "@/lib/filters";
import { getBreakdown, getFacets, getPipelineStats, getStats } from "@/lib/queries/stats";
import { DOMAIN_COLOR, DOMAIN_TAGS, EVIDENCE, STAGE, TECH, fmtNum } from "@/lib/vocab";

const STEP_LABEL: Record<string, string> = { found: "Found by the searches", unique: "Unique", new: "New to the library", downloaded: "Downloaded", passed_screen: "Passed the screen", analysed: "Analysed in depth" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<RawParams> }) {
  const f = parseProjects(await searchParams);
  const [v, stats, facets, byDomain, byCountry, byTech, byStage, byEvidence, pipe] = await Promise.all([
    viewer(), getStats(f), getFacets(), getBreakdown(f, "domain"), getBreakdown(f, "country"), getBreakdown(f, "tech"), getBreakdown(f, "stage"), getBreakdown(f, "evidence"), getPipelineStats(f.domain),
  ]);
  const query = projectQuery(f);
  const toggle = (key: keyof ProjectFilters, value: string) => {
    const s = projectQuery({ ...f, [key]: f[key] === value ? undefined : value });
    return s ? `/?${s}` : "/";
  };
  const stage = new Map(byStage.map((e) => [e.key, e.n]));
  const evidence = new Map(byEvidence.map((e) => [e.key, e.n]));
  const tiles: [string, number, string, string?][] = [
    ["Sources analysed", stats.analysed_sources, `of ${fmtNum(stats.sources_total)} found`, `/sources${query ? `?${query}` : ""}`],
    ["Projects", stats.projects, `${fmtNum(stats.projects_pending)} more waiting for analysis`, `/projects${query ? `?${query}` : ""}`],
    ["AI tools", stats.tools, "used by these projects", "/tools"],
    ["Countries", stats.countries, `${stats.domains} domain${stats.domains === 1 ? "" : "s"}`],
    ["With outcome data", stats.with_outcomes, `${fmtNum(stats.with_cost)} with cost data`],
    ["Awaiting review", stats.awaiting_review, `${fmtNum(stats.passed)} passed · ${fmtNum(stats.failed)} failed`, isExpert(v) ? "/sources?review=awaiting" : undefined],
  ];
  const panel = (title: string, children: React.ReactNode, hint?: string) => (
    <section className="card p-4 min-w-0"><h2 className="text-[14px] font-semibold text-ink-2 mb-2.5">{title}{hint && <span className="font-normal text-muted"> · {hint}</span>}</h2>{children}</section>
  );
  const foundTotal = pipe.funnel[0]?.n || 1;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="page-title">AI deployments for social good</h1>
        <p className="sub max-w-[820px]">Who is using AI for health, public services, agriculture and education in South and Southeast Asia, and what the evidence says. Every figure traces back to a public source; experts review each one.</p>
      </div>
      <FilterBar facets={facets} fields={["domain", "q", "country", "tech", "stage", "evidence"]} />
      <section className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Key figures">
        {tiles.map(([label, value, detail, href]) => {
          const body = <><div className="text-ink-2 text-[14px]">{label}</div><div className="text-[30px] font-semibold tabular-nums leading-tight text-ink">{fmtNum(value) || 0}</div><div className="note">{detail}</div></>;
          return href ? <Link key={label} href={href} className="card px-4 py-3 hover:border-accent hover:no-underline">{body}</Link> : <div key={label} className="card px-4 py-3">{body}</div>;
        })}
      </section>
      <section className="card overflow-hidden" aria-label="Project map">
        <div className="px-4 py-2.5 border-b border-line flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-ink-2">Project map</h2>
          <span className="note">Size: people reached · Colour: domain · Follows the filters above</span>
        </div>
        <ProjectMapLazy query={query} />
      </section>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {panel("By domain", <BarList entries={byDomain.map((e) => ({ key: e.key, n: e.n, label: DOMAIN_TAGS[e.key] ?? e.key, color: DOMAIN_COLOR[e.key], href: toggle("domain", e.key), active: f.domain === e.key }))} />, "click to filter")}
        {panel("By country", <BarList entries={byCountry.map((e) => ({ key: e.key, n: e.n, label: e.key, href: toggle("country", e.key), active: f.country === e.key }))} />, "click to filter")}
        {panel("AI technology", <BarList entries={byTech.map((e) => ({ key: e.key, n: e.n, label: TECH[e.key] ?? e.key, href: toggle("tech", e.key), active: f.tech === e.key }))} />, "click to filter")}
        {panel("Deployment stage", <BarList entries={Object.keys(STAGE).filter((k) => stage.get(k)).map((k) => ({ key: k, n: stage.get(k)!, label: STAGE[k], href: toggle("stage", k), active: f.stage === k }))} />)}
        {panel("Strength of evidence", <BarList entries={EVIDENCE.filter(([k]) => evidence.get(k)).map(([k, label]) => ({ key: k, n: evidence.get(k)!, label, href: toggle("evidence", k), active: f.evidence === k }))} />, "best source of each project")}
        {panel("From search to analysis", <BarList entries={pipe.funnel.map((s) => ({ key: s.key, n: s.n, label: STEP_LABEL[s.key], hint: `${STEP_LABEL[s.key]}: ${s.n} (${Math.round((100 * s.n) / foundTotal)}% of found)` }))} />, `all runs${f.domain ? ` in ${DOMAIN_TAGS[f.domain] ?? f.domain}` : ""}`)}
      </div>
      {panel("Library over the runs", <><TrendChart points={pipe.series} /><p className="note mt-1">Cumulative, one point per run. The figures for each run are on the <Link href="/runs">Runs</Link> page.</p></>)}
    </div>
  );
}
