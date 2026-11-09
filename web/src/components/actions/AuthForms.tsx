"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const out = await res?.json().catch(() => null);
  return { ok: Boolean(res?.ok), status: res?.status ?? 0, out };
}
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

export function LoginForm({ mailEnabled }: { mailEnabled: boolean }) {
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    const r = await post("/api/auth/login", { email, password });
    setBusy(false);
    if (r.ok) { window.location.href = next; return; }
    if (r.status === 403) setMsg("Please confirm your e-mail address first: look for the message we sent you.");
    else if (r.status === 429) setMsg("Too many attempts. Wait a minute and try again.");
    else setMsg("Wrong e-mail or password.");
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="field">E-mail<input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field">Password<input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {msg && <div className="banner banner-bad !my-0" role="alert">{msg}</div>}
      <button className="btn btn-primary" disabled={busy}>Sign in</button>
      <div className="note flex justify-between gap-3"><span>No account? <Link href="/register">Register</Link></span>{mailEnabled && <Link href="/forgot-password">Forgot password?</Link>}</div>
    </form>
  );
}

export function RegisterForm({ approval }: { approval: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"visitor" | "expert">("visitor");
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    const r = await post("/api/auth/register", { email, password, name, role });
    setBusy(false);
    if (!r.ok) { setMsg(r.out?.error ?? "Could not register."); return; }
    if (r.out.verify_email) { setNote("Almost done: open the link we sent to your address to confirm it, then sign in."); return; }
    window.location.href = r.out.pending_approval ? "/me" : "/";
  };
  if (note) return <div className="banner banner-good">{note}</div>;
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="field">Name<input className="input" required maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field">E-mail<input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field">Password<input className="input" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /><span className="note font-normal">At least 8 characters</span></label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[14px] font-medium mb-1">I am registering as</legend>
        <label className="flex gap-2 items-start text-[14px]"><input type="radio" name="role" checked={role === "visitor"} onChange={() => setRole("visitor")} className="mt-1" /><span><b>Visitor</b><span className="block note">Browse the dashboard, map, and everything analysed.</span></span></label>
        <label className="flex gap-2 items-start text-[14px]"><input type="radio" name="role" checked={role === "expert"} onChange={() => setRole("expert")} className="mt-1" /><span><b>Expert</b><span className="block note">Also review results, see sources not analysed yet, and send sources to the analysis.{approval ? " An administrator approves expert accounts." : ""}</span></span></label>
      </fieldset>
      {msg && <div className="banner banner-bad !my-0" role="alert">{msg}</div>}
      <button className="btn btn-primary" disabled={busy}>Create account</button>
      <div className="note">Already registered? <Link href="/login">Sign in</Link></div>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  if (done) return <div className="banner banner-good">If that address has an account, a link is on its way.</div>;
  return <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); await post("/api/auth/password-reset/request", { email, redirectTo: "/reset-password" }); setDone(true); }}><label className="field">E-mail<input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><button className="btn btn-primary">Send the link</button></form>;
}

export function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [newPassword, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); const r = await post("/api/auth/password-reset/confirm", { newPassword, token }); if (r.ok) window.location.href = "/login"; else setMsg("This link is no longer valid."); }}>
      <label className="field">New password<input className="input" type="password" required minLength={8} value={newPassword} onChange={(e) => setPassword(e.target.value)} /></label>
      {msg && <div className="banner banner-bad !my-0" role="alert">{msg}</div>}
      <button className="btn btn-primary">Set password</button>
    </form>
  );
}

export function ChangePassword() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <form className="flex flex-col gap-2.5 max-w-sm" onSubmit={async (e) => { e.preventDefault(); const r = await post("/api/auth/change-password", { currentPassword, newPassword, revokeOtherSessions: true }); setMsg(r.ok ? "Password changed." : "Could not change it: check the current password."); if (r.ok) { setCurrent(""); setNew(""); } }}>
      <label className="field">Current password<input className="input" type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} /></label>
      <label className="field">New password<input className="input" type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} /></label>
      <button className="btn self-start">Change password</button>
      {msg && <span className="note" role="status">{msg}</span>}
    </form>
  );
}
