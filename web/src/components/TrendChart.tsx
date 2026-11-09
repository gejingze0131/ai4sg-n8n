"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDate } from "@/lib/vocab";

type Point = { id: number; at: string; found: number; analysed: number; newInRun: number; analysedInRun: number };
const SERIES = [{ key: "found" as const, label: "Sources found", color: "#2a78d6" }, { key: "analysed" as const, label: "Sources analysed", color: "#eb6834" }];
const H = 220, M = { t: 14, r: 56, b: 26, l: 40 };

export function TrendChart({ points }: { points: Point[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(520);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  if (points.length < 2) return <div className="na">The trend appears after a second run.</div>;
  const max = Math.max(...points.map((p) => p.found), 1);
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const x = (i: number) => M.l + (i * (w - M.l - M.r)) / (points.length - 1);
  const y = (v: number) => H - M.b - (v * (H - M.t - M.b)) / top;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - M.l) / (w - M.l - M.r)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };
  const h = hover == null ? null : points[hover];
  return (
    <div ref={box} className="relative">
      <div className="flex gap-4 mb-1 text-[13px] text-ink-2">
        {SERIES.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block w-3 h-[3px] rounded" style={{ background: s.color }} />{s.label}</span>)}
      </div>
      <svg width={w} height={H} role="img" aria-label="Sources found and analysed, cumulative, by run" onPointerMove={move} onPointerLeave={() => setHover(null)} style={{ display: "block", touchAction: "pan-y" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)} stroke="var(--color-grid)" />
            <text x={M.l - 6} y={y(t) + 4} textAnchor="end" fontSize={12} fill="var(--color-muted)">{t.toLocaleString("en-US")}</text>
          </g>
        ))}
        {points.map((p, i) => (i === 0 || i === points.length - 1 || points.length <= 8) && <text key={p.id} x={x(i)} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--color-muted)">Run {p.id}</text>)}
        {h && <line x1={x(hover!)} x2={x(hover!)} y1={M.t} y2={H - M.b} stroke="var(--color-line)" />}
        {SERIES.map((s) => (
          <g key={s.key}>
            <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points={points.map((p, i) => `${x(i)},${y(p[s.key])}`).join(" ")} />
            <circle cx={x(points.length - 1)} cy={y(points[points.length - 1][s.key])} r={4} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} />
            <text x={x(points.length - 1) + 8} y={y(points[points.length - 1][s.key]) + 4} fontSize={13} fontWeight={600} fill="var(--color-ink)">{points[points.length - 1][s.key].toLocaleString("en-US")}</text>
            {h && <circle cx={x(hover!)} cy={y(h[s.key])} r={4} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} />}
          </g>
        ))}
      </svg>
      {h && (
        <div className="absolute card px-3 py-2 text-[13px] pointer-events-none shadow-sm" style={{ left: Math.min(x(hover!) + 10, w - 190), top: 34, width: 180 }}>
          <div className="font-semibold">Run {h.id} · {fmtDate(h.at)}</div>
          <div className="text-ink-2">New in this run: {h.newInRun}</div>
          <div className="text-ink-2">Analysed in this run: {h.analysedInRun}</div>
          <div className="text-ink-2">Total found: {h.found}</div>
          <div className="text-ink-2">Total analysed: {h.analysed}</div>
        </div>
      )}
    </div>
  );
}

function niceStep(max: number) {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}
