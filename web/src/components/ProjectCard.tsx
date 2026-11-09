import Link from "next/link";
import { STAGE, TECH, compact } from "@/lib/vocab";
import { Chip, DomainChips, EvidenceChip, Meter, ReviewChip } from "./ui";

export function ProjectCard({ p }: { p: any }) {
  return (
    <Link href={`/projects/${p.code}`} className="card p-4 flex flex-col gap-2 text-ink hover:border-accent hover:no-underline min-w-0">
      <div className="note uppercase tracking-wide text-[12px]">{p.code} · {p.n_analysed} of {p.n_sources} source{p.n_sources === 1 ? "" : "s"} analysed{p.tool_name ? ` · ${p.tool_name}` : ""}</div>
      <h3 className="text-[16px] font-semibold orig">{p.name}</h3>
      {p.summary && <p className="text-ink-2 text-[14px] line-clamp-3">{p.summary}</p>}
      <div className="chips mt-auto">
        <DomainChips tags={p.domain_tags} />
        {(p.countries ?? []).slice(0, 3).map((c: string) => <Chip key={c}>{c}</Chip>)}
        <Chip>{STAGE[p.stage] ?? p.stage}</Chip>
        <EvidenceChip type={p.evidence_type} />
        {p.tech && p.tech !== "unspecified" && <Chip>{TECH[p.tech] ?? p.tech}</Chip>}
        {p.reach_number != null && p.reach_is_people && <Chip>{compact(Number(p.reach_number))} reached</Chip>}
        <ReviewChip p={p} />
        {p.needs_attention && <span className="chip chip-flag">⚠ Check quotes</span>}
        {!p.analysed && <Chip>Not analysed yet</Chip>}
      </div>
      {p.analysed && <Meter label="Best source score" score={p.score} />}
    </Link>
  );
}
