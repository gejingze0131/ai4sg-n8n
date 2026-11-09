"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, StyleSpecification } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { DOMAIN_COLOR, DOMAIN_ORDER, DOMAIN_TAGS, EVIDENCE_LABEL, STAGE, compact, fmtNum } from "@/lib/vocab";

maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

const POINT_ZOOM = 5.5;
const HOME = { center: [97, 14] as [number, number], zoom: 3.1 };
const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";

type Item = Record<string, any>;
type Payload = { mode: "point" | "cluster"; items: Item[] };

// the radius grows with the logarithm of the reach: figures run from dozens to tens of millions
const radius = (reach?: number | null, min = 6) => (reach && reach > 0 ? Math.max(min, 6 + 2.3 * Math.log10(reach)) : min);
const LEGEND_SIZES = [1e3, 1e5, 1e7];

function toGeoJSON(data: Payload): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: data.items.map((it, i) => ({
      type: "Feature", id: i,
      geometry: { type: "Point", coordinates: [it.lon, it.lat] },
      properties: data.mode === "cluster"
        ? { i, domain: it.domain ?? "general", r: radius(it.reach_people, 10), label: String(it.n_projects) }
        : { i, domain: it.domain ?? "general", r: radius(it.reach_is_people ? Number(it.reach_number) : null), label: "" },
    })),
  };
}

function el(tag: string, cls: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// popups are built from DOM nodes: names come from the data and are never treated as HTML
function pointPopup(it: Item, full: boolean) {
  const root = el("div", "");
  root.append(el("div", "note", `${it.code}${it.tool_name ? ` · ${it.tool_name}` : ""}`), el("div", "font-semibold", it.name));
  root.append(el("div", "text-ink-2", [it.place, it.admin1 && it.admin1 !== it.place ? it.admin1 : "", it.country].filter(Boolean).join(", ")));
  if (!full) return root;
  const chips = el("div", "chips mt-1.5");
  for (const d of it.domain_tags ?? []) chips.append(el("span", `chip d-${d}`, DOMAIN_TAGS[d] ?? d));
  chips.append(el("span", "chip", STAGE[it.stage] ?? it.stage), el("span", "chip", EVIDENCE_LABEL[it.evidence_type] ?? "No evidence"));
  root.append(chips);
  if (it.reach_number != null) root.append(el("div", "mt-1.5", `Reach: ${fmtNum(it.reach_number)} ${it.reach_unit ?? ""}${it.reach_is_target ? " (target)" : ""}`));
  const a = el("a", "block mt-1.5", "Open project →") as HTMLAnchorElement;
  a.href = `/projects/${it.code}`;
  root.append(a, el("div", "note mt-1", "Position approximate, given by the AI from the source."));
  return root;
}

function clusterPopup(it: Item, zoomIn: () => void) {
  const root = el("div", "");
  root.append(el("div", "font-semibold", [it.admin1, it.country].filter(Boolean).join(", ") || "Unknown region"));
  root.append(el("div", "text-ink-2", `${it.n_projects} deployment${it.n_projects === 1 ? "" : "s"}${it.reach_people ? ` · about ${compact(it.reach_people)} people` : ""}`));
  const list = el("div", "mt-1.5 flex flex-col gap-0.5");
  for (const p of it.projects ?? []) { const a = el("a", "", p.name) as HTMLAnchorElement; a.href = `/projects/${p.code}`; list.append(a); }
  root.append(list);
  if (it.n_projects > (it.projects ?? []).length) root.append(el("div", "note", `and ${it.n_projects - it.projects.length} more`));
  const b = el("button", "btn mt-2", "Zoom in");
  b.onclick = zoomIn;
  root.append(b);
  return root;
}

async function fallbackStyle(): Promise<StyleSpecification> {
  const geo = await fetch("/geo.json").then((r) => r.json());
  return {
    version: 8,
    sources: { countries: { type: "geojson", data: geo.countries }, regions: { type: "geojson", data: geo.regions } },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#f2f5f9" } },
      { id: "regions-fill", type: "fill", source: "regions", paint: { "fill-color": "#e9e8e4" } },
      { id: "regions-line", type: "line", source: "regions", paint: { "line-color": "#ffffff", "line-width": 0.7 } },
      { id: "countries-line", type: "line", source: "countries", paint: { "line-color": "#b9b8b3", "line-width": 1 } },
    ],
  };
}

async function initialStyle(): Promise<{ style: string | StyleSpecification; offline: boolean }> {
  try {
    const r = await fetch(STYLE_URL, { signal: AbortSignal.timeout(5000) });
    if (r.ok) return { style: STYLE_URL, offline: false };
  } catch { /* use the fallback */ }
  return { style: await fallbackStyle(), offline: true };
}

export default function ProjectMap({ query }: { query: string }) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const data = useRef<Payload>({ mode: "cluster", items: [] });
  const popup = useRef<maplibregl.Popup | null>(null);
  const pinned = useRef(false);
  const queryRef = useRef(query);
  const projectionRef = useRef<"globe" | "mercator">("globe");
  const [projection, setProjection] = useState<"globe" | "mercator">("globe");
  const [offline, setOffline] = useState(false);
  const [summary, setSummary] = useState<{ mode: string; marks: number; projects: number } | null>(null);
  const [error, setError] = useState(false);
  const loadSeq = useRef(0);

  const load = useMemo(() => async () => {
    const m = map.current;
    if (!m) return;
    const seq = ++loadSeq.current;
    const zoom = m.getZoom();
    try {
      const sep = queryRef.current ? "&" : "";
      const res = await fetch(`/api/map?${queryRef.current}${sep}zoom=${zoom >= POINT_ZOOM ? POINT_ZOOM : 0}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as Payload;
      if (seq !== loadSeq.current) return;
      data.current = json;
      setError(false);
      draw();
      const projects = json.mode === "cluster" ? json.items.reduce((s, i) => s + i.n_projects, 0) : new Set(json.items.map((i) => i.code)).size;
      setSummary({ mode: json.mode, marks: json.items.length, projects });
    } catch { setError(true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const m = map.current;
    if (!m?.isStyleLoaded() && !m?.getSource("marks")) return;
    (m.getSource("marks") as GeoJSONSource | undefined)?.setData(toGeoJSON(data.current));
  }

  useEffect(() => {
    let cancelled = false;
    let tileErrors = 0, tilesOk = false, switched = false;

    function addLayers(m: maplibregl.Map) {
      try { m.setProjection({ type: projectionRef.current }); } catch { /* the base style decides */ }
      if (!m.getSource("marks")) m.addSource("marks", { type: "geojson", data: toGeoJSON(data.current) });
      if (!m.getLayer("marks")) {
        m.addLayer({
          id: "marks", type: "circle", source: "marks",
          layout: { "circle-sort-key": ["-", 0, ["get", "r"]] },
          paint: {
            "circle-radius": ["get", "r"], "circle-opacity": 0.88, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
            "circle-color": ["match", ["get", "domain"], ...DOMAIN_ORDER.flatMap((d) => [d, DOMAIN_COLOR[d]]), DOMAIN_COLOR.general] as any,
          },
        });
      }
      if (m.getStyle().glyphs && !m.getLayer("mark-labels")) {
        m.addLayer({ id: "mark-labels", type: "symbol", source: "marks", layout: { "text-field": ["get", "label"], "text-size": 12, "text-font": ["Noto Sans Bold"], "text-allow-overlap": true }, paint: { "text-color": "#0b0b0b", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
      }
    }

    (async () => {
      const { style, offline: off } = await initialStyle();
      if (cancelled || !node.current) return;
      setOffline(off);
      const m = new maplibregl.Map({ container: node.current, style, center: HOME.center, zoom: HOME.zoom, minZoom: 1, maxZoom: 13, cooperativeGestures: true, attributionControl: { compact: true } });
      map.current = m;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      popup.current = new maplibregl.Popup({ closeButton: true, closeOnClick: false, maxWidth: "300px", offset: 10 });
      popup.current.on("close", () => { pinned.current = false; });

      m.on("style.load", () => { addLayers(m); load(); });
      m.on("error", async (e: any) => {
        const isTile = e?.tile || e?.sourceId || /tile|fetch|load/i.test(String(e?.error?.message ?? ""));
        if (!isTile || tilesOk || switched) return;
        if (++tileErrors >= 4) { switched = true; setOffline(true); m.setStyle(await fallbackStyle()); }
      });
      m.on("sourcedata", (e) => { if (e.sourceId !== "marks" && e.isSourceLoaded && e.tile) tilesOk = true; });

      const show = (e: maplibregl.MapLayerMouseEvent, full: boolean) => {
        const f = e.features?.[0];
        if (!f) return;
        const it = data.current.items[f.properties!.i];
        if (!it) return;
        const content = data.current.mode === "cluster"
          ? clusterPopup(it, () => { pinned.current = false; popup.current?.remove(); m.easeTo({ center: [it.lon, it.lat], zoom: POINT_ZOOM + 0.6 }); })
          : pointPopup(it, full);
        popup.current!.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).setDOMContent(content).addTo(m);
      };
      m.on("mouseenter", "marks", () => { m.getCanvas().style.cursor = "pointer"; });
      m.on("mousemove", "marks", (e) => { if (!pinned.current) show(e, data.current.mode === "cluster"); });
      m.on("mouseleave", "marks", () => { m.getCanvas().style.cursor = ""; if (!pinned.current) popup.current?.remove(); });
      m.on("click", "marks", (e) => { pinned.current = true; show(e, true); });
      m.on("click", (e) => { if (!m.queryRenderedFeatures(e.point, { layers: ["marks"] }).length) { pinned.current = false; popup.current?.remove(); } });

      let lastBand = m.getZoom() >= POINT_ZOOM;
      m.on("zoomend", () => { const band = m.getZoom() >= POINT_ZOOM; if (band !== lastBand) { lastBand = band; pinned.current = false; popup.current?.remove(); load(); } });
    })();

    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, [load]);

  useEffect(() => { queryRef.current = query; if (map.current) load(); }, [query, load]);

  const switchProjection = (p: "globe" | "mercator") => {
    projectionRef.current = p;
    setProjection(p);
    map.current?.setProjection({ type: p });
  };

  return (
    <div className="relative">
      <div ref={node} className="h-[420px] sm:h-[540px] w-full rounded-b-[11px] overflow-hidden bg-[#eef2f6]" />
      <div className="absolute top-2.5 left-2.5 flex gap-1.5">
        <div className="card flex p-0.5 shadow-sm" role="group" aria-label="Map projection">
          {(["globe", "mercator"] as const).map((p) => <button key={p} onClick={() => switchProjection(p)} className={`px-2.5 py-1 text-[13px] rounded-md ${projection === p ? "bg-accent-soft text-accent font-medium" : "text-ink-2"}`}>{p === "globe" ? "Globe" : "Flat"}</button>)}
        </div>
        <button className="btn !py-1 !text-[13px] shadow-sm" onClick={() => map.current?.easeTo({ ...HOME })}>Reset view</button>
      </div>
      <div className="absolute left-2.5 bottom-2.5 card shadow-sm px-3 py-2 text-[12.5px] text-ink-2 max-w-[250px] hidden sm:block">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {DOMAIN_ORDER.map((d) => <span key={d} className="inline-flex items-center gap-1.5"><span aria-hidden className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: DOMAIN_COLOR[d] }} />{DOMAIN_TAGS[d]}</span>)}
        </div>
        <div className="flex items-end gap-2.5 mt-1.5" aria-label="Circle size shows the people reached">
          {LEGEND_SIZES.map((v) => <span key={v} className="inline-flex flex-col items-center gap-0.5"><span aria-hidden className="rounded-full border border-muted inline-block" style={{ width: radius(v) * 2, height: radius(v) * 2 }} />{compact(v)}</span>)}
          <span className="pb-0.5">people reached</span>
        </div>
        <div className="note mt-1 leading-snug">Smallest dots: no figure counting people. Numbers are deployments in that region. Positions are approximate.</div>
      </div>
      {summary && <div className="absolute right-2.5 bottom-2.5 card shadow-sm px-2.5 py-1 text-[12.5px] text-ink-2">{summary.marks === 0 ? "No mapped deployments match" : summary.mode === "cluster" ? `${summary.projects} placements in ${summary.marks} regions · zoom in for each place` : `${summary.projects} deployments · ${summary.marks} places`}</div>}
      {offline && <div className="absolute top-14 left-2.5 card shadow-sm px-2.5 py-1 text-[12.5px] text-warn bg-warn-soft">Base map unavailable: showing country and region outlines only.</div>}
      {error && <div className="absolute top-14 left-2.5 card shadow-sm px-2.5 py-1 text-[12.5px] text-bad">The map data could not be loaded.</div>}
    </div>
  );
}
