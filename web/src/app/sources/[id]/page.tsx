import Link from "next/link";
import { notFound } from "next/navigation";
import { isExpert } from "@/auth/roles";
import { viewer } from "@/auth/session";
import { SourceProjectActions } from "@/components/actions/ProjectActions";
import { ReviewBar } from "@/components/actions/ReviewBar";
import { Fact, FactCard, Kv, Ladder, Quotes, Sec, Tick, type Quote } from "@/components/detail/parts";
import { LocationMap } from "@/components/detail/LocationMap";
import { Chip, DecisionChip, DomainChips, FlagChips } from "@/components/ui";
import { getSource } from "@/lib/queries/sources";
import { AI_ROLE, COST_CATEGORY, DATABASE, DATA_SOURCE, DOMAIN_TAGS, EVIDENCE_LABEL, FILE_KIND, GOV_ROLE, LEVEL, RELATION, SCOPE, SOURCE_TYPE, STAGE, SUBJECT_DOMAIN, TECH, TIMELINE_STATUS, fmtNum, langName, pretty } from "@/lib/vocab";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return { title: `Source S${(await params).id}` }; }

const short = (u: string) => String(u).replace(/^https?:\/\//, "").slice(0, 60);

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const v = await viewer();
  const data = await getSource(id, v);
  if (!data) notFound();
  const { source: r, others, project: P, dup } = data;
  const expert = isExpert(v);
  const f = r.fields ?? {}, p = f.project ?? {}, t = f.technology ?? (p.ai_technique ? { specific: p.ai_technique, category: "" } : {}), tl = f.timeline ?? {}, loc = f.location ?? (p.location ? { places: [], as_text: p.location } : {});
  const c = f.cost ?? {}, b = f.benefit ?? {}, re = f.reach ?? {}, ev = f.evidence_strength ?? {}, u = f.use ?? {}, im = f.implementation ?? {};
  const it = typeof f.interpretation === "object" && f.interpretation ? f.interpretation : { overall: f.interpretation };
  const evidence: Quote[] = Array.isArray(f.evidence) ? f.evidence : [];
  const outcomes: any[] = (Array.isArray(f.outcomes) ? f.outcomes : []).filter((o: any) => o && (o.name || o.domain));
  const risks: string[] = Array.isArray(f.risks_limitations) ? f.risks_limitations : [];
  const dfields: any[] = (Array.isArray(f.domain_fields) ? f.domain_fields : []).filter((d: any) => d?.field);
  const qById = Object.fromEntries(evidence.map((e) => [e.id, e]));
  const lang: string = r.language ?? "";
  const screen = f.screen ?? r.screen ?? null;
  const pick = r.pick ?? null;
  const flags: string[] = r.flags ?? [];
  const full = r.state === "analysed";
  const rel = f.relevance ?? null;
  const places: any[] = loc.places ?? [];
  const files: any[] = Array.isArray(r.files) ? r.files : [];
  const got = files.filter((x) => x.name), other = files.filter((x) => !x.name);
  const brk: any[] = Array.isArray(c.breakdown) ? c.breakdown : [];
  const cur = [...new Set(brk.map((x) => x.currency || c.currency).filter(Boolean))];
  const maxCost = Math.max(1, ...brk.map((x) => Number(x.amount) || 0));
  const dlError = files.find((x) => x.error)?.error;
  const req: string[] = im.requirements ?? [], bar: string[] = im.barriers ?? [], fac: string[] = im.facilitators ?? [];
  const anyUse = ["problem", "primary_user", "ai_role", "human_role", "channel"].some((k) => u[k]);
  const Card = (a: { title: React.ReactNode; name: string; block: any; wide?: boolean; children: React.ReactNode }) => <FactCard evidence={evidence} lang={lang} {...a} />;

  return (
    <article className="max-w-[1100px] mx-auto">
      {P && <Link href={`/projects/${P.code}`} className="text-[14px]">← {P.code} · {P.name}</Link>}
      <div className="note uppercase tracking-wide text-[12px] mt-1.5">Source S{r.id}{P ? " of this deployment" : ""}{P?.tool_code ? ` · tool ${P.tool_code} ${P.tool_name}` : ""}</div>
      <h1 className="page-title orig">{r.headline}</h1>
      <div className="chips mt-2">
        <DomainChips tags={r.domain_tags} />
        {[r.run_domain ? `Found by ${r.run_domain === "agriculture" || r.run_domain === "education" ? "an" : "a"} ${DOMAIN_TAGS[r.run_domain] ?? r.run_domain} run` : "", r.country, langName(lang), SOURCE_TYPE[r.source_type] ?? r.source_type, full ? STAGE[r.stage] : "", SUBJECT_DOMAIN[p.domain], r.search_engine === "codex" ? "Found by Codex agent" : r.search_engine ? "Found by single API call" : "", r.database && r.database !== "web" ? DATABASE[r.database] ?? r.database : "", r.cascaded ? "Cascade" : ""].filter(Boolean).map((x) => <Chip key={x}>{x}</Chip>)}
        <DecisionChip decision={r.review_decision} />
      </div>
      {r.state === "duplicate" && <div className="banner banner-warn">Duplicate: the same document as {dup ? <Link href={`/sources/${dup.id}`}>S{dup.id} · {dup.headline}</Link> : `S${r.duplicate_of}`}, so it is not analysed{pick?.group_reason ? `: ${pick.group_reason}` : ""}.</div>}
      {pick?.group_reason && r.state !== "duplicate" && r.project_code && <div className="note mt-1.5">Placed in {r.project_code} by the organiser: {pick.group_reason}</div>}
      {r.state === "extraction_failed" && <div className="banner banner-bad">The AI could not produce a structured result for this source. Open the source to review it manually.</div>}
      {pick?.reason && <div className="banner">{pick.selected ? `Chosen for the in-depth analysis${pick.rank ? ` (#${pick.rank})` : ""}` : "Not chosen for the analysis yet"}: {pick.reason} <span className="ver ver-none">{pick.method}</span></div>}
      {r.state === "queued" && <div className="banner banner-warn">Queued: passed the AI screen{screen?.relevance != null ? ` (relevance ${Math.round(100 * screen.relevance)}%)` : ""} and waits for the in-depth analysis{screen?.reason ? `. Screen: ${screen.reason}` : ""}. <Link href="/queue">Send it to the analysis</Link>.</div>}
      {r.state === "download_failed" && <div className="banner banner-bad">The source could not be downloaded ({dlError ?? "no readable text"}), so it was not screened. Open it to check it by hand.</div>}
      {(r.state === "filtered" || r.state === "judged_out") && <div className="banner banner-warn">Filtered out{r.state === "filtered" ? " by the AI screen" : " by the in-depth analysis"}{screen ? ` (AI4SG: ${screen.is_ai4sg ? "yes" : "no"}, screen relevance ${Math.round(100 * (screen.relevance ?? 0))}%)` : ""}. Shown only for spot-checks. {screen?.reason}</div>}
      {flags.length > 0 && <div className="chips mt-2"><FlagChips flags={flags} /></div>}
      <div className="card p-3.5 mt-3">
        <div className="orig text-[17px]" lang={lang}>{r.title_original || "—"}</div>
        {r.title_en && r.title_en !== r.title_original && <div className="text-ink-2 mt-0.5">English: {r.title_en}</div>}
        <div className="text-ink-2 mt-0.5 text-[14px]">{[r.publisher, r.published].filter(Boolean).join(" · ")}{(r.publisher || r.published) && " · "}<a href={r.url} target="_blank" rel="noopener noreferrer">Open source ↗</a></div>
      </div>
      {(r.summary || (screen?.reason && !full)) && <p className="mt-3">{r.summary || `Screen: ${screen.reason}`}</p>}

      {full && (
        <>
          <Sec title="Relevance">
            {r.score == null || !rel ? <div className="fact"><div className="fact-h"><b>Relevance score</b></div><div className="na">Not scored: this result was produced before the score existed.</div></div> : (
              <Fact title="Relevance score" badge={<span className="ver ver-none">Computed by rules, not by the AI</span>}>
                <div className="score"><div className="n">{r.score}<small> / 100</small></div><ul className="crit">{(rel.criteria ?? []).map((x: any, i: number) => <li key={i}><span className={x.met ? "y" : "x"}>{x.met ? "✓" : "✗"}</span><span>{x.label}</span><span className={x.met ? "" : "x"}>{x.points}</span></li>)}</ul></div>
                <div className="note mt-1.5">Five criteria, 20 points each. A criterion counts only when its fields are filled and at least one of its quotes is found word for word in the source. Quotes found in the source: {rel.quotes_found ?? "—"} of {rel.quotes_total ?? "—"}.</div>
              </Fact>
            )}
          </Sec>
          <Sec title="What, when, where">
            <div className="facts">
              <Card title="AI technology" name="technology" block={t}>{t.specific || t.category ? <><div className="mid">{TECH[t.category] ?? t.category ?? "Not specified"}</div><Kv pairs={[["What it does", t.specific], ["Model / product", t.model_or_product], ["Data used", t.data_used]]} /></> : <div className="na">The source does not say what the AI does.</div>}</Card>
              <Card title="Timeline" name="timeline" block={tl}>{tl.start_date || tl.end_date || (tl.status && tl.status !== "unknown") ? <><div className="mid">{TIMELINE_STATUS[tl.status] ?? tl.status ?? "Unknown"}</div><Kv pairs={[["Start", tl.start_date || "not stated"], ["End", tl.end_date || (tl.status === "ongoing" ? "ongoing" : "not stated")], ["As written", tl.as_written]]} /></> : <div className="na">No dates stated.</div>}</Card>
              <Card title="Location" name="location" block={loc} wide={places.length > 0 || loc.scope === "national"}>
                {places.length > 0 || loc.scope === "national" ? (
                  <>
                    {SCOPE[loc.scope] && <div className="mid">{SCOPE[loc.scope]}{r.country ? ` · ${r.country}` : ""}</div>}
                    <div className="grid gap-4 md:grid-cols-[minmax(220px,360px)_1fr] items-start mt-2">
                      <div><LocationMap countries={[r.country, ...(p.countries ?? [])].filter(Boolean)} places={places} scope={loc.scope} /></div>
                      {places.length > 0 ? <div className="tbl-wrap"><table className="qt"><thead><tr><th>Place</th><th>Level</th><th>In region</th></tr></thead><tbody>{places.map((pl, i) => <tr key={i}><td>{pl.name}{pl.name_original && pl.name_original !== pl.name && <span className="orig text-muted ml-1" lang={lang}>{pl.name_original}</span>}</td><td>{LEVEL[pl.level] ?? pl.level}</td><td>{pl.admin1}</td></tr>)}</tbody></table></div> : <div className="na">{loc.as_text || "No location stated."}</div>}
                    </div>
                  </>
                ) : <div className="na">{loc.as_text || "No location stated."}</div>}
              </Card>
            </div>
          </Sec>
          {(anyUse || dfields.length > 0 || req.length > 0 || bar.length > 0 || fac.length > 0) && (
            <Sec title="Use and implementation">
              <div className="facts">
                {anyUse && <Card title="How it is used" name="use" block={u}><Kv pairs={[["Problem", u.problem], ["Primary user", u.primary_user], ["AI role", AI_ROLE[u.ai_role] ?? u.ai_role], ["People around the AI", u.human_role], ["Channel / device", u.channel]]} /></Card>}
                {dfields.length > 0 && (
                  <Fact title={`${DOMAIN_TAGS[r.run_domain] ?? "Domain"} fields`} badge={<span className="ver ver-none">from the domain module</span>}>
                    <table className="qt"><thead><tr><th>Field</th><th>Value</th><th>Quote</th></tr></thead><tbody>{dfields.map((d, i) => <tr key={i}><td>{pretty(d.field)}</td><td>{d.value ? pretty(d.value) : <span className="na">not stated</span>}</td><td>{d.value ? <Tick q={qById[d.evidence_ref]} /> : null}</td></tr>)}</tbody></table>
                    <Quotes qs={evidence.filter((e) => dfields.some((d) => d.evidence_ref === e.id))} lang={lang} />
                  </Fact>
                )}
                {(req.length > 0 || bar.length > 0 || fac.length > 0) && <Card title="Implementation" name="implementation" block={im}>
                  {req.length > 0 && <><p className="lbl">Requirements</p><ul className="plain">{req.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
                  {bar.length > 0 && <><p className="lbl">Barriers</p><ul className="plain">{bar.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
                  {fac.length > 0 && <><p className="lbl">Facilitators</p><ul className="plain">{fac.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
                </Card>}
              </div>
            </Sec>
          )}
          <Sec title="Cost">
            <div className="facts">
              <Card title="Cost" name="cost" block={c} wide>
                {!c.stated && !brk.length ? <div className="na">No cost figure in the source.</div> : (
                  <>
                    {c.amount != null && c.amount !== "" && <div className="big">{c.currency} {fmtNum(c.amount)}</div>}
                    <Kv pairs={[["As written", c.amount_as_written], ["Covers", c.what_is_covered], ["Paid by", c.funding_source], ["Per beneficiary", c.cost_per_beneficiary != null ? `${c.currency ?? ""} ${fmtNum(c.cost_per_beneficiary)}` : ""]]} />
                    {brk.length ? (
                      <div className="tbl-wrap"><table className="qt mt-2.5"><thead><tr><th>Item</th><th>Category</th><th className="num">Amount</th>{cur.length === 1 && <th className="w-[22%]" />}<th>As written</th><th>Period</th><th>Quote</th></tr></thead>
                        <tbody>{brk.map((x, i) => <tr key={i}><td>{x.item}</td><td>{COST_CATEGORY[x.category] ?? x.category}</td><td className="num">{x.currency || c.currency} {fmtNum(x.amount)}</td>{cur.length === 1 && <td><div className="cbar" style={{ width: `${(100 * (Number(x.amount) || 0)) / maxCost}%` }} title={`${x.item}: ${fmtNum(x.amount)}`} /></td>}<td className="orig" lang={lang}>{x.amount_as_written}</td><td>{x.period}</td><td><Tick q={qById[x.evidence_ref]} /></td></tr>)}</tbody></table>{cur.length > 1 && <div className="note">Several currencies: amounts are shown as the source gives them, not converted.</div>}</div>
                    ) : <div className="note mt-1">The source gives no breakdown of this figure.</div>}
                  </>
                )}
              </Card>
            </div>
          </Sec>
          <Sec title="Results">
            <div className="facts">
              <Card title="Benefit" name="benefit" block={b}>{b.stated ? <><div className="mid">{b.magnitude || b.outcome}</div><Kv pairs={[["Outcome", b.outcome], ["Measured by", b.metric], ["Compared with", b.comparison]]} /></> : <><div className="na">No outcome for people stated.</div>{(b.outputs_reported ?? []).length > 0 && <Kv pairs={[["Outputs only", b.outputs_reported]]} />}</>}</Card>
              <Card title="Reach" name="reach" block={re}>{re.stated || re.number ? <><div className="big">{fmtNum(re.number)}</div><Kv pairs={[["Unit", re.unit], ["Type", re.is_target ? "Target (not yet reached)" : "Achieved"]]} /></> : <div className="na">Not stated.</div>}</Card>
              <Fact title="Strength of evidence"><div className="mid">{EVIDENCE_LABEL[ev.type ?? "none"] ?? "Unknown"}</div><Ladder type={ev.type ?? "none"} />{ev.rationale && <div className="text-[14.5px] mt-1.5">{ev.rationale}</div>}</Fact>
            </div>
          </Sec>
          {outcomes.length > 0 && (
            <Sec title={`Outcomes (${outcomes.length})`}>
              <div className="tbl-wrap card">
                <table className="qt min-w-[760px]"><thead><tr><th>Category</th><th>Outcome</th><th className="num">Result</th><th>Compared with</th><th>When</th><th>Data</th><th>Quote</th></tr></thead>
                  <tbody>{outcomes.map((o, i) => <tr key={i}><td>{o.domain}</td>
                    <td><b>{o.name}</b>{o.interpretation && <div className="text-muted text-[14px]">{o.interpretation}</div>}<details><summary className="!text-[13px]">Details</summary><Kv pairs={[["Measured by", o.measure], ["Population", o.population], ["Uncertainty", o.uncertainty], ["Notes", o.notes]]} /><Quotes qs={evidence.filter((e) => e.id === o.evidence_ref)} lang={lang} /></details></td>
                    <td className="num">{o.value !== null && o.value !== undefined && o.value !== "" ? <>{fmtNum(o.value) || String(o.value)} <span className="text-muted">{o.unit}</span></> : <span className="na">in words</span>}</td>
                    <td>{o.comparison}</td><td>{o.timing}</td>
                    <td>{o.data_source === "developer_or_government_claim" ? <span className="ver ver-no" title="Not independently verified">Claim</span> : DATA_SOURCE[o.data_source] ?? o.data_source}</td>
                    <td>{o.verified === false ? <span className="ver ver-no">✗</span> : o.verified ? <span className="ver ver-ok">✓</span> : <span className="ver ver-none">—</span>}</td></tr>)}</tbody></table>
              </div>
              <p className="note mt-1.5">One row per result the source reports. "Claim": the figure comes only from the developer or a government announcement.</p>
            </Sec>
          )}
          <Sec title="Project">
            <div className="facts"><Card title={p.name || "Project"} name="project" block={p}><Kv pairs={[["Run by", p.implementing_org], ["Partners", p.partners], ["Funders", p.funders], ["Countries", p.countries], ["Domain", SUBJECT_DOMAIN[p.domain] ?? p.domain], ["Stage", STAGE[p.deployment_stage] ?? p.deployment_stage], ["Government role", GOV_ROLE[p.government_role] ?? p.government_role], ["For whom", p.target_beneficiaries]]} /></Card></div>
          </Sec>
        </>
      )}

      {(it.overall || it.cost_benefit || it.credibility || (it.gaps ?? []).length > 0) && (
        <Sec title="Interpretation">
          {it.overall && <p>{it.overall}</p>}
          {it.cost_benefit && <p className="mt-1.5"><span className="font-semibold">Cost–benefit: </span>{it.cost_benefit}</p>}
          {it.credibility && <p className="mt-1.5"><span className="font-semibold">Credibility: </span>{it.credibility}</p>}
          {(it.gaps ?? []).length > 0 && <><p className="lbl">What is missing</p><ul className="plain">{it.gaps.map((g: string, i: number) => <li key={i}>{g}</li>)}</ul></>}
        </Sec>
      )}
      {risks.length > 0 && bar.length === 0 && <Sec title="Risks & limitations mentioned"><ul className="plain">{risks.map((x, i) => <li key={i}>{x}</li>)}</ul></Sec>}
      {evidence.length > 0 && (
        <Sec title={`All quotes (${evidence.length})`}>
          <div className="tbl-wrap card"><table className="qt"><thead><tr><th /><th>Original · {langName(lang)}</th><th>English</th><th>Used for</th></tr></thead>
            <tbody>{evidence.map((q, i) => <tr key={i}><td>{q.found === false ? <span className="ver ver-no">✗</span> : q.found ? <span className="ver ver-ok">✓</span> : null}</td><td className="orig" lang={lang}>{q.quote_original}</td><td>{q.quote_en}</td><td>{q.field}</td></tr>)}</tbody></table></div>
        </Sec>
      )}

      <Sec title="Source and project">
        <div className="facts">
          <Fact title="Project">
            {r.project_code ? (
              <>
                <div className="mid">{P?.analysed || expert ? <Link href={`/projects/${r.project_code}`}>{r.project_code} · {r.project_name}</Link> : `${r.project_code} · ${r.project_name}`}</div>
                <div className="note">{r.project_method === "new" ? "New project created for this source." : r.project_method === "manual" ? "Set by a reviewer." : "Matched to a known project."} {r.project_reason}</div>
                {others.length > 0 && <><p className="lbl">Other sources about this project</p><ul className="plain">{others.map((x: any) => <li key={x.id}><Link href={`/sources/${x.id}`} className="orig">{x.headline}</Link></li>)}</ul></>}
                {expert && <SourceProjectActions sourceId={Number(r.id)} />}
              </>
            ) : <div className="na">{r.extraction_id ? "Not linked to a project (not about an AI project)." : `Linked after the in-depth analysis.${r.project_guess ? ` The search names it: ${r.project_guess}.` : ""}`}</div>}
          </Fact>
          <Fact title="How it was found">
            {r.found_via && <div className="mid text-[16px]">Found by following a lead: {RELATION[r.relation] ?? "linked from"} {expert || r.via_url ? <Link href={`/sources/${r.found_via}`}>{r.via_title || r.via_url}</Link> : r.via_title}</div>}
            <Kv pairs={[["Found by", DATABASE[r.database] ?? r.database], ["DOI", r.doi]]} />
          </Fact>
          <Fact title="Local copies" wide badge={<span className="ver ver-none">downloaded when found; datasets are never downloaded</span>}>
            {got.length || other.length ? (
              <>
                <div className="tbl-wrap"><table className="qt"><thead><tr><th>File</th><th>Copy</th><th>Original</th></tr></thead>
                  <tbody>
                    {got.map((x, i) => <tr key={i}><td>{FILE_KIND[x.kind] ?? x.kind}{x.note && <span className="text-muted ml-1">{x.note}</span>}</td>
                      <td>{expert ? <a href={`/api/sources/${r.id}/files/${encodeURIComponent(x.name)}`} target="_blank" rel="noopener">Local copy ↗</a> : <span className="note">Experts only</span>} <span className="text-muted">{String(x.name).endsWith(".pdf") ? "PDF" : "web page"}, {fmtNum(Math.max(1, Math.round((x.bytes ?? 0) / 1024)))} KB</span></td>
                      <td><a href={x.url} target="_blank" rel="noopener noreferrer">{short(x.url)}</a></td></tr>)}
                    {other.map((x, i) => <tr key={i}><td>{FILE_KIND[x.kind] ?? x.kind}</td><td><span className="ver ver-none">{x.skipped || x.error || "not downloaded"}</span></td><td><a href={x.url} target="_blank" rel="noopener noreferrer">{short(x.url)}</a></td></tr>)}
                  </tbody></table></div>
                {r.text_chars ? <div className="note mt-1">Text read by the AI: {fmtNum(r.text_chars)} characters{expert && <> · <a href={`/api/sources/${r.id}/files/text`} target="_blank" rel="noopener">show text</a></>}</div> : null}
              </>
            ) : <div className="na">Nothing downloaded (source analysed before the library existed).</div>}
          </Fact>
        </div>
      </Sec>
      {expert && <div className="sec"><details><summary>Raw data (for debugging)</summary><pre className="raw">{JSON.stringify(r.fields ?? r.screen, null, 2)}</pre></details></div>}
      {expert && r.extraction_id && <ReviewBar sourceId={Number(r.id)} decision={r.review_decision} comment={r.review_comment} reviewer={r.reviewer} reviewedAt={r.reviewed_at} />}
    </article>
  );
}
