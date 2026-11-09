import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/auth/session";
import { ForgetRun } from "@/components/actions/AdminActions";
import { getRun } from "@/lib/queries/misc";
import { DOMAIN_TAGS, SOURCE_TYPE, fmtDateTime, fmtNum, langName } from "@/lib/vocab";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return { title: `Run ${(await params).id}` }; }

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("admin", `/runs/${id}`);
  const data = await getRun(Number(id));
  if (!data) notFound();
  const { run: r, tasks } = data;
  const counts = Object.entries(r.counts ?? {}).filter(([, v]) => typeof v === "number");
  const settings = Object.entries(r.settings ?? {}).filter(([k]) => !["tasks", "formMode", "submittedAt", "job_id"].includes(k));
  return (
    <article className="flex flex-col gap-4">
      <div>
        <Link href="/runs" className="text-[14px]">← Runs</Link>
        <h1 className="page-title">Run {r.id}</h1>
        <p className="sub">{DOMAIN_TAGS[r.domain] ?? "All domains"} · started {fmtDateTime(r.started_at)}{r.finished_at ? ` · finished ${fmtDateTime(r.finished_at)}` : " · not finished"}</p>
      </div>
      <div className="facts">
        <div className="fact"><div className="fact-h"><b>Settings</b></div><dl className="kv">{settings.map(([k, v]) => <div key={k} className="contents"><dt>{k}</dt><dd>{Array.isArray(v) ? v.join(", ") : String(v ?? "")}</dd></div>)}</dl></div>
        <div className="fact"><div className="fact-h"><b>Numbers</b></div><dl className="kv">{counts.map(([k, v]) => <div key={k} className="contents"><dt>{k.replace(/_/g, " ")}</dt><dd className="tabular-nums">{fmtNum(v)}</dd></div>)}</dl>{r.counts?.organised_by && <p className="note mt-1">Organised by: {r.counts.organised_by}</p>}</div>
      </div>
      <h2 className="text-[17px] font-semibold">Search tasks ({tasks.length})</h2>
      <div className="tbl-wrap card">
        <table className="qt min-w-[900px]">
          <thead><tr><th>Country</th><th>Language</th><th>Source type</th><th>Engine</th><th className="num">Candidates</th><th className="num">Seconds</th><th className="num">Commands</th><th className="num">Web searches</th><th className="num">Tokens in / out</th><th>Academic databases and queries</th></tr></thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>{t.country}</td><td>{langName(t.language)}</td><td>{SOURCE_TYPE[t.source_type] ?? t.source_type}</td><td>{t.engine}</td>
                <td className="num">{fmtNum(t.candidates)}</td><td className="num">{fmtNum(t.duration_s)}</td><td className="num">{fmtNum(t.commands)}</td><td className="num">{fmtNum(t.web_searches)}</td>
                <td className="num">{fmtNum(t.input_tokens)} / {fmtNum(t.output_tokens)}</td>
                <td>
                  {t.error && <span className="ver ver-no">{t.error}</span>}
                  {(t.academic ?? []).length > 0 || (t.queries ?? []).length > 0 ? (
                    <details><summary className="!mt-0 !text-[13px]">{(t.academic ?? []).length} databases, {(t.queries ?? []).length} queries</summary>
                      <ul className="plain text-[13px]">{(t.academic ?? []).map((a: any, i: number) => <li key={i}><b>{a.db}</b>: {a.hits} hits{a.error ? ` · error: ${a.error}` : ""}<div className="text-muted break-words">{a.query}</div></li>)}{(t.queries ?? []).map((q: string, i: number) => <li key={`q${i}`}>{q}</li>)}</ul>
                    </details>
                  ) : null}
                  <div className="note">{t.run_id}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="card p-4"><h2 className="font-semibold mb-1">Take out this run</h2><p className="note">Removes everything this run added, as if it had not happened. Nothing is destroyed: every row is copied to the database schema “archive” first and its downloaded files move to library-archive/.</p><ForgetRun runId={r.id} /></section>
    </article>
  );
}
