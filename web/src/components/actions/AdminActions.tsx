"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DOMAIN_TAGS, JOB_TYPE, RUN_FORM, fmtDateTime } from "@/lib/vocab";
import { JobWatcher } from "./JobWatcher";

async function send(method: string, path: string, body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);
  const out = await res?.json().catch(() => null);
  if (!res?.ok) throw new Error(out?.error ?? "network error");
  return out;
}

const STATUS: Record<string, string> = { queued: "ver-none", running: "ver-none", done: "ver-ok", failed: "ver-no" };

function jobSummary(j: any) {
  const p = j.params ?? {};
  if (j.type === "analyse") return `${(p.source_ids ?? []).length} source${(p.source_ids ?? []).length === 1 ? "" : "s"}: ${(p.source_ids ?? []).slice(0, 8).map((s: number) => `S${s}`).join(", ")}${(p.source_ids ?? []).length > 8 ? "…" : ""}`;
  if (j.type === "run") return `${DOMAIN_TAGS[p.domain] ?? "All domains"} · ${[...(p.countries ?? []), p.other_countries].filter(Boolean).join(", ")} · up to ${p.max_searches} searches`;
  if (j.type === "rescreen") return `${DOMAIN_TAGS[p.domain] ?? "All-domain runs"} · up to ${p.limit}`;
  if (j.type === "organise") return `${DOMAIN_TAGS[p.domain] ?? "All-domain runs"} · budget ${p.max}${p.analyse ? " · and analyse" : ""}`;
  if (j.type === "resummarise") return `${(p.project_ids ?? []).length} project${(p.project_ids ?? []).length === 1 ? "" : "s"}`;
  if (j.type === "forget_run") return `Run ${p.run_id}`;
  return "";
}

function RunFunnel({ counts }: { counts: any }) {
  if (!counts) return null;
  const steps: [string, string][] = [["found", "found"], ["new", "new"], ["downloaded", "downloaded"], ["passed_screen", "passed screen"], ["analysed", "analysed"]];
  return <div className="note">{steps.filter(([k]) => counts[k] != null).map(([k, l]) => `${counts[k]} ${l}`).join(" → ")}</div>;
}

export function JobsTable({ mine }: { mine?: boolean }) {
  const [jobs, setJobs] = useState<any[] | null>(null);
  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const out = await fetch(`/api/jobs${mine ? "?mine=1" : ""}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (stop) return;
      if (out) setJobs(out.items);
      t = setTimeout(tick, out?.items?.some((j: any) => j.status === "queued" || j.status === "running") ? 4000 : 20000);
    };
    tick();
    return () => { stop = true; clearTimeout(t); };
  }, [mine]);
  if (!jobs) return <p className="note">Loading…</p>;
  if (!jobs.length) return <p className="na">Nothing yet.</p>;
  return (
    <div className="tbl-wrap card">
      <table className="qt min-w-[760px]">
        <thead><tr><th>Requested</th><th>Type</th><th>What</th>{!mine && <th>By</th>}<th>Status</th><th>Finished</th></tr></thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td className="whitespace-nowrap">{fmtDateTime(j.created_at)}</td>
              <td>{JOB_TYPE[j.type] ?? j.type}</td>
              <td>{jobSummary(j)}{j.run_id && <div><Link href={`/runs/${j.run_id}`}>Run {j.run_id}</Link></div>}<RunFunnel counts={j.run_counts ?? j.result?.counts} />{j.error && <div className="note text-bad">{j.error}</div>}</td>
              {!mine && <td>{j.requester_name}</td>}
              <td><span className={`ver ${STATUS[j.status]}`}>{j.status}</span></td>
              <td className="whitespace-nowrap">{fmtDateTime(j.finished_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CheckGroup({ legend, options, value, onChange }: { legend: string; options: [string, string][]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset><legend className="text-[14px] font-medium mb-1">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">{options.map(([v, l]) => <label key={v} className="inline-flex gap-1.5 items-center text-[14px]"><input type="checkbox" checked={value.includes(v)} onChange={(e) => onChange(e.target.checked ? [...value, v] : value.filter((x) => x !== v))} />{l}</label>)}</div>
    </fieldset>
  );
}

export function RunForm({ busy }: { busy: boolean }) {
  const [s, setS] = useState({ domain: "", countries: ["Bangladesh"], other_countries: "", languages: ["local", "en"], source_types: ["news", "gov_report", "journal"], topic_focus: "", since_year: "", engine: "codex", max_searches: "6", results_per_search: "10", max_analyse: "10", screen_level: "balanced" });
  const [msg, setMsg] = useState("");
  const [job, setJob] = useState<string | null>(null);
  const set = (k: string, v: unknown) => setS((x) => ({ ...x, [k]: v }));
  const tasks = useMemo(() => {
    const c = s.countries.length + (s.other_countries.trim() ? s.other_countries.split(/[,;\n]+/).filter((x) => x.trim()).length : 0);
    return Math.min(c * s.languages.length * s.source_types.length, Number(s.max_searches) || 0);
  }, [s]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm(`Start a run with up to ${tasks} searches? It uses the OpenAI budget and takes 10 to 90 minutes.`)) return;
    setMsg("Starting…");
    try {
      const out = await send("POST", "/api/admin/runs", { ...s, since_year: s.since_year ? Number(s.since_year) : null, max_searches: Number(s.max_searches), results_per_search: Number(s.results_per_search), max_analyse: s.max_analyse === "" ? null : Number(s.max_analyse) });
      setJob(out.job_id); setMsg("Run started.");
    } catch (err) { setMsg(`Could not start (${(err as Error).message}).`); }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 max-w-[720px]">
      {busy && <div className="banner banner-warn !my-0">A run is in progress. Only one run can go at a time.</div>}
      <fieldset><legend className="text-[14px] font-medium mb-1">Domain</legend><div className="flex flex-wrap gap-x-4 gap-y-1">{RUN_FORM.domains.map(([v, l]) => <label key={v} className="inline-flex gap-1.5 items-center text-[14px]"><input type="radio" name="domain" checked={s.domain === v} onChange={() => set("domain", v)} />{l}</label>)}</div><p className="note mt-1">Choosing a domain applies that domain's rules from the experts' skill files.</p></fieldset>
      <CheckGroup legend="Countries" options={RUN_FORM.countries.map((c) => [c, c])} value={s.countries} onChange={(v) => set("countries", v)} />
      <label className="field">Other countries<input className="input" placeholder="Optional, e.g. Vietnam, Nepal" value={s.other_countries} onChange={(e) => set("other_countries", e.target.value)} /></label>
      <CheckGroup legend="Search languages" options={RUN_FORM.languages} value={s.languages} onChange={(v) => set("languages", v)} />
      <CheckGroup legend="Source types" options={RUN_FORM.sourceTypes} value={s.source_types} onChange={(v) => set("source_types", v)} />
      <label className="field">Topic focus<input className="input" placeholder="Optional, e.g. tuberculosis, rice pests, flood early warning" value={s.topic_focus} onChange={(e) => set("topic_focus", e.target.value)} /></label>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <label className="field">Published from (year)<input className="input" type="number" min={1990} max={2100} placeholder="Optional" value={s.since_year} onChange={(e) => set("since_year", e.target.value)} /></label>
        <label className="field">Max web searches<input className="input" type="number" min={1} max={200} required value={s.max_searches} onChange={(e) => set("max_searches", e.target.value)} /></label>
        <label className="field">Results per search<input className="input" type="number" min={1} max={100} required value={s.results_per_search} onChange={(e) => set("results_per_search", e.target.value)} /></label>
        <label className="field">Max to analyse<input className="input" type="number" min={0} max={1000} placeholder="Empty = all" value={s.max_analyse} onChange={(e) => set("max_analyse", e.target.value)} /></label>
      </div>
      <fieldset><legend className="text-[14px] font-medium mb-1">Search engine</legend><div className="flex flex-wrap gap-x-4 gap-y-1">{RUN_FORM.engines.map(([v, l]) => <label key={v} className="inline-flex gap-1.5 items-center text-[14px]"><input type="radio" name="engine" checked={s.engine === v} onChange={() => set("engine", v)} />{l}</label>)}</div></fieldset>
      <fieldset><legend className="text-[14px] font-medium mb-1">Relevance screen</legend><div className="flex flex-wrap gap-x-4 gap-y-1">{RUN_FORM.screens.map(([v, l]) => <label key={v} className="inline-flex gap-1.5 items-center text-[14px]"><input type="radio" name="screen" checked={s.screen_level === v} onChange={() => set("screen_level", v)} />{l}</label>)}</div></fieldset>
      <div className="flex flex-wrap gap-3 items-center">
        <button className="btn btn-primary" disabled={busy || tasks === 0}>Start run</button>
        <span className="note">{tasks} search task{tasks === 1 ? "" : "s"} (each is one country × language × source type)</span>
        {msg && <span className="note" role="status">{msg}</span>}
        {job && <JobWatcher id={job} doneNote="See the Runs page." />}
      </div>
    </form>
  );
}

export function OperationForms() {
  const [re, setRe] = useState({ domain: "healthcare", limit: "100", min_relevance: "0.6" });
  const [org, setOrg] = useState({ domain: "healthcare", max: "10", analyse: false });
  const [m1, setM1] = useState(""); const [m2, setM2] = useState("");
  const [j1, setJ1] = useState<string | null>(null); const [j2, setJ2] = useState<string | null>(null);
  const domains = RUN_FORM.domains.map(([v, l]) => <option key={v} value={v}>{v ? l : "All-domain runs"}</option>);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form className="card p-4 flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); setM1("Sending…"); try { const o = await send("POST", "/api/admin/rescreen", { domain: re.domain, limit: Number(re.limit), min_relevance: Number(re.min_relevance) }); setJ1(o.job_id); setM1(""); } catch (x) { setM1((x as Error).message); } }}>
        <h2 className="font-semibold">Screen again</h2>
        <p className="note">Screens again, with the current rules, sources of a domain screened before the screen gave evidence types and domain tags, or whose screen failed.</p>
        <label className="field">Domain<select className="select" value={re.domain} onChange={(e) => setRe({ ...re, domain: e.target.value })}>{domains}</select></label>
        <label className="field">At most<input className="input" type="number" min={1} max={300} value={re.limit} onChange={(e) => setRe({ ...re, limit: e.target.value })} /></label>
        <label className="field">Minimum relevance<input className="input" type="number" min={0} max={1} step={0.1} value={re.min_relevance} onChange={(e) => setRe({ ...re, min_relevance: e.target.value })} /></label>
        <div className="flex flex-wrap gap-2 items-center"><button className="btn btn-primary">Start</button>{m1 && <span className="note" role="status">{m1}</span>}{j1 && <JobWatcher id={j1} />}</div>
      </form>
      <form className="card p-4 flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); setM2("Sending…"); try { const o = await send("POST", "/api/admin/organise", { domain: org.domain, max: Number(org.max), analyse: org.analyse }); setJ2(o.job_id); setM2(""); } catch (x) { setM2((x as Error).message); } }}>
        <h2 className="font-semibold">Organise and select</h2>
        <p className="note">Runs the organiser on a domain's queue: deployments, tools, duplicates and, with a budget, which sources to analyse. Without “analyse” it only records the grouping and the reasons.</p>
        <label className="field">Domain<select className="select" value={org.domain} onChange={(e) => setOrg({ ...org, domain: e.target.value })}>{domains}</select></label>
        <label className="field">Analysis budget (0 = none)<input className="input" type="number" min={0} max={1000} value={org.max} onChange={(e) => setOrg({ ...org, max: e.target.value })} /></label>
        <label className="inline-flex gap-1.5 items-center text-[14px]"><input type="checkbox" checked={org.analyse} onChange={(e) => setOrg({ ...org, analyse: e.target.checked })} />Also analyse the chosen sources</label>
        <div className="flex flex-wrap gap-2 items-center"><button className="btn btn-primary">Start</button>{m2 && <span className="note" role="status">{m2}</span>}{j2 && <JobWatcher id={j2} />}</div>
      </form>
    </div>
  );
}

export function ForgetRun({ runId }: { runId: number | string }) {
  const [preview, setPreview] = useState<any>(null);
  const [typed, setTyped] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  if (done) return <div className="banner banner-good" role="status">{msg} <Link href="/runs">Back to the runs</Link></div>;
  if (!preview) return <div className="mt-2 flex gap-2 items-center"><button className="btn" onClick={async () => { try { setPreview(await send("GET", `/api/admin/runs/${runId}/forget`)); } catch (e) { setMsg((e as Error).message); } }}>Show what would be taken out</button>{msg && <span className="note">{msg}</span>}</div>;
  return (
    <div className="mt-2 flex flex-col gap-2">
      <p>{preview.sources} sources, {preview.extractions} analyses, {preview.projects} projects and {preview.tools} tools would be taken out.</p>
      <label className="field max-w-xs">Type <b>run {String(runId)}</b> to confirm<input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} /></label>
      <div className="flex gap-2 items-center">
        <button className="btn btn-fail" disabled={typed.trim().toLowerCase() !== `run ${runId}`} onClick={async () => { setMsg("Working…"); try { const o = await send("POST", `/api/admin/runs/${runId}/forget`); setMsg(`Run ${runId} taken out: ${o.sources} sources, ${o.folders_moved} folders archived.`); setDone(true); } catch (e) { setMsg((e as Error).message); } }}>Take out this run</button>
        {msg && <span className="note" role="status">{msg}</span>}
      </div>
    </div>
  );
}

export function UsersTable({ users, me }: { users: any[]; me: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const patch = async (id: string, body: unknown) => { setMsg("Saving…"); try { await send("PATCH", `/api/admin/users/${id}`, body); setMsg("Saved."); router.refresh(); } catch (e) { setMsg((e as Error).message); } };
  return (
    <div>
      {msg && <p className="note mb-1.5" role="status">{msg}</p>}
      <div className="tbl-wrap card">
        <table className="qt min-w-[720px]">
          <thead><tr><th>Name</th><th>E-mail</th><th>Registered</th><th>Role</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}{u.id === me && <span className="ver ver-none ml-1">you</span>}</td>
                <td>{u.email}{u.email_verified && <span className="ver ver-ok ml-1">verified</span>}</td>
                <td className="whitespace-nowrap">{fmtDateTime(u.created_at)}</td>
                <td><select className="select" aria-label={`Role of ${u.email}`} value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })}><option value="visitor">Visitor</option><option value="expert">Expert</option><option value="admin">Administrator</option></select></td>
                <td>{u.role === "expert" && !u.approved && <button className="btn btn-primary" onClick={() => patch(u.id, { approved: true })}>Approve expert</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
