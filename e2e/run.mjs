// E2E runner for the features that used to say "준비 중이에요".
//
//   CHROME_EXE=/path/to/chrome node e2e/run.mjs [filter...]
//
// env: BASE (default: the Vercel deployment), CHROME_EXE (Chromium/Chrome binary),
//      OUT (default e2e/.out), HEADED=1 to watch.
// Each file in e2e/scenarios exports `scenarios`: [{ id, feature, name, run(t) }].
// Every scenario gets a fresh browser context (empty localStorage, tours marked seen).
// A scenario fails on a thrown error, a failed t.expect, or any uncaught page error.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const BASE = (process.env.BASE || "https://patterners-clone-chunbaenas-projects.vercel.app").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT || "e2e/.out");
const filters = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

const dir = path.resolve("e2e/scenarios");
const all = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".mjs")).sort()) {
  const mod = await import(pathToFileURL(path.join(dir, f)).href);
  for (const s of mod.scenarios ?? []) all.push({ ...s, file: f });
}
const picked = filters.length ? all.filter((s) => filters.some((x) => s.id.includes(x) || s.file.includes(x))) : all;

const browser = await chromium.launch({ executablePath: process.env.CHROME_EXE, headless: !process.env.HEADED });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

for (const s of picked) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "ko-KR", acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.addInitScript(() => {
    try {
      if (!localStorage.getItem("patterners.tour.home")) {
        localStorage.setItem("patterners.tour.home", "99");
        for (const c of ["crochet", "knitting", "grid", "apparel", "paper"]) localStorage.setItem(`patterners.tour.maker.${c}`, "99");
      }
    } catch {}
  });
  const page = await ctx.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e.message || e)));
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("dialog", (d) => d.accept().catch(() => {}));
  const failures = [];
  const steps = [];
  const t = {
    page,
    ctx,
    browser,
    base: BASE,
    sleep,
    log: (m) => steps.push(m),
    expect(cond, msg) {
      steps.push(`${cond ? "✓" : "✗"} ${msg}`);
      if (!cond) failures.push(msg);
      return !!cond;
    },
    shot: (name) => page.screenshot({ path: path.join(OUT, `${s.id}-${name}.png`) }),
    goto: async (p, wait = 1800) => {
      await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
      await sleep(wait);
    },
    /** Creates a work through the home "새 도안" button whose label starts with `label`; returns its /maker URL. */
    async create(label, wait = 3000) {
      await t.goto("/home");
      const ok = await page.evaluate((lab) => {
        const els = [...document.querySelectorAll("button")].filter((x) => (x.innerText || "").trim().startsWith(lab) && x.getBoundingClientRect().width > 0);
        if (!els[0]) return false;
        els[0].click();
        return true;
      }, label);
      if (!ok) throw new Error(`no create button "${label}"`);
      await page.waitForURL(/\/maker\//, { timeout: 10000 });
      await sleep(wait);
      return page.url();
    },
    /** Clicks the first visible element whose text (or aria-label) matches. */
    async click(match, opts = {}) {
      const loc = typeof match === "string" && /^[\[.#a-z]/i.test(match) && !opts.text ? page.locator(match) : page.getByText(match, { exact: opts.exact ?? false });
      const el = loc.filter({ visible: true }).first();
      await el.click({ timeout: opts.timeout ?? 5000 });
      await sleep(opts.wait ?? 400);
    },
    byLabel: (l) => page.locator(`[aria-label="${l}"]`).filter({ visible: true }).first(),
    text: () => page.evaluate(() => document.body.innerText),
    has: async (re) => (re instanceof RegExp ? re : new RegExp(re)).test(await page.evaluate(() => document.body.innerText)),
    storage: (key) => page.evaluate((k) => localStorage.getItem(k), key),
    works: () => page.evaluate(() => JSON.parse(localStorage.getItem("pt:works") || "[]")),
    work: (id) => page.evaluate((i) => JSON.parse(localStorage.getItem(`pt:work:${i}`) || "null"), id),
    idFromUrl: () => page.url().split("/maker/")[1]?.split(/[?#]/)[0],
  };
  const started = Date.now();
  let error = null;
  try {
    await s.run(t);
    await sleep(300);
  } catch (e) {
    error = String(e?.stack || e).split("\n").slice(0, 3).join(" | ");
    await t.shot("error").catch(() => {});
  }
  const soon = await page.evaluate(() => document.body.innerText.includes("준비 중이에요")).catch(() => false);
  if (soon) failures.push('"준비 중이에요" 표시됨');
  const ok = !error && failures.length === 0 && pageErrors.length === 0;
  results.push({ id: s.id, feature: s.feature, name: s.name, ok, ms: Date.now() - started, error, failures, pageErrors, consoleErrors: consoleErrors.slice(0, 5), steps });
  console.log(`${ok ? "PASS" : "FAIL"}  ${s.id}  ${s.name}${ok ? "" : `\n      ${[error, ...failures, ...pageErrors.map((e) => "pageerror: " + e)].filter(Boolean).join("\n      ")}`}`);
  await ctx.close();
}
await browser.close();

const pass = results.filter((r) => r.ok).length;
const summary = { base: BASE, at: new Date().toISOString(), total: results.length, pass, fail: results.length - pass, results };
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(summary, null, 1));
console.log(`\n${pass}/${results.length} passed  (${BASE})  → ${path.join(OUT, "results.json")}`);
process.exit(pass === results.length ? 0 : 1);
