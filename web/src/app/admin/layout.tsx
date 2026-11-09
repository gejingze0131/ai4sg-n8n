import Link from "next/link";
import { requireRole } from "@/auth/session";

const TABS: [string, string][] = [["/admin", "Jobs"], ["/admin/run", "Start a run"], ["/admin/operations", "Re-screen & organise"], ["/runs", "Runs"], ["/admin/users", "Users"], ["/admin/log", "Audit log"]];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin", "/admin");
  return (
    <div className="flex flex-col gap-4">
      <div><h1 className="page-title">Administration</h1><nav className="flex flex-wrap gap-1.5 mt-2" aria-label="Administration">{TABS.map(([h, l]) => <Link key={h} href={h} className="tab">{l}</Link>)}</nav></div>
      {children}
    </div>
  );
}
