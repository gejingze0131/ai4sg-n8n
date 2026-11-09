import type { Metadata } from "next";
import { RunForm } from "@/components/actions/AdminActions";
import { activeRun, reconcileJobs } from "@/lib/jobs";

export const metadata: Metadata = { title: "Start a run" };

export default async function StartRun() {
  await reconcileJobs();
  const busy = await activeRun();
  return <section><h2 className="text-[17px] font-semibold mb-1">Start a run</h2><p className="note mb-3">Every source found is kept; sources collected in earlier runs are skipped.</p><RunForm busy={Boolean(busy)} /></section>;
}
