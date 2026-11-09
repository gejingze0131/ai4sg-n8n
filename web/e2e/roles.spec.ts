import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";

// The acceptance list of handoff.md section 11, walked through as the three kinds of user.
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const stamp = Date.now();
const PASSWORD = "e2e-test-password-1";
const expertEmail = `expert-${stamp}@ai4sg.test`;
const visitorEmail = `visitor-${stamp}@ai4sg.test`;

const post = (r: APIRequestContext, url: string, data: unknown) => r.post(url, { data, headers: { "Content-Type": "application/json" } });

async function register(page: Page, role: "Visitor" | "Expert", email: string, name: string) {
  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole("radio", { name: new RegExp(`^${role}`) }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

const firstId = async (r: APIRequestContext, query: string) => (await (await r.get(`/api/sources?${query}`)).json()).items[0].id as string;

test.describe("anonymous visitor", () => {
  test("can browse the dashboard, map, projects and sources", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "AI deployments for social good" })).toBeVisible();
    await expect(page.getByText("Sources analysed").first()).toBeVisible();
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
    await page.getByRole("button", { name: "Education" }).click();
    await expect(page).toHaveURL(/domain=education/);
    await page.goto("/projects?domain=healthcare");
    const card = page.locator('a[href^="/projects/P-"]').first();
    await card.click();
    await expect(page).toHaveURL(/\/projects\/P-\d{5}/);
    await expect(page.getByText("Deployment (project)")).toBeVisible();
    await page.goto(`/sources/${await firstId(page.request, "status=analysed")}`);
    await expect(page.getByRole("heading", { name: "Relevance", exact: false }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "✓ Pass" })).toHaveCount(0);
  });

  test("gets filtered, paged results from the server", async ({ request }) => {
    const all = await (await request.get("/api/projects")).json();
    expect(all.items.length).toBeLessThanOrEqual(all.pageSize);
    expect(all.total).toBeGreaterThan(all.items.length - 1);
    const some = await (await request.get("/api/projects?domain=education&stage=pilot")).json();
    expect(some.total).toBeLessThan(all.total);
    const stats = await (await request.get("/api/stats/breakdown?by=country")).json();
    expect(stats.items[0]).toHaveProperty("n");
    const map = await (await request.get("/api/map?zoom=0")).json();
    expect(map.mode).toBe("cluster");
    expect((await (await request.get("/api/map?zoom=8")).json()).mode).toBe("point");
  });

  test("cannot write or see what is not analysed", async ({ request }) => {
    expect((await post(request, "/api/reviews", { source_id: 1, decision: "approved" })).status()).toBe(403);
    expect((await post(request, "/api/analyse", { source_ids: [1] })).status()).toBe(403);
    expect((await post(request, "/api/projects/merge", { project: "P-00001", target: "P-00002" })).status()).toBe(403);
    expect((await post(request, "/api/admin/rescreen", { domain: "", limit: 1 })).status()).toBe(403);
    expect((await request.get("/api/sources?status=queued")).status()).toBe(403);
    expect((await request.get("/api/admin/users")).status()).toBe(403);
    expect((await request.get("/api/sources/1/files/x.pdf")).status()).toBe(403);
    expect((await post(request, "/api/internal/jobs/00000000-0000-0000-0000-000000000000", { status: "done" })).status()).toBe(403);
  });

  test("cannot register as an administrator, or take the administrator's address", async ({ request }) => {
    expect((await post(request, "/api/auth/register", { email: `a-${stamp}@ai4sg.test`, password: PASSWORD, name: "A", role: "admin" })).status()).toBe(403);
    expect((await post(request, "/api/auth/register", { email: env.ADMIN_EMAIL, password: PASSWORD, name: "A", role: "visitor" })).status()).toBe(403);
    expect((await post(request, "/api/auth/sign-up/email", { email: `b-${stamp}@ai4sg.test`, password: PASSWORD, name: "B", role: "admin" })).status()).toBe(404);
  });

  test("works at phone width, with text in local scripts", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto("/sources?country=Bangladesh");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const bengali = await page.request.get("/api/search?q=%E0%A6%95%E0%A7%83%E0%A6%A4%E0%A7%8D%E0%A6%B0%E0%A6%BF%E0%A6%AE");
    expect(bengali.ok()).toBe(true);
  });
});

test("a registered visitor cannot review", async ({ page }) => {
  await register(page, "Visitor", visitorEmail, "E2E Visitor");
  const id = await firstId(page.request, "status=analysed");
  await page.goto(`/sources/${id}`);
  await expect(page.getByRole("button", { name: "✓ Pass" })).toHaveCount(0);
  expect((await post(page.request, "/api/reviews", { source_id: Number(id), decision: "approved" })).status()).toBe(403);
  await page.goto("/queue");
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
});

test("an expert reviews, requests analysis and corrects projects", async ({ page }) => {
  await register(page, "Expert", expertEmail, "E2E Expert");
  const r = page.request;

  // review
  const id = await firstId(r, "status=analysed&review=awaiting");
  await page.goto(`/sources/${id}`);
  await page.getByLabel("Comment").fill("Checked against the stored copy.");
  await page.getByRole("button", { name: "✗ Fail" }).click();
  await expect(page.getByText("“Checked against the stored copy.”")).toBeVisible();
  await page.getByRole("button", { name: "✓ Pass" }).click();
  await expect(page.locator(".chip-pass").first()).toBeVisible();

  // not analysed list and analysis request
  await page.goto("/queue");
  await expect(page.getByRole("tab", { name: /Waiting in the queue/ })).toBeVisible();
  await page.getByRole("button", { name: /^(Analyse|Download & analyse)$/ }).first().click();
  await expect(page.getByText(/Analysis: Finished/)).toBeVisible();

  // the same source cannot be sent twice while it is in progress
  const queued = (await (await r.get("/api/sources?status=queued&sort=new")).json()).items.slice(5, 7).map((s: any) => Number(s.id));
  const [a, b] = await Promise.all([post(r, "/api/analyse", { source_ids: queued }), post(r, "/api/analyse", { source_ids: queued })]);
  expect([a.status(), b.status()].sort()).toEqual([200, 409]);
  expect((await post(r, "/api/analyse", { source_ids: Array.from({ length: 31 }, (_, i) => i + 1) })).status()).toBe(400);

  // a stored page cannot run scripts on this site
  const copy = await r.get(`/api/sources/${id}/files/1-main.html`);
  expect(copy.ok()).toBe(true);
  expect(copy.headers()["content-security-policy"]).toContain("sandbox");

  // move a source; the project summary job is requested
  const src = (await (await r.get("/api/sources?status=analysed&sort=new")).json()).items.find((s: any) => s.project_code);
  const target = (await (await r.get("/api/projects?sort=name")).json()).items.find((p: any) => p.code !== src.project_code).code;
  const moved = await post(r, "/api/projects/move", { source_id: Number(src.id), target });
  expect(moved.ok()).toBe(true);
  expect((await moved.json()).code).toBe(target);

  // own records
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: /My reviews \(1\)/ })).toBeVisible();

  // not for experts
  expect((await post(r, "/api/admin/rescreen", { domain: "", limit: 1 })).status()).toBe(403);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
});

test("an administrator runs the pipeline and manages users", async ({ page }) => {
  await login(page, env.ADMIN_EMAIL, env.ADMIN_INITIAL_PASSWORD);
  page.on("dialog", (d) => d.accept());
  const r = page.request;

  await page.goto("/admin/run");
  await expect(page.getByText(/search tasks?/)).toBeVisible();
  await page.getByRole("button", { name: "Start run" }).click();
  await expect(page.getByText(/Run: Finished/)).toBeVisible();

  await page.goto("/admin/operations");
  expect((await (await post(r, "/api/admin/rescreen", { domain: "education", limit: 1 })).json()).ok).toBe(true);
  expect((await (await post(r, "/api/admin/organise", { domain: "education", max: 1, analyse: false })).json()).ok).toBe(true);

  const someone = (await (await r.get("/api/admin/users?q=visitor-&role=visitor")).json()).items[0].email as string;
  await page.goto(`/admin/users?q=${encodeURIComponent(someone)}`);
  await page.getByRole("combobox", { name: `Role of ${someone}` }).selectOption("expert");
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/admin/log?action=review");
  await expect(page.getByRole("cell", { name: "review.save" }).first()).toBeVisible();

  // take out the smallest run: rows copied to the archive schema, files archived
  const runs = (await (await r.get("/api/runs")).json()).items as any[];
  const victim = runs.filter((x) => x.finished_at).sort((a, b) => (a.counts?.new ?? 0) - (b.counts?.new ?? 0))[0];
  await page.goto(`/runs/${victim.id}`);
  await page.getByRole("button", { name: "Show what would be taken out" }).click();
  await page.getByLabel(/to confirm/).fill(`run ${victim.id}`);
  await page.getByRole("button", { name: "Take out this run" }).click();
  await expect(page.getByText(new RegExp(`Run ${victim.id} taken out`))).toBeVisible();
  expect((await (await r.get("/api/runs")).json()).items.some((x: any) => String(x.id) === String(victim.id))).toBe(false);
  expect((await r.get(`/api/admin/runs/${victim.id}/forget`)).status()).toBe(404);
});
