// Little Envelopes — small drawing helpers shared by the screens and sheets.
import { app, esc, fmt, fmtR, fdShort } from "./core.js";
import { round2, parts } from "./calc.js";

const P = {
  binder: '<rect x="6" y="3.5" width="13" height="17"/><path d="M3.5 7.5h5M3.5 12h5M3.5 16.5h5"/>',
  env: '<rect x="3" y="6" width="18" height="13"/><path d="M3 6.5l9 6.5 9-6.5"/>',
  jar: '<path d="M8 3.5h8M9 3.5v3C6.8 7.6 6 9.2 6 11.5v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8c0-2.3-.8-3.9-3-5v-3"/><path d="M9.5 14h5"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5"/><rect x="13.5" y="4" width="6.5" height="6.5"/><rect x="4" y="13.5" width="6.5" height="6.5"/><path d="M14.5 16.8l1.8 1.8 3.2-3.6"/>',
  year: '<rect x="4" y="5.5" width="16" height="15"/><path d="M4 10h16M8.5 3v4.5M15.5 3v4.5"/>',
  sliders: '<path d="M4 7.5h9M17 7.5h3M4 16.5h3M11 16.5h9"/><rect x="13" y="5.5" width="4" height="4"/><rect x="7" y="14.5" width="4" height="4"/>',
  cash: '<rect x="2.5" y="6.5" width="19" height="11"/><circle cx="12" cy="12" r="2.4"/><path d="M5.5 9.5v5M18.5 9.5v5"/>',
  card: '<rect x="2.5" y="5.5" width="19" height="13"/><path d="M2.5 9.5h19M6 15h4"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  spend: '<rect x="3" y="7" width="18" height="12"/><path d="M3 7l3-3.5h12L21 7M16 13h2.5"/>',
  more: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19"/><path d="M11 18.5h2"/>',
  pencil: '<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z"/><path d="M14 7l3 3"/>',
};
export const ic = (name, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">${P[name] || ""}</svg>`;

// Money: whole numbers without cents, everything else with them.
export const cur = n => { const r = round2(n); return Number.isInteger(r) ? fmtR(r) : fmt(r); };
export const m = n => `<span class="m num">${esc(cur(n))}</span>`;
export const mr = n => `<span class="m num">${esc(fmtR(n))}</span>`;   // rounded, for big totals

export const brand = () => `<div class="brand"><span class="mk">${ic("env", "ic")}</span><div><small>LITTLE</small><b>Envelopes</b></div></div>`;

let rid = 0;
export function ring() {
  const id = "rg" + ++rid;
  return `<span class="ring"><svg viewBox="0 0 46 18" width="46" height="18" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--m1)"/><stop offset=".45" style="stop-color:var(--m2)"/><stop offset="1" style="stop-color:var(--m3)"/></linearGradient></defs>
    <rect x="2" y="2.5" width="42" height="13" rx="6.5" fill="none" stroke="url(#${id})" stroke-width="3.6"/><path d="M9 3.6h26" stroke="#FFFFFF" stroke-width="1" opacity=".6"/></svg></span>`;
}

// "13 – 26 Nov" or "30 Oct – 12 Nov"
export function rangeText(p) {
  const a = fdShort(p.start), b = fdShort(p.end);
  return parts(p.start)[1] === parts(p.end)[1] ? `${a.replace(/\s*\D+$/, "")} – ${b}` : `${a} – ${b}`;
}

// One envelope. `info` comes from calc.envPeriod (or, for a fund, { left: saved, budget: goal }).
export function envCard(e, info, { act = "open-env", note = "", warn = false, fund = false, word = "left of", total = null, tag = "button" } = {}) {
  const left = info.left, of = total ?? info.budget;
  const pctv = fund ? (of > 0 ? Math.min(100, (left / of) * 100) : 0) : info.pctLeft;
  const cls = ["env", e.kind === "card" ? "carde" : "cashe", fund ? "isfund" : "", left <= 0 ? (left < 0 ? "over" : "zero") : ""].join(" ");
  const attrs = tag === "button" ? `type="button" data-act="${act}" data-id="${e.id}" aria-label="${esc(e.name)}: ${esc(cur(left))} ${esc(word)} ${esc(cur(of))}"` : "";
  return `<${tag} class="${cls}" ${attrs}><span class="flapw"><span class="flap"></span></span><span class="lbl">${esc(e.name)}</span>
    <span class="erow"><span class="amt">${m(left)}</span><span class="kind">${ic(e.kind === "card" ? "card" : "cash")}${e.kind === "card" ? "card" : "cash"}</span></span>
    <span class="of">${esc(word)} ${m(of)}</span><span class="line"><i style="width:${pctv.toFixed(1)}%"></i></span><span class="enote${warn ? " r" : ""}">${note}</span></${tag}>`;
}
