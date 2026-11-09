import Link from "next/link";
import { notFound } from "next/navigation";
import { isExpert } from "@/auth/roles";
import { viewer } from "@/auth/session";
import { MergeForm } from "@/components/actions/ProjectActions";
import { Fact, groupTexts, Kv, Ladder, LinkS, Quotes, Sec, STag, STags, Tagged, type Quote } from "@/components/detail/parts";
import { LocationMap } from "@/components/detail/LocationMap";
import { Chip, DecisionChip, DomainChips, FlagChips, ReviewChip } from "@/components/ui";
import { getProject } from "@/lib/queries/projects";
import { AI_ROLE, DATA_SOURCE, DOMAIN_TAGS, EVIDENCE_LABEL, FLAGS, GOV_ROLE, LEVEL, LINK_METHOD, SOURCE_TYPE, STAGE, SUBJECT_DOMAIN, TECH, TIMELINE_STATUS, fmtDateTime, fmtNum, pretty } from "@/lib/vocab";

const EVORDER = ["none", "anecdotal", "pilot_report", "observational", "quasi_experimental", "rct"];

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) { return { title: (await params).code.toUpperCase() }; }

export default async function ProjectPage({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const v = await viewer();
  const data = await getProject(code, v);
  if (!data) notFound();
  const { project: P, sources, siblings } = data;
  const expert = isExpert(v);
  const sy = P.synthesis ?? {}, llm = sy.llm ?? {};
  const known = new Set<number>(sources.map((s: any) => Number(s.id)));
  const meta = Object.fromEntries((sy.sources ?? []).map((x: any) => [String(x.sid), x]));
  const dep = P.deployment ?? {};
  const list = [...sources].map((r: any) => ({ r, m: meta[String(r.id)] ?? {} }))
    .sort((a, b) => EVORDER.indexOf(b.m.evidence ?? "none") - EVORDER.indexOf(a.m.evidence ?? "none") || (b.r.score ?? 0) - (a.r.score ?? 0));
  const flags = Object.keys(sy.flags ?? {}).filter((f) => FLAGS[f] || f);
  const aliases = [...new Set([P.db_name, ...(P.aliases ?? []), ...(sy.names ?? [])])].filter((n) => n && n !== P.name);
  const tl = sy.timeline ?? {}, places: any[] = sy.places ?? [], u = sy.use ?? {}, reach: any[] = sy.reach ?? [], cost: any[] = sy.cost ?? [];
  const live = sources.filter((s: any) => s.state === "analysed");
  const outcomes = (sy.outcomes ?? []).filter((o: any) => o && (o.name || o.domain)).slice().sort((a: any, b: any) => String(a.domain ?? "").localeCompare(String(b.domain ?? "")) || a.sid - b.sid);
  const quotesBySid = new Map<number, Quote[]>();
  return (
    <article>
      <div className="note uppercase tracking-wide text-[12px]">Deployment (project)</div>
      <h1 className="page-title orig">{P.name}</h1>
      <div className="chips mt-2">
        <Chip>{P.code}</Chip>
        {P.tool_code && <Link href={`/tools/${P.tool_code}`} className="chip">Tool {P.tool_code} · {P.tool_name}</Link>}
        <Chip>{P.n_sources} source{P.n_sources === 1 ? "" : "s"}</Chip>
        {(P.countries ?? []).map((c: string) => <Chip key={c}>{c}</Chip>)}
        <Chip>{STAGE[P.stage] ?? P.stage}</Chip>
        {EVIDENCE_LABEL[P.evidence_type] && <Chip>Best evidence: {EVIDENCE_LABEL[P.evidence_type]}</Chip>}
        <DomainChips tags={P.domain_tags} />
        <ReviewChip p={P} />
      </div>
      {(dep.place || dep.phase || dep.org) && <div className="note mt-1.5">{[dep.org, dep.place, dep.phase].filter(Boolean).join(" · ")}</div>}
      {P.tool_code && <div className="note mt-1">Tool {P.tool_code} {P.tool_name}{P.tool_developer ? ` (${P.tool_developer})` : ""}: {siblings.length ? <>other deployments {siblings.map((q: any, i: number) => <span key={q.code}>{i > 0 && " · "}<Link href={`/projects/${q.code}`}>{q.code} · {q.name}</Link></span>)}</> : "no other deployment known"}</div>}
      {P.summary_pending && <div className="banner banner-warn">The project summary is being written (or the last run stopped before it). Its sources are listed below.</div>}
      {flags.length > 0 && <div className="chips mt-2"><FlagChips flags={flags} counts={sy.flags} /></div>}
      {aliases.length > 0 && <div className="note mt-1">Also called: {aliases.join(" · ")}</div>}

      {(llm.summary || llm.evidence) && (
        <Sec title={<>Project summary <span className="normal-case tracking-normal font-normal">· {llm.by === "single source" ? "from its only analysed source" : llm.by}</span></>}>
          {llm.summary && <p><LinkS text={llm.summary} known={known} /></p>}
          {llm.evidence && <p className="mt-1.5"><span className="font-semibold">What the evidence shows: </span><LinkS text={llm.evidence} known={known} /></p>}
          {(llm.agreements_conflicts ?? []).length > 0 && <><p className="lbl">Where the sources agree or disagree</p><ul className="plain">{llm.agreements_conflicts.map((g: string, i: number) => <li key={i}><LinkS text={g} known={known} /></li>)}</ul></>}
          {(llm.gaps ?? []).length > 0 && <><p className="lbl">What is missing</p><ul className="plain">{llm.gaps.map((g: string, i: number) => <li key={i}><LinkS text={g} known={known} /></li>)}</ul></>}
        </Sec>
      )}

      <Sec title={`Sources (${list.length})`}>
        <div className="tbl-wrap card">
          <table className="qt min-w-[720px]">
            <thead><tr><th /><th>Source</th><th>Type</th><th>Evidence</th><th title="text the AI read">Text</th><th className="num">Score</th><th>Review</th><th>Linked</th></tr></thead>
            <tbody>
              {list.map(({ r, m }: any) => (
                <tr key={r.id}>
                  <td><STag sid={r.id} /></td>
                  <td>
                    <Link href={`/sources/${r.id}`} className="orig">{r.headline}</Link>
                    <div className="note">
                      {[m.publisher || r.publisher, m.published || r.published].filter(Boolean).join(" · ")}
                      {(r.flags ?? []).length > 0 && <span className="ver ver-no ml-1" title={r.flags.map((f: string) => (FLAGS[f] ?? [f])[0]).join("; ")}>⚠ {r.flags.length}</span>}
                      {r.state === "judged_out" && <span className="ver ver-none ml-1">judged not AI4SG</span>}
                      {r.state === "extraction_failed" && <span className="ver ver-no ml-1">extraction failed</span>}
                      {r.state === "duplicate" && <span className="ver ver-none ml-1">duplicate of S{r.duplicate_of}: not analysed</span>}
                      {!["analysed", "judged_out", "extraction_failed", "duplicate"].includes(r.state) && <span className="ver ver-none ml-1" title={r.pick?.reason ?? ""}>not analysed yet{r.pick?.selected === false && r.pick?.reason ? `: ${r.pick.reason}` : ""}</span>}
                    </div>
                  </td>
                  <td>{SOURCE_TYPE[r.source_type] ?? r.source_type}</td>
                  <td>{EVIDENCE_LABEL[m.evidence ?? r.evidence_type] ?? "—"}</td>
                  <td>{(m.text_level ?? r.text_level) === "full" ? "Full text" : (m.text_level ?? r.text_level) === "abstract" ? <span className="ver ver-none">Abstract only</span> : r.text_chars ? `${fmtNum(r.text_chars)} chars` : "—"}</td>
                  <td className="num">{r.score ?? "—"}</td>
                  <td>{r.state === "analysed" && (r.review_decision ? <DecisionChip decision={r.review_decision} /> : expert ? <Link href={`/sources/${r.id}`}>review →</Link> : <span className="note">awaiting</span>)}</td>
                  <td><span title={r.project_reason ?? ""}>{LINK_METHOD[r.project_method] ?? r.project_method}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note mt-1.5">Experts review each source: open it to see its extraction, every quote checked against its text, the local copies, and the Pass / Fail buttons.</p>
      </Sec>

      {sy.version && P.analysed && (
        <>
          <Sec title="Who, what, when, where">
            <div className="facts">
              <Fact title="Organisations"><Kv pairs={[["Run by", sy.orgs], ["Partners", sy.partners], ["Funders", sy.funders], ["Government role", (sy.government_roles ?? []).map((g: string) => GOV_ROLE[g] ?? g)], ["For whom", sy.beneficiaries], ["Domain", (sy.domains ?? []).map((d: string) => SUBJECT_DOMAIN[d] ?? d)]]} /></Fact>
              <Fact title="AI technology"><div className="mid">{(sy.tech_categories ?? []).map((c: string) => TECH[c] ?? c).join(", ") || "Not specified"}</div>{(sy.products ?? []).length > 0 && <Kv pairs={[["Products", sy.products]]} />}<Tagged items={groupTexts(sy.tech)} known={known} /></Fact>
              <Fact title="Timeline">
                <div className="mid">{TIMELINE_STATUS[tl.status] ?? tl.status ?? "Unknown"} · {STAGE[sy.stage] ?? sy.stage ?? ""}</div>
                <Kv pairs={[["Earliest start", tl.start || "not stated"], ["Latest end", tl.end || (tl.status === "ongoing" ? "ongoing" : "not stated")]]} />
                {(tl.per_source ?? []).length > 0 && <Tagged known={known} items={tl.per_source.map((t: any) => ({ text: [t.start && `from ${t.start}`, t.end && `to ${t.end}`, TIMELINE_STATUS[t.status] ?? t.status, t.as_written && `“${t.as_written}”`].filter(Boolean).join(" · "), sid: t.sid }))} />}
              </Fact>
              <Fact title="Location" wide>
                {places.length || sy.scope === "national" ? (
                  <div className="grid gap-4 md:grid-cols-[minmax(220px,360px)_1fr] items-start">
                    <div><LocationMap countries={P.countries ?? []} places={places} scope={sy.scope} /></div>
                    <div className="tbl-wrap"><table className="qt"><thead><tr><th>Place</th><th>Level</th><th>Region</th><th /></tr></thead><tbody>{places.map((pl, i) => <tr key={i}><td>{pl.name}</td><td>{LEVEL[pl.level] ?? pl.level}</td><td>{pl.admin1}</td><td><STags list={pl.sids} known={known} /></td></tr>)}</tbody></table></div>
                  </div>
                ) : <div className="na">No place stated.</div>}
              </Fact>
            </div>
          </Sec>

          <Sec title="Use and implementation">
            <div className="facts">
              <Fact title="How it is used">
                <Kv pairs={[["Primary users", u.users], ["AI role", (u.ai_roles ?? []).map((a: string) => AI_ROLE[a] ?? a)], ["Channel / device", u.channels]]} />
                {(u.problems ?? []).length > 0 && <><p className="lbl">Problem</p><Tagged items={groupTexts(u.problems)} known={known} /></>}
                {(u.human_roles ?? []).length > 0 && <><p className="lbl">People around the AI</p><Tagged items={groupTexts(u.human_roles)} known={known} /></>}
              </Fact>
              {(sy.domain_fields ?? []).length > 0 && (
                <Fact title={`${DOMAIN_TAGS[P.domain_tags?.[0]] ?? "Domain"} fields`}>
                  <table className="qt"><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>{sy.domain_fields.map((d: any, i: number) => <tr key={i}><td>{pretty(d.field)}</td><td>{(d.values ?? []).length ? d.values.map((x: any, j: number) => <div key={j}>{pretty(x.value)}{x.verified === false && <span className="ver ver-no ml-1" title="quote not found">✗</span>}<STags list={x.sids ?? [x.sid]} known={known} /></div>) : <span className="na">not stated</span>}</td></tr>)}</tbody></table>
                </Fact>
              )}
              {((sy.requirements ?? []).length > 0 || (sy.barriers ?? []).length > 0 || (sy.facilitators ?? []).length > 0) && (
                <Fact title="Implementation">
                  {(sy.requirements ?? []).length > 0 && <><p className="lbl">Requirements</p><Tagged items={groupTexts(sy.requirements)} known={known} /></>}
                  <p className="lbl">Barriers</p><Tagged items={groupTexts(sy.barriers)} known={known} />
                  <p className="lbl">Facilitators</p><Tagged items={groupTexts(sy.facilitators)} known={known} />
                </Fact>
              )}
            </div>
          </Sec>

          <Sec title="Reach, cost and evidence">
            <div className="facts">
              <Fact title="Reach">
                {reach.length ? (
                  <>
                    <div className="big">{fmtNum(reach[0].number)}</div><div className="note">largest figure, {reach[0].unit} <STag sid={reach[0].sid} known={known} /></div>
                    {reach.length > 1 && <table className="qt mt-1.5"><tbody>{reach.map((x, i) => <tr key={i}><td className="num">{fmtNum(x.number)}</td><td>{x.unit}{x.is_target && <span className="ver ver-none ml-1">target</span>}</td><td><STag sid={x.sid} known={known} /></td></tr>)}</tbody></table>}
                  </>
                ) : <div className="na">No source states how many people it reached.</div>}
              </Fact>
              <Fact title="Cost">
                {cost.length ? <><table className="qt"><tbody>{cost.map((c, i) => <tr key={i}><td className="num">{c.currency} {fmtNum(c.amount) || c.amount_as_written}</td><td>{c.what_is_covered}{(c.breakdown ?? []).length > 0 && <span className="ver ver-none ml-1">{c.breakdown.length} items</span>}</td><td><STag sid={c.sid} known={known} /></td></tr>)}</tbody></table><div className="note mt-1">Breakdowns and their quotes are on each source's page.</div></> : <div className="na">No source gives a cost.</div>}
              </Fact>
              <Fact title="Strength of evidence" badge={<span className="ver ver-none">strongest of the sources</span>}>
                <div className="mid">{EVIDENCE_LABEL[P.evidence_type] ?? "Unknown"} {sy.evidence_best?.sid && <STag sid={sy.evidence_best.sid} known={known} />}</div>
                <Ladder type={P.evidence_type} />
                {(sy.evidence ?? []).length > 1 && <div className="note mt-1">{sy.evidence.map((e: any, i: number) => <span key={i}>{i > 0 && " · "}{EVIDENCE_LABEL[e.type] ?? e.type} <STag sid={e.sid} known={known} /></span>)}</div>}
              </Fact>
            </div>
          </Sec>

          {outcomes.length > 0 && (
            <Sec title={`Outcomes from all sources (${outcomes.length})`}>
              <div className="tbl-wrap card">
                <table className="qt min-w-[820px]">
                  <thead><tr><th>Category</th><th>Outcome</th><th className="num">Result</th><th>Compared with</th><th>When</th><th>Data</th><th>Source</th><th>Quote</th></tr></thead>
                  <tbody>
                    {outcomes.map((o: any, i: number) => (
                      <tr key={i}>
                        <td>{o.domain}</td>
                        <td><b>{o.name}</b>{o.interpretation && <div className="text-muted text-[14px]">{o.interpretation}</div>}<details><summary className="!text-[13px]">Details</summary><Kv pairs={[["Measured by", o.measure], ["Population", o.population], ["Uncertainty", o.uncertainty], ["Notes", o.notes]]} /><Quotes qs={quotesBySid.get(o.sid) ?? []} lang="" /></details></td>
                        <td className="num">{o.value !== null && o.value !== undefined && o.value !== "" ? <>{fmtNum(o.value) || String(o.value)} <span className="text-muted">{o.unit}</span></> : <span className="na">in words</span>}</td>
                        <td>{o.comparison}</td><td>{o.timing}</td>
                        <td>{o.data_source === "developer_or_government_claim" ? <span className="ver ver-no" title="Not independently verified">Claim</span> : DATA_SOURCE[o.data_source] ?? o.data_source}</td>
                        <td><STag sid={o.sid} known={known} /></td>
                        <td>{o.verified === false ? <span className="ver ver-no">✗</span> : o.verified ? <span className="ver ver-ok">✓</span> : <span className="ver ver-none">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="note mt-1.5">Every row is one result one source reports; the same measure from two sources appears twice, each with its own source, so differences stay visible. Quotes are on each source's page.</p>
            </Sec>
          )}
        </>
      )}

      {P.old_review_decision && <div className="banner mt-4">Earlier project-level decision: {P.old_review_decision === "approved" ? "✓ Passed" : "✗ Failed"}{P.old_reviewer ? ` by ${P.old_reviewer}` : ""}{P.old_reviewed_at ? ` · ${fmtDateTime(P.old_reviewed_at)}` : ""}{P.old_review_comment ? ` · “${P.old_review_comment}”` : ""}</div>}
      {expert && (
        <>
          <Sec title="Project record">
            <div className="facts"><Fact title="Merge"><div className="note">If this is the same project as another one, move all its sources there; its name is kept as an alias.</div><MergeForm code={P.code} /></Fact></div>
          </Sec>
          <div className="sec"><details><summary>Raw project record (for debugging)</summary><pre className="raw">{JSON.stringify(sy, null, 2)}</pre></details></div>
        </>
      )}
      {expert && live.length > 0 && <p className="note mt-4">{live.length - P.n_waiting} of {live.length} analysed source{live.length > 1 ? "s" : ""} reviewed. Pass or fail each source on its own page.</p>}
    </article>
  );
}
