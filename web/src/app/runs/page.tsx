import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/auth/roles";
import { viewer } from "@/auth/session";
import { Empty } from "@/components/ui";
import { listRuns } from "@/lib/queries/misc";
import { DOMAIN_TAGS, fmtDateTime } from "@/lib/vocab";

export const metadata: Metadata = { title: "Runs" };
const n = (r: any, k: string) => r.counts?.[k] ?? "—";

export default async function Runs() {
  const [v, runs] = await Promise.all([viewer(), listRuns()]);
  const admin = isAdmin(v);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div><h1 className="page-title">Runs</h1><p className="sub">Each run searches for new sources, downloads them, screens them, organises them into deployments and tools, and analyses the most useful ones in depth.</p></div>
        {admin && <Link href="/admin/run" className="btn btn-primary">Start a run</Link>}
      </div>
      {runs.length ? (
        <div className="tbl-wrap card">
          <table className="qt min-w-[1040px]">
            <thead><tr><th>Run</th><th>Started</th><th>Domain</th>
              <th className="num" title="all candidates returned by the searches">Found</th><th className="num" title="after removing duplicates within the run">Unique</th><th className="num" title="not seen in earlier runs">New</th>
              <th className="num" title="reached by following references, citing papers or named reports">Cascaded</th><th className="num">Downloaded</th><th className="num">Passed screen</th>
              <th className="num" title="analysed in depth (of which from the queue of earlier runs)">Analysed</th><th className="num" title="screened, waiting for analysis in this domain after the run">Queued</th><th className="num" title="the same document as another source">Duplicates</th><th className="num">New projects</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{admin ? <Link href={`/runs/${r.id}`}>{r.id}</Link> : r.id}</td>
                  <td className="whitespace-nowrap">{fmtDateTime(r.started_at)}{!r.finished_at && <span className="ver ver-none ml-1">running or stopped</span>}</td>
                  <td>{DOMAIN_TAGS[r.domain] ?? "All domains"}</td>
                  <td className="num">{n(r, "found")}</td><td className="num">{n(r, "unique")}</td><td className="num">{n(r, "new")}</td><td className="num">{n(r, "cascaded")}</td>
                  <td className="num">{n(r, "downloaded")}{r.counts?.full_text != null && <span className="ver ver-none ml-1" title="full text / abstract only">{r.counts.full_text} full, {r.counts.abstract_only ?? 0} abstract</span>}{r.counts?.download_failed ? <span className="ver ver-no ml-1">{r.counts.download_failed} failed</span> : null}</td>
                  <td className="num">{n(r, "passed_screen")}</td>
                  <td className="num">{n(r, "analysed")}{r.counts?.analysed_from_queue ? ` (${r.counts.analysed_from_queue} from queue)` : ""}</td>
                  <td className="num">{n(r, "queued")}</td><td className="num">{n(r, "duplicates")}</td>
                  <td className="num">{n(r, "new_projects")}{r.counts?.new_tools ? <span className="ver ver-none ml-1">{r.counts.new_tools} tools</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>No runs yet.</Empty>}
      <p className="note">Nothing is cut: every source found is kept. “Max sources to analyse” only limits the in-depth analysis; the rest wait in the queue and are considered first in the next run of the same domain.</p>
    </div>
  );
}
