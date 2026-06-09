// api/ai-prompt-generate.js
// Specularis Market Terminal Lite v1.4.2 — Gemini-powered prompt automation
// POST { lang, prompt, context }

function envValue(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function noStoreJson(res, status, data) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0