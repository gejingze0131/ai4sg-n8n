"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Hits = { projects: any[]; tools: any[]; sources: any[] };

export function GlobalSearch() {
  const [text, setText] = useState("");
  const [hits, setHits] = useState<Hits | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (text.trim().length < 2) { setHits(null); return; }
    const c = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(text.trim())}&limit=5`, { signal: c.signal }).then((r) => r.json()).then(setHits).catch(() => {});
    }, 180);
    return () => { clearTimeout(t); c.abort(); };
  }, [text]);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const go = () => setOpen(false);
  const any = hits && (hits.projects.length || hits.tools.length || hits.sources.length);
  return (
    <div ref={box} className="relative w-full max-w-[340px]">
      <form onSubmit={(e) => { e.preventDefault(); setOpen(false); if (text.trim()) router.push(`/search?q=${encodeURIComponent(text.trim())}`); }}>
        <input type="search" aria-label="Search projects, tools and sources" placeholder="Search projects, tools, sources…" className="input w-full" value={text} onFocus={() => setOpen(true)} onChange={(e) => { setText(e.target.value); setOpen(true); }} />
      </form>
      {open && hits && (
        <div className="absolute right-0 left-0 sm:left-auto sm:w-[440px] top-11 card shadow-lg p-2 z-40 max-h-[70vh] overflow-auto">
          {!any && <div className="na p-2">Nothing found.</div>}
          <Group title="Projects">{hits.projects.map((p) => <Row key={p.code} href={`/projects/${p.code}`} onClick={go} code={p.code} title={p.name} sub={[...(p.countries ?? []), p.tool_name].filter(Boolean).join(" · ")} />)}</Group>
          <Group title="Tools">{hits.tools.map((t) => <Row key={t.code} href={`/tools/${t.code}`} onClick={go} code={t.code} title={t.name} sub={`${t.n_projects} deployment${t.n_projects === 1 ? "" : "s"}${t.developer ? " · " + t.developer : ""}`} />)}</Group>
          <Group title="Sources">{hits.sources.map((s) => <Row key={s.id} href={`/sources/${s.id}`} onClick={go} code={`S${s.id}`} title={s.headline} sub={s.country} />)}</Group>
          {any ? <Link href={`/search?q=${encodeURIComponent(text.trim())}`} onClick={go} className="block p-2 text-[14px]">See all results</Link> : null}
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode[] }) {
  if (!children.length) return null;
  return <div className="mb-1"><div className="note px-2 pt-1 uppercase tracking-wide text-[11px]">{title}</div>{children}</div>;
}

function Row({ href, code, title, sub, onClick }: { href: string; code: string; title: string; sub?: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="block px-2 py-1.5 rounded-md text-ink hover:bg-surface-2 hover:no-underline">
      <span className="orig text-[14px]">{title}</span>
      <span className="block note"><span className="font-medium">{code}</span>{sub ? ` · ${sub}` : ""}</span>
    </Link>
  );
}
