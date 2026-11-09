import Link from "next/link";
import { notFound } from "next/navigation";
import { viewer } from "@/auth/session";
import { Chip, DomainChips, EvidenceChip, ReviewChip } from "@/components/ui";
import { getTool } from "@/lib/queries/misc";
import { STAGE, fmtNum } from "@/lib/vocab";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) { return { title: (await params).code.toUpperCase() }; }

export default async function ToolPage({ params }: { params: Promise<{ code: string }> }) {
  const data = await getTool((await params).code.toUpperCase(), await viewer());
  if (!data) notFound();
  const { tool: t, deployments } = data;
  return (
    <article className="flex flex-col gap-4">
      <div>
        <div className="note uppercase tracking-wide text-[12px]">Tool {t.code}</div>
        <h1 className="page-title orig">{t.name}</h1>
        {t.developer && <p className="sub">Developed by {t.developer}</p>}
        {(t.aliases ?? []).length > 0 && <p className="note">Also called: {t.aliases.join(" · ")}</p>}
        <div className="chips mt-2"><DomainChips tags={t.domain_tags} />{(t.countries ?? []).map((c: string) => <Chip key={c}>{c}</Chip>)}</div>
      </div>
      <h2 className="text-[17px] font-semibold">Deployments ({deployments.length})</h2>
      <div className="flex flex-col gap-2">
        {deployments.map((d) => (
          <Link key={d.code} href={`/projects/${d.code}`} className="card p-4 text-ink hover:border-accent hover:no-underline">
            <div className="note uppercase tracking-wide text-[12px]">{d.code} · {d.n_analysed} of {d.n_sources} source{d.n_sources === 1 ? "" : "s"} analysed</div>
            <h3 className="font-semibold text-[16px] orig">{d.name}</h3>
            {d.summary && <p className="text-ink-2 text-[14px] line-clamp-2 mt-0.5">{d.summary}</p>}
            <div className="chips mt-1.5">
              <DomainChips tags={d.domain_tags} />{(d.countries ?? []).map((c: string) => <Chip key={c}>{c}</Chip>)}<Chip>{STAGE[d.stage] ?? d.stage}</Chip><EvidenceChip type={d.evidence_type} />
              {d.reach_number != null && <Chip>Reach {fmtNum(d.reach_number)}</Chip>}<ReviewChip p={d} />{!d.analysed && <Chip>Not analysed yet</Chip>}
            </div>
          </Link>
        ))}
      </div>
    </article>
  );
}
