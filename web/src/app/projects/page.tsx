import type { Metadata } from "next";
import { isExpert } from "@/auth/roles";
import { viewer } from "@/auth/session";
import { FilterBar } from "@/components/FilterBar";
import { ProjectCard } from "@/components/ProjectCard";
import { Empty, Pagination } from "@/components/ui";
import { flatten, parseProjects, type RawParams } from "@/lib/filters";
import { listProjects } from "@/lib/queries/projects";
import { getFacets } from "@/lib/queries/stats";
import { fmtNum } from "@/lib/vocab";

export const metadata: Metadata = { title: "Projects" };
const SORTS: [string, string][] = [["new", "Recently updated"], ["old", "Oldest first"], ["score_hi", "Highest relevance score"], ["score_lo", "Lowest relevance score"], ["evidence", "Strongest evidence"], ["reach", "Largest reach"], ["country", "Country"], ["name", "Name A–Z"]];

export default async function Projects({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = await searchParams;
  const f = parseProjects(sp);
  const v = await viewer();
  const [{ total, page, pageSize, items }, facets] = await Promise.all([listProjects(f, v), getFacets()]);
  return (
    <div className="flex flex-col gap-4">
      <div><h1 className="page-title">Projects</h1><p className="sub">One project is one deployment of an AI tool, with everything its sources say about it.</p></div>
      <FilterBar facets={facets} sorts={SORTS} fields={["domain", "q", "country", "tech", "stage", "evidence", "review", "source_type", "run", "has_outcomes", "has_cost", ...(isExpert(v) ? ["include_pending" as const] : [])]} />
      <div className="note">{fmtNum(total)} project{total === 1 ? "" : "s"}</div>
      {items.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((p) => <ProjectCard key={p.code} p={p} />)}</div> : <Empty>Nothing matches these filters.</Empty>}
      <Pagination total={total} page={page} pageSize={pageSize} base="/projects" params={flatten(sp)} />
    </div>
  );
}
