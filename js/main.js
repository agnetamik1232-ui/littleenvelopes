// Little Envelopes — start-up, and one listener for every click, form and input.
import { app, actions, forms, live, render, closeSheet, isSheetOpen, openSheet } from "./core.js";
import { todayISO } from "./calc.js";
import { shell } from "./views.js";
import { applyLook, renderUnlock, renderSetup, envSheet, fundSheet } from "./flows.js";
import { blankState } from "./model.js";
import { demoState } from "./demo.js";
import * as store from "./store.js";

const params = new URLSearchParams(location.search);
app.demo = params.has("demo");
app.photo = app.demo && params.has("photo");
app.view = "binder";

function renderApp() { const y = scrollY; document.getElementById("app").innerHTML = shell(); if (y) scrollTo(0, y); }
app.start = () => { app.renderFn = renderApp; applyLook(); renderApp(); if (app.demo) demoExtras(); };

// Demo only: open a given screen straight away (for listing photos and videos).
//   ?demo&photo  &look=matcha  &dark=on  &view=stuff|funds|challenges|year|settings|more  &stuff=next
//   &open=env:Groceries | fund:Christmas | spend | unstuff | card | ch-new | env-new   &tick=3 (with &stuff=next: tick the first 3 rows)
function demoExtras() {
  const look = params.get("look"), view = params.get("view"), open = params.get("open") || "";
  if (look) app.S.profile.look = look;
  if (params.get("dark") === "on") app.S.profile.dark = true;
  if (params.has("big")) app.S.profile.bigText = true;
  if (view) app.view = view;
  if (params.get("stuff") === "next") app.stuffWhich = "next";
  const tick = Number(params.get("tick") || 0);
  applyLook(); render();
  if (tick) { for (let i = 0; i < tick; i++) { const b = document.querySelectorAll('[data-act="stuff-tick"][aria-pressed="false"]')[0]; if (b && app.view === "stuff") actions["stuff-tick"](b); } }
  const fire = (act, data = {}) => { const el = document.createElement("button"); Object.assign(el.dataset, data); actions[act]?.(el); };
  const byName = (list, n) => list.find(x => x.name.toLowerCase() === n.toLowerCase());
  if (open.startsWith("env:")) { const e = byName(app.S.envelopes, open.slice(4)); if (e) { app.spendEnv = e.id; openSheet(envSheet(e.id), { label: "Envelope" }); } }
  if (open.startsWith("fund:")) { const f = byName(app.S.funds, open.slice(5)); if (f) openSheet(fundSheet(f.id), { label: "Fund" }); }
  if (open === "spend") fire("spend");
  if (open === "unstuff") fire("unstuff", { when: "this" });
  if (open === "card") fire("story-card");
  if (open === "ch-new") fire("ch-new");
  if (open === "env-new") fire("env-new");
  if (params.get("amount")) setTimeout(() => { const i = document.querySelector('#sheet-root input[name="amount"]'); if (i) { i.value = params.get("amount"); i.blur(); } }, 60);
}

document.addEventListener("click", e => {
  const scrim = e.target.closest("[data-scrim]");
  if (scrim && e.target === scrim) { closeSheet(); return; }
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener("submit", e => { const f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault(); forms[f.dataset.form]?.(f, e); });
const isChoice = el => el.type === "checkbox" || el.type === "radio" || el.tagName === "SELECT";
document.addEventListener("input", e => { const el = e.target.closest("[data-live]"); if (el && !isChoice(el)) live[el.dataset.live]?.(el, e); });
document.addEventListener("change", e => { const el = e.target.closest("[data-live]"); if (el && isChoice(el)) live[el.dataset.live]?.(el, e); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && isSheetOpen()) closeSheet(); });
// select the amount when an amount box gets focus, so typing replaces it
document.addEventListener("focusin", e => { if (e.target.matches?.(".amtin")) setTimeout(() => e.target.select?.(), 0); });
function checkDay() { const t = todayISO(); if (t !== app.today) { app.today = t; if (app.renderFn && !isSheetOpen()) render(); } }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkDay(); });
setInterval(checkDay, 60000);

async function boot() {
  app.today = todayISO();
  if (params.get("today") && app.demo) app.today = params.get("today");
  if (app.demo) { app.S = demoState(app.today); app.start(); return; }
  const s = await store.load();
  app.S = s || blankState();
  applyLook();
  if (!s || !s.meta.unlocked) return renderUnlock();
  if (!s.meta.setupDone) return renderSetup();
  app.start();
}
boot().catch(err => {
  console.error(err);
  document.getElementById("app").innerHTML = `<div class="center-screen"><div class="center-card"><h1 class="fr">Something went wrong</h1><p style="margin:.6rem 0 1rem">Your binder is safe on this device. Try reloading. If it keeps happening, message the shop with this: ${String(err && err.message || err).replace(/[<>&]/g, "")}</p><button class="btn" onclick="location.reload()">Reload</button></div></div>`;
});
if ("serviceWorker" in navigator && location.protocol !== "file:" && !params.has("nosw")) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
