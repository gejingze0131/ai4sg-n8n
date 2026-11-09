"use client";

export function SignOut() {
  return <button className="btn" onClick={async () => { await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); window.location.href = "/"; }}>Sign out</button>;
}
