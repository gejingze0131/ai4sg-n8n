import Link from "next/link";
import { isAdmin, isExpert, type Viewer } from "@/auth/roles";
import { GlobalSearch } from "./GlobalSearch";
import { SignOut } from "./actions/SignOut";

const ROLE_LABEL: Record<string, string> = { visitor: "Visitor", expert: "Expert", admin: "Administrator" };

export function Header({ viewer }: { viewer: Viewer }) {
  const links: [string, string][] = [["/", "Dashboard"], ["/projects", "Projects"], ["/tools", "Tools"], ["/sources", "Sources"], ["/runs", "Runs"]];
  if (isExpert(viewer)) links.push(["/queue", "Not analysed"]);
  if (isAdmin(viewer)) links.push(["/admin", "Admin"]);
  links.push(["/about", "About"]);
  const nav = links.map(([href, label]) => <Link key={href} href={href} className="px-2.5 py-1.5 rounded-md text-[14.5px] text-ink hover:bg-surface-2 hover:no-underline">{label}</Link>);
  return (
    <header className="bg-surface border-b border-line sticky top-0 z-30">
      <div className="wrap flex items-center gap-3 h-14">
        <Link href="/" className="font-semibold text-[16px] text-ink hover:no-underline whitespace-nowrap">AI for Social Good</Link>
        <nav className="hidden lg:flex items-center gap-0.5 ml-2" aria-label="Main">{nav}</nav>
        <div className="flex-1 min-w-0 flex justify-end"><GlobalSearch /></div>
        <div className="hidden sm:flex items-center gap-2 whitespace-nowrap">
          {viewer ? (
            <>
              <Link href="/me" className="text-[14px] text-ink">{viewer.name}<span className="chip ml-2">{ROLE_LABEL[viewer.role]}</span></Link>
              <SignOut />
            </>
          ) : (
            <>
              <Link className="btn" href="/login">Sign in</Link>
              <Link className="btn btn-primary" href="/register">Register</Link>
            </>
          )}
        </div>
        <details className="lg:hidden relative">
          <summary className="btn list-none !mt-0 !text-ink" aria-label="Menu">☰</summary>
          <div className="absolute right-0 top-11 card p-2 flex flex-col w-52 shadow-lg z-40">
            {nav}
            <div className="sm:hidden border-t border-line mt-1 pt-1 flex flex-col">
              {viewer ? <><Link className="px-2.5 py-1.5 text-ink" href="/me">{viewer.name}</Link><div className="px-2.5 py-1.5"><SignOut /></div></> : <><Link className="px-2.5 py-1.5" href="/login">Sign in</Link><Link className="px-2.5 py-1.5" href="/register">Register</Link></>}
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
