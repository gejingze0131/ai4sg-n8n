import fs from "node:fs";
import path from "node:path";

// Shaded regions and dots for the places a source or project names. Boundaries: Natural Earth (public/geo.json, 13 countries).
type Feature = { properties: { iso: string; name: string; alt?: string }; geometry: { type: string; coordinates: any } };
type Geo = { countries: { features: Feature[] }; regions: { features: Feature[] } };
let GEO: Geo | null = null;
const geo = (): Geo => (GEO ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "geo.json"), "utf8")) as Geo);

const ALIAS: Record<string, string> = { chattogram: "chittagong", barishal: "barisal", jashore: "jessore", bogura: "bogra", cumilla: "comilla", "viet nam": "vietnam" };
const nm = (s?: string) => { const t = String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(division|province|state|region|district)\b/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim(); return ALIAS[t] || t; };
const ringsOf = (g: Feature["geometry"]): number[][][] => (g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : []);

export function LocationMap({ countries: wantedCountries, places, scope }: { countries: string[]; places: any[]; scope?: string }) {
  const g = geo();
  const named = places.filter((p) => p && (p.name || p.admin1));
  const names = new Set([...wantedCountries, ...named.map((p) => p.country)].filter(Boolean).map(nm));
  const countries = g.countries.features.filter((f) => names.has(nm(f.properties.name)));
  if (!countries.length) return <div className="na">No map for this country yet.</div>;
  const isos = new Set(countries.map((f) => f.properties.iso));
  const regions = g.regions.features.filter((f) => isos.has(f.properties.iso));
  const wanted = new Set(named.flatMap((p) => [p.level === "admin1" ? p.name : "", p.admin1]).filter(Boolean).map(nm));
  const national = scope === "national" || named.some((p) => p.level === "country");
  const regionOn = (f: Feature) => [f.properties.name, ...String(f.properties.alt ?? "").split("|")].some((n) => n && wanted.has(nm(n)));
  let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
  for (const f of countries) for (const ring of ringsOf(f.geometry)) for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const k = Math.cos((((y0 + y1) / 2) * Math.PI) / 180), W = 360, pad = 10;
  const sx = (W - 2 * pad) / Math.max(0.01, (x1 - x0) * k);
  const H = Math.round(Math.min(420, (y1 - y0) * sx + 2 * pad));
  const s = Math.min(sx, (H - 2 * pad) / Math.max(0.01, y1 - y0));
  const px = (x: number) => pad + (x - x0) * k * s, py = (y: number) => pad + (y1 - y) * s;
  const d = (geom: Feature["geometry"]) => ringsOf(geom).map((ring) => `M${ring.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join("L")}Z`).join("");
  const inside = (p: any) => typeof p.lat === "number" && typeof p.lon === "number" && p.lon >= x0 - 0.3 && p.lon <= x1 + 0.3 && p.lat >= y0 - 0.3 && p.lat <= y1 + 0.3;
  const pts = named.filter((p) => ["admin2", "city", "site"].includes(p.level) && inside(p));
  return (
    <>
      <svg className="geo" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Map of project locations">
        {regions.map((f, i) => <path key={i} className={`rg ${regionOn(f) ? "on" : ""}`} d={d(f.geometry)}><title>{`${f.properties.name}${regionOn(f) ? " · project area" : ""}`}</title></path>)}
        {countries.map((f, i) => <path key={i} className={`ct ${national ? "on" : ""}`} d={d(f.geometry)}><title>{`${f.properties.name}${national ? " · nationwide" : ""}`}</title></path>)}
        {pts.map((p, i) => <circle key={i} className="pt" cx={px(p.lon).toFixed(1)} cy={py(p.lat).toFixed(1)} r={6}><title>{`${p.name} (approximate)`}</title></circle>)}
        {pts.slice(0, 4).map((p, i) => <text key={i} x={(px(p.lon) + 9).toFixed(1)} y={(py(p.lat) + 4).toFixed(1)}>{p.name}</text>)}
      </svg>
      <div className="note mt-1">Shaded: regions named in the source{national ? " (nationwide: whole country)" : ""}. Dots: specific places, positions approximate. Boundaries: Natural Earth.</div>
    </>
  );
}
