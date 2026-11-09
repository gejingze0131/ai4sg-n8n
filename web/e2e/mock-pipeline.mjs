// Stands in for n8n, codex-runner and the OpenAI API in tests: nothing here costs money or touches real data.
//   /webhook/*        checks the shared key, records the call, then reports the job as running and done
//   /library/*        a stored page containing a script (to test the sandbox) and its text
//   /library-archive  pretends to move folders
//   /v1/*             always fails, like an OpenAI outage
//   /__calls          what was received
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 5699);
const WEB = process.env.WEB_URL || "http://localhost:3001";
const KEY = process.env.N8N_WEBHOOK_SECRET || "";
const calls = [];
const json = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
const report = (job, status, extra = {}) => fetch(`${WEB}/api/internal/jobs/${job}`, { method: "POST", headers: { "Content-Type": "application/json", "x-ai4sg-key": KEY }, body: JSON.stringify({ status, execution_id: "mock", ...extra }) }).catch(() => {});

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let raw = "";
  for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : {};
  if (url.pathname === "/__calls") return json(res, 200, calls);
  if (url.pathname === "/__reset") { calls.length = 0; return json(res, 200, { ok: true }); }
  if (url.pathname.startsWith("/webhook/")) {
    if (req.headers["x-ai4sg-key"] !== KEY) return json(res, 403, { error: "bad key" });
    const name = url.pathname.slice("/webhook/".length);
    calls.push({ name, body });
    json(res, 200, { ok: true });
    if (body.job_id) {
      setTimeout(() => report(body.job_id, "running"), 100);
      setTimeout(() => report(body.job_id, "done", name === "ai4sg-run-start" ? { result: { run_id: 999 } } : {}), 600);
    }
    return;
  }
  if (req.method === "GET" && /^\/library\/\d+\/file\//.test(url.pathname)) { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return res.end("<h1>Stored page</h1><script>document.title='SCRIPT RAN'</script>"); }
  if (req.method === "GET" && /^\/library\/\d+\/text$/.test(url.pathname)) { res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Stored text"); }
  if (url.pathname === "/library-archive") { calls.push({ name: "library-archive", body }); return json(res, 200, { ok: true, moved: (body.source_ids || []).length }); }
  if (url.pathname.startsWith("/v1/")) return json(res, 500, { error: { message: "mock outage" } });
  json(res, 404, { error: "not found" });
}).listen(PORT, () => console.log(`mock pipeline on :${PORT}`));
