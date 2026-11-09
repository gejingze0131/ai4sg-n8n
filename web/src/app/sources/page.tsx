import type { Metadata } from "next";
import Link from "next/link";
import { isExpert } from "@/auth/roles";
import { viewer } from "@/auth/session";
import { FilterBar } from "@/components/FilterBar";
import { Chip, DecisionChip, DomainChips, Empty, EvidenceChip, Meter, Pagination } from "@/components/ui";
import { flatten, parseSources, type RawParams } from "@/lib/filters";
import { listSources } from "@/lib/queries/sources";
import { getFacets } from "@/lib/queries/stats";
import { SOURCE_TYPE, STAGE, fmtNum, langName } from "@/lib/vocab";

export const metadata: Metadata = { title: "Sources" };
const SORTS: [string, string][] = [["default", "Newest first"], ["score", "Highest relevance score"], ["country", "Country"], ["domain", "Domain"], ["type", "Source type"]];

export default async function Sources({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = await searchParams;
  const f = { ...parseSources(sp), status: "analysed" as const };
  const [v, { total, page, pageSize, items }, facets] = await Promise.all([viewer(), listSources(f), getFacets()]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div><h1 className="page-title">Sources</h1><p className="sub">Reports, articles and papers analysed in depth, each with its quotes checked against the text.</p></div>
        {isExpert(v) && <Link className="btn" href="/queue">Not analysed yet →</Link>}
      </div>
      <FilterBar facets={facets} sorts={SORTS} searchPlaceholder="Search title, project, country, DOI…" fields={["domain", "q", "country", "tech", "stage", "evidence", "review", "source_type", "run", "has_outcomes", "has_cost"]} />
      <div className="note">{fmtNum(total)} source{total === 1 ? "" : "s"}</div>
      {items.length ? (
        <div className="flex flex-col gap-2">
          {items.map((r) => (
            <Link key={r.id} href={`/sources/${r.id}`} className="card p-3.5 text-ink hover:border-accent hover:no-underline">
              <div className="note uppercase tracking-wide text-[12px]">S{r.id}{r.project_code ? ` · ${r.project_code}` : ""}{r.project_name ? ` · ${r.project_name}` : ""}</div>
              <h3 className="font-semibold text-[15.5px] orig">{r.headline}</h3>
              {r.title_original && r.language !== "en" && <div className="orig text-ink-2 text-[14px]" lang={r.language}>{r.title_original}</div>}
              <div className="chips mt-1.5">
                <DomainChips tags={r.domain_tags} />
                {[r.country, langName(r.language), SOURCE_TYPE[r.source_type] ?? r.source_type, STAGE[r.stage]].filter(Boolean).map((x) => <Chip key={x}>{x}</Chip>)}
                <EvidenceChip type={r.evidence_type} />
                <DecisionChip decision={r.review_decision} />
                {(r.flags ?? []).length > 0 && <span className="chip chip-flag">⚠ {r.flags.length} flag{r.flags.length > 1 ? "s" : ""}</span>}
              </div>
              <div className="mt-1.5"><Meter label="Relevance score" score={r.score} /></div>
            </Link>
          ))}
        </div>
      ) : <Empty>Nothing matches these filters.</Empty>}
      <Pagination total={total} page={page} pageSize={pageSize} base="/sources" params={flatten(sp)} />
    </div>
  );
}
