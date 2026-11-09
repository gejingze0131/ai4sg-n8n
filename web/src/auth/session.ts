import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "./auth";
import { atLeast, effectiveRole, type Role, type Viewer } from "./roles";

export async function viewerFrom(h: Headers): Promise<Viewer> {
  const s = await auth.api.getSession({ headers: h }).catch(() => null);
  if (!s?.user) return null;
  const u = s.user as typeof s.user & { role?: string; approved?: boolean };
  return { id: u.id, name: u.name, email: u.email, role: effectiveRole(u), requestedRole: (u.role ?? "visitor") as Role, approved: u.approved !== false };
}

export async function viewer(): Promise<Viewer> {
  return viewerFrom(await headers());
}

// for pages: sends people who are not signed in to the sign-in page, and hides the page from those without the role
export async function requireRole(min: Role, nextPath: string): Promise<NonNullable<Viewer>> {
  const v = await viewer();
  if (!v) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!atLeast(v, min)) notFound();
  return v;
}
