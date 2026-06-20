#!/usr/bin/env node
// scripts/verify-build.js
// Specularis Market Terminal Lite — pre-deploy verification script.
// Run: node scripts/verify-build.js
// Returns exit code 0 on success, 1 on any failure.

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pass = (msg) => console.log(`  ✅  ${msg}`);
const fail = (msg) => { console.error(`  ❌  ${msg}`); failures++; };
const section = (title) => console.log(`\n── ${title} ──`);
let failures = 0;

// ── 1. Required static files ──
section("Static entry files");
const staticRequired = [
  "index.html", "app.js", "styles.css", "i18n.js", "config.js", "vercel.json", "package.json",
];
for (const f of staticRequired) {
  existsSync(join(root, f)) ? pass(f) : fail(`MISSING: ${f}`);
}

// ── 2. New module files ──
section("Specularis Terminal Lite modules");
const moduleFiles = [
  "modules/specularis-terminal-lite.js",
  "modules/stock-intelligence-pro.js",
  "modules/options-intelligence-lite.js",
  "modules/kol-distillation.js",
  "modules/ai-decision-layer.js",
  "modules/ai-prompt-export.js",
];
for (const f of moduleFiles) {
  existsSync(join(root, f)) ? pass(f) : fail(`MISSING: ${f}`);
}

// ── 3. lib/market-terminal files ──
section("lib/market-terminal support files");
const libFiles = [
  "lib/market-terminal/schema.js",
  "lib/market-terminal/fallbackData.js",
  "lib/market-terminal/scoring.js",
  "lib/market-terminal/promptBuilder.js",
];
for (const f of libFiles) {
  existsSync(join(root, f)) ? pass(f) : fail(`MISSING: ${f}`);
}

// ── 4. API routes ──
section("Vercel API routes");
const apiFiles = [
  "api/snapshot.js", "api/daily-report.js", "api/trade-decision.js",
  "api/health.js", "api/finnhub.js", "api/twelvedata.js",
];
for (const f of apiFiles) {
  existsSync(join(root, f)) ? pass(f) : fail(`MISSING: ${f}`);
}

// ── 5. JS syntax checks ──
section("JavaScript syntax");
const jsToCheck = [
  "app.js", "i18n.js", "config.js",
  ...moduleFiles,
  ...libFiles,
  ...apiFiles,
  "lib/market-structure-pro.js",
  "lib/narrative-engine.js",
  "lib/trade-decision-engine.js",
];
for (const f of jsToCheck) {
  const full = join(root, f);
  if (!existsSync(full)) continue;
  try {
    execSync(`node --check ${full}`, { stdio: "pipe" });
    pass(`syntax OK: ${f}`);
  } catch (e) {
    fail(`syntax ERROR: ${f}\n     ${e.stderr?.toString().trim().slice(0, 120)}`);
  }
}

// ── 6. index.html structure ──
section("index.html structure");
const html = readFileSync(join(root, "index.html"), "utf8");

const requiredWorkspaceTabs = ["premarket","intraday","stock-intel","options-lite","kol-ai","report","plan","watchlist"];
const requiredWorkspaceViews = [...requiredWorkspaceTabs];
const requiredContainers = ["sipContainer","oilContainer","kolContainer","adlContainer","apeContainer"];

for (const ws of requiredWorkspaceTabs) {
  html.includes(`data-workspace-target="${ws}"`) ? pass(`tab: ${ws}`) : fail(`MISSING tab: ${ws}`);
}
for (const ws of requiredWorkspaceViews) {
  html.includes(`data-workspace="${ws}"`) ? pass(`view: ${ws}`) : fail(`MISSING view: ${ws}`);
}
for (const id of requiredContainers) {
  html.includes(`id="${id}"`) ? pass(`container: #${id}`) : fail(`MISSING container: #${id}`);
}
html.includes('specularis-terminal-lite.js') ? pass("module script tag") : fail("MISSING module script tag");
html.includes('type="module"') ? pass("type=module on script") : fail("MISSING type=module");

// ── 7. vercel.json ──
section("vercel.json");
try {
  const vj = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
  vj.buildCommand ? pass(`buildCommand: ${vj.buildCommand.slice(0,60)}`) : fail("MISSING buildCommand");
  vj.outputDirectory === "." ? pass("outputDirectory: .") : fail(`outputDirectory: ${vj.outputDirectory} (expected '.')`);
  vj.functions?.["api/*.js"] ? pass("functions: api/*.js configured") : fail("MISSING functions config");
} catch (e) {
  fail(`vercel.json parse error: ${e.message}`);
}

// ── 8. CSS brace balance ──
section("CSS integrity");
const css = readFileSync(join(root, "styles.css"), "utf8");
const opens = (css.match(/\{/g) || []).length;
const closes = (css.match(/\}/g) || []).length;
opens === closes ? pass(`CSS braces balanced: ${opens} { = ${closes} }`) : fail(`CSS braces UNBALANCED: ${opens} { vs ${closes} }`);
css.includes("sip-grid") && css.includes("oil-grid") && css.includes("adl-grid")
  ? pass("new module CSS classes present")
  : fail("new module CSS classes missing");

// ── 9. Snapshot terminalLite ──
section("Snapshot API extension");
const snap = readFileSync(join(root, "api/snapshot.js"), "utf8");
snap.includes("terminalLite") ? pass("terminalLite namespace in snapshot") : fail("MISSING terminalLite in snapshot");
snap.includes("stockIntelligencePro") ? pass("stockIntelligencePro field") : fail("MISSING stockIntelligencePro");
snap.includes("optionsIntelligenceLite") ? pass("optionsIntelligenceLite field") : fail("MISSING optionsIntelligenceLite");
snap.includes("dataStatus") ? pass("dataStatus field present") : fail("MISSING dataStatus field");

// ── 10. No fake data markers ──
section("Data integrity (no fabricated live data)");
const moduleSrc = moduleFiles.map(f => {
  try { return readFileSync(join(root, f), "utf8"); } catch { return ""; }
}).join("\n");

const fakePatterns = [
  /ivRank\s*:\s*\d+\.?\d*/,
  /gammaWall\s*:\s*\d+/,
  /unusualFlow.*=.*\[.*\{/s,
];
let fakeFound = false;
for (const p of fakePatterns) {
  if (p.test(moduleSrc)) { fail(`Potential fabricated data pattern: ${p}`); fakeFound = true; }
}
if (!fakeFound) pass("no fabricated option flow / GEX data detected");
moduleSrc.includes("dataStatus: \"placeholder\"") ? pass("placeholder labels present") : fail("placeholder labels missing");

// ── Summary ──
console.log(`\n${"─".repeat(50)}`);
if (failures === 0) {
  console.log(`\n✅  All checks passed. Vercel deployment should work.\n`);
  console.log(`   Active app:     index.html + app.js + styles.css + i18n.js`);
  console.log(`   New modules:    modules/ (browser ES modules, no bundler needed)`);
  console.log(`   API routes:     api/*.js (Vercel serverless, Node ≥18, ESM)`);
  console.log(`   Build command:  none (static, outputDirectory: .)`);
} else {
  console.error(`\n❌  ${failures} check(s) failed. Fix before deploying.\n`);
  process.exit(1);
}
