export type Role = "visitor" | "expert" | "admin";
const RANK: Record<Role, number> = { visitor: 0, expert: 1, admin: 2 };

export type Viewer = { id: string; name: string; email: string; role: Role; requestedRole: Role; approved: boolean } | null;

// someone who chose "expert" while EXPERT_SIGNUP=approval is a visitor until an administrator approves them
export function effectiveRole(user: { role?: string | null; approved?: boolean | null } | null | undefined): Role {
  if (!user) return "visitor";
  const role = (user.role === "admin" || user.role === "expert" ? user.role : "visitor") as Role;
  if (role === "expert" && user.approved === false) return "visitor";
  return role;
}

export const roleOf = (v: Viewer): Role => v?.role ?? "visitor";
export const atLeast = (v: Viewer, min: Role) => RANK[roleOf(v)] >= RANK[min];
export const isExpert = (v: Viewer) => atLeast(v, "expert");
export const isAdmin = (v: Viewer) => atLeast(v, "admin");
