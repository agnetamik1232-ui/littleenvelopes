// Little Envelopes — the screens.
import * as C from "./calc.js";
import { app, esc, fd, fdShort, fdLong, fMonthShort, fmtR } from "./core.js";
import { ic, m, mr, cur, brand, ring, rangeText, envCard } from "./ui.js";
import { CURRENCIES } from "./model.js";

export const ETSY_URL = "https://www.etsy.com/listing/4624144666";
export const APP_VERSION = "1.0.0";
export const LOOKS = { strawberry: ["Strawberry", "#E7B3C1", "#C9A462"], blueberry: ["Blueberry", "#9CB4DD", "#BCC2CF"], matcha: ["Matcha", "#B5C79A", "#C9A462"], academia: ["Academia", "#7C2F38", "#B68C45"] };
const NAV = [["binder", "Binder", "binder"], ["stuff", "Stuff payday", "env"], ["funds", "Sinking funds", "jar"], ["challenges", "Challenges", "grid"], ["year", "Year", "year"], ["settings", "Settings", "sliders"]];
const S = () => app.S;
export const period = () => C.periodOf(S().pay, app.today);
export const stuffPeriod = () => (app.stuffWhich === "next" ? C.nextPeriod(S().pay, period()) : period());
const liveEnvs = () => S().envelopes.filter(e => !e.archived);
const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function shell() {
  const v = app.view, P = S().profile, p = period();
  const cur = k => (v === k || (k === "more" && ["funds", "year", "settings", "more"].includes(v)) ? ' aria-current="page"' : "");
  return `${app.demo && !app.photo ? `<div class="demo-bar"><span class="long">Free demo with Mia's binder. Try anything, nothing is saved.</span><span class="short">Free demo · nothing is saved</span><a href="${ETSY_URL}" target="_blank" rel="noopener">Get Little Envelopes</a></div>` : ""}
  <header class="ptop">${brand()}<button type="button" data-act="nav" data-view="settings">${ic("sliders")}Settings</button></header>
  <div class="app">
    <aside class="cover">${brand()}
      <nav aria-label="Main">${NAV.map(([k, l, i]) => `<button type="button" data-act="nav" data-view="${k}"${v === k ? ' aria-current="page"' : ""}>${ic(i)}${l}</button>`).join("")}</nav>
      <div class="cfoot">${esc(C.RHYTHMS[S().pay.rhythm]?.label || "")}<br>Next payday <b>${esc(fd(p.next))}</b><br>Unstuff on <b>${esc(fd(p.end))}</b>${app.demo ? `<div class="ex">Example binder: ${esc(P.name)}</div>` : ""}</div>
      <div class="rings">${ring()}${ring()}${ring()}${ring()}${ring()}${ring()}</div>
    </aside>
    <main class="page" id="main">${(views[v] || views.binder)()}</main>
  </div>
  <nav class="tabbar" aria-label="Main">
    <button type="button" data-act="nav" data-view="binder"${cur("binder")}>${ic("binder")}Binder</button>
    <button type="button" data-act="nav" data-view="stuff"${cur("stuff")}>${ic("env")}Stuff</button>
    <button type="button" data-act="spend">${ic("spend")}Spend</button>
    <button type="button" data-act="nav" data-view="challenges"${cur("challenges")}>${ic("grid")}Challenges</button>
    <button type="button" data-act="nav" data-view="more"${cur("more")}>${ic("more")}More</button>
  </nav>`;
}

// ---------- notes under each envelope ----------
function envNote(e, info) {
  const name = id => S().envelopes.find(x => x.id === id)?.name || S().funds.find(x => x.id === id)?.name || "another envelope";
  if (info.borrowedIn.length) { const b = info.borrowedIn[info.borrowedIn.length - 1]; return [`Borrowed ${cur(b.amount)} from ${esc(name(b.from))}`, true]; }
  if (info.left < 0) return [`${cur(-info.left)} over. Borrow to cover it`, true];
  if (info.budget <= 0) return [e.amount > 0 ? `Stuff ${cur(e.amount)} on payday` : "Empty", false];
  if (info.left === 0 && info.lastSpend) return [`${ic("check")}${e.kind === "card" ? "Paid" : "Used up"} on ${esc(fdShort(info.lastSpend))}`, false];
  if (e.kind === "card" && e.group === "bills") return [info.left >= info.budget ? "Ready to pay" : "Partly paid", false];
  if (/coffee/i.test(e.name) && info.left >= 3) return [`about ${Math.floor(info.left / 3.5)} coffees left`, false];
  if (info.pctLeft >= 70 && info.daysLeft <= 3) return ["on track", false];
  return [info.perDay > 0 ? `about ${cur(Math.floor(info.perDay))} a day` : "", false];
}
export function envFor(e, p = period()) { const info = C.envPeriod(S(), e, p, app.today); const [note, warn] = envNote(e, info); return envCard(e, info, { note, warn }); }

function fundLine(f, p) {
  const fp = C.fundPlan(S(), f, p);
  if (f.done) return "Done. Well saved";
  if (fp.remaining <= 0) return "Goal reached";
  if (fp.late) return `Goal date passed. ${cur(fp.remaining)} to go`;
  if (f.date && fp.per > 0) return `${cur(fp.per)} a payday until ${esc(fdShort(f.date))}`;
  if (fp.per > 0) return `${cur(fp.per)} a payday${fp.finish ? `, done around ${esc(fdShort(fp.finish))}` : ""}`;
  return `${cur(fp.remaining)} to go`;
}

// ---------------- BINDER ----------------
function binder() {
  const P = S().profile, p = period(), envs = liveEnvs();
  const title = `<div class="head"><div><h1 class="title">${P.name ? `${esc(P.name)}’s` : "Your"} <em class="it">binder</em></h1><div class="sub">Pay period ${esc(rangeText(p))} · <b>${pl(C.daysLeft(p, app.today), "day", "days")} left</b></div></div>
    <div class="btns"><button type="button" class="btn ghost" data-act="spend">${ic("spend")}Spend</button><button type="button" class="btn" data-act="nav" data-view="stuff">${ic("env")}Stuff payday</button></div></div>`;
  if (!envs.length) return `${title}<div class="banner"><div><b class="fr">Your binder is empty</b><p>Make your first envelopes: rent, groceries, fun money. Mark each one cash (in your binder) or card (stays in the bank).</p></div><button type="button" class="btn" data-act="env-new">${ic("plus")}New envelope</button></div>`;
  const plan = C.stuffPlan(S(), p), sm = C.periodSummary(S(), p, app.today), saved = C.savedThisYear(S(), Number(app.today.slice(0, 4)));
  const banners = [];
  if (plan.rows.length && !plan.allDone) banners.push(`<div class="banner"><div><b class="fr">${plan.stuffed ? `${cur(plan.toGo)} still to stuff` : "It's payday"}</b><p>${plan.stuffed ? "Finish stuffing this payday's envelopes." : `Give every ${esc(currencyWord())} a job: stuff ${cur(plan.planned)} into your envelopes.`}</p></div><button type="button" class="btn" data-act="nav" data-view="stuff">${ic("env")}Stuff payday</button></div>`);
  const u = unstuffDue();
  if (u) banners.push(`<div class="banner"><div><b class="fr">Unstuff day</b><p>${cur(u.total)} is still in your envelopes from ${esc(rangeText(u.p))}. Keep it, save it or pay off debt.</p></div><button type="button" class="btn ghost" data-act="unstuff" data-when="${u.which}">Unstuff</button></div>`);
  const tot = Math.max(1, sm.spent + sm.left + sm.putAway), w = x => ((x / tot) * 100).toFixed(1) + "%";
  const cash = envs.filter(e => e.kind === "cash").length;
  const ledger = `<div class="ledger"><div class="ltop"><span>${sm.stuffed ? `This payday you stuffed<b class="fr">${m(sm.stuffed)}</b>${plan.unassigned === 0 && plan.allDone ? "and every " + esc(currencyWord()) + " has a job" : ""}` : "Nothing stuffed yet this payday"}</span><span>Saved this year<b class="fr"><span class="m num">${esc(fmtR(saved))}</span></b></span></div>
    <div class="lbar"><i class="k1" style="width:${w(sm.spent)}"></i><i class="k2" style="width:${w(sm.left)}"></i><i class="k3" style="width:${w(sm.putAway)}"></i></div>
    <div class="lkeys"><span><i class="k1"></i>Spent <b>${m(sm.spent)}</b></span><span><i class="k2"></i>Left in envelopes <b>${m(sm.left)}</b>${sm.leftCash && sm.leftCash !== sm.left ? `<span>(${m(sm.leftCash)} in cash)</span>` : ""}</span><span><i class="k3"></i>Put away <b>${m(sm.putAway)}</b></span></div></div>`;
  const grid = `<div class="sec"><h2>Envelopes</h2><span>${cash} cash · ${envs.length - cash} card${sm.leftCash ? ` · ${m(sm.leftCash)} cash in your binder` : ""}</span></div>
    <div class="binder">${envs.map(e => envFor(e, p)).join("")}<button type="button" class="env addnew" data-act="env-new">${ic("plus")}New envelope</button></div>`;
  return `${title}${banners.join("")}${ledger}${grid}<div class="lower">${fundsMini(p)}${nextPaydayMini(p)}${challengeMini()}</div>`;
}
const currencyWord = () => ({ EUR: "euro", USD: "dollar", GBP: "pound", CAD: "dollar", AUD: "dollar", NZD: "dollar", CHF: "franc", INR: "rupee", ZAR: "rand", PLN: "złoty", MXN: "peso", PHP: "peso", BRL: "real", SGD: "dollar" }[S().profile.currency] || "penny");

export function unstuffDue() {
  const p = period(), prev = C.prevPeriod(S().pay, p), done = S().meta.unstuffed || {};
  const leftIn = q => C.sum(liveEnvs(), e => Math.max(0, C.balance(S(), e.id, q.end)));
  if (C.daysLeft(p, app.today) <= 1 && !done[p.start]) { const t = C.sum(liveEnvs(), e => Math.max(0, C.envPeriod(S(), e, p, app.today).left)); if (t > 0) return { p, total: t, which: "this" }; }
  if (C.diffDays(p.start, app.today) <= 3 && !done[prev.start] && prev.start >= String(S().meta.createdAt).slice(0, 10)) { const t = leftIn(prev); if (t > 0) return { p: prev, total: t, which: "prev" }; }
  return null;
}

function fundsMini(p) {
  const fs = S().funds.filter(f => !f.done);
  const total = C.sum(S().funds, f => C.balance(S(), f.id));
  return `<section><div class="sec"><h2>Sinking funds</h2><span>${m(total)} saved</span></div>
    ${fs.length ? fs.slice(0, 5).map(f => { const fp = C.fundPlan(S(), f, p); return `<button type="button" class="fund" data-act="open-fund" data-id="${f.id}"><div class="frow"><span class="nm"><b>${esc(f.name)}</b>${ic(f.kind === "card" ? "card" : "cash")}</span><span class="v">${m(fp.saved)}${f.goal ? `<small>of ${esc(cur(f.goal))}</small>` : ""}</span></div><span class="line"><i style="width:${f.goal ? Math.min(100, fp.saved / f.goal * 100).toFixed(1) : 0}%"></i></span><div class="fsub">${fundLine(f, p)}</div></button>`; }).join("")
      + (fs.length > 5 ? `<button type="button" class="act" data-act="nav" data-view="funds">All ${fs.length} funds</button>` : "")
      : `<div class="empty">Christmas, the car, a holiday: save a little each payday so big costs never surprise you.<div class="row-btns" style="justify-content:center"><button type="button" class="btn soft small" data-act="fund-new">${ic("plus")}New fund</button></div></div>`}</section>`;
}

export function groupRows(plan) {
  const out = [];
  for (const [g, label] of [...C.GROUPS, ["savings", "Savings"]]) {
    const rows = plan.rows.filter(r => r.group === g); if (!rows.length) continue;
    const names = rows.map(r => r.name), nm = names.length <= 3 ? names.join(names.length === 2 ? " + " : ", ").toLowerCase().replace(/^./, c => c.toUpperCase()) : `${label} (${names.length})`;
    out.push({ g, label, name: nm, amount: C.sum(rows, r => r.done ?? r.suggested) });
  }
  return out;
}
export function cashItems(plan, draft = {}) { return plan.rows.filter(r => r.cash).map(r => ({ name: r.name, amount: r.done ?? draft[r.id] ?? r.suggested })); }
export function notesHTML(list) { return `<div class="notes">${list.total.map(x => `<span class="bn${x.coin ? " coin" : ""}">${esc(cur(x.v))}<small>× ${x.n}</small></span>`).join("")}</div>`; }

function nextPaydayMini(p) {
  const np = C.nextPeriod(S().pay, p), plan = C.stuffPlan(S(), np), groups = groupRows(plan);
  const L = C.cashList(cashItems(plan), S().profile.currency, S().profile.maxNote);
  return `<section><div class="sec"><h2>Next payday</h2><span>${esc(fd(np.start))} · ${m(plan.income || plan.planned)}</span></div>
    ${groups.map(g => `<div class="prow"><span>${esc(g.name)}</span><span class="v">${m(g.amount)}</span></div>`).join("") || `<div class="empty">No envelopes to stuff yet.</div>`}
    ${L && L.amount > 0 ? `<div class="bank">Ask the bank for <b>${m(L.amount)} in cash</b></div>${notesHTML(L)}` : ""}</section>`;
}

function challengeMini() {
  const c = S().challenges[0];
  if (!c) return `<section><div class="sec"><h2>Challenges</h2></div><div class="empty">Tick your way to savings: 100 envelopes, 52 weeks or your own.<div class="row-btns" style="justify-content:center"><button type="button" class="btn soft small" data-act="ch-new">${ic("plus")}Start a challenge</button></div></div></section>`;
  const pick = c.pick && c.pick.date === app.today && !(c.pick.i in c.done) ? c.pick.i : null;
  return `<section><div class="sec"><h2>${esc(c.name)}</h2><span>${C.challengeCount(c)} of ${c.cells.length}</span></div>
    <div class="g100" style="grid-template-columns:repeat(${c.cells.length > 60 ? 10 : 8},1fr)">${c.cells.map((v, i) => `<button type="button" class="${i in c.done ? "on" : i === pick ? "pick" : ""}" data-act="ch-cell" data-c="${c.id}" data-i="${i}" aria-label="${esc(cur(v))}${i in c.done ? ", done" : ""}">${c.type === "custom" || c.type === "save1000" ? esc(cur(v)) : i + 1}</button>`).join("")}</div>
    <div class="gfoot"><span><b class="fr">${m(C.challengeSaved(c))}</b> saved</span><span>${pick != null ? `Today: envelope ${pick + 1}` : `of ${esc(cur(C.challengeTotal(c)))}`}</span></div></section>`;
}

// ---------------- STUFF PAYDAY ----------------
function stuff() {
  const p = stuffPeriod(), plan = C.stuffPlan(S(), p), draft = (app.stuffDraft ||= {})[p.start] ||= {};
  const target = plan.income || plan.planned;
  const pctv = plan.planned > 0 ? Math.min(100, (plan.stuffed / plan.planned) * 100) : 0;
  const jobs = plan.unassigned === 0 ? `<div class="jobs">Every ${esc(currencyWord())} has a job.</div>` : plan.unassigned > 0 ? `<div class="jobs r">${m(plan.unassigned)} doesn't have a job yet. Give it to an envelope or a fund.</div>` : `<div class="jobs r">That's ${m(-plan.unassigned)} more than this pay. Lower an envelope or two.</div>`;
  const groups = [...C.GROUPS, ["savings", "Sinking funds"]].map(([g, label]) => {
    const rows = plan.rows.filter(r => r.group === g); if (!rows.length) return "";
    return `<div class="ghead">${esc(label)}</div>${rows.map(r => {
      const ticked = r.done != null, val = ticked ? r.done : (draft[r.id] ?? r.suggested);
      return `<div class="srow${ticked ? " ticked" : ""}"><button type="button" class="cb" data-act="stuff-tick" data-type="${r.type}" data-id="${r.id}" aria-pressed="${ticked}" aria-label="${ticked ? "Stuffed" : "Stuff"} ${esc(r.name)}">${ticked ? ic("check") : ""}</button>
        <span class="nm"><span>${esc(r.name)}</span>${ic(r.cash ? "cash" : "card")}${r.carried > 0 && !ticked ? `<span class="carried">+ ${esc(cur(r.carried))} still inside</span>` : ""}</span>
        <input class="amtin m" data-live="stuff-amt" data-id="${r.id}" inputmode="decimal" value="${esc(cur(val))}" aria-label="Amount for ${esc(r.name)}"></div>`;
    }).join("")}`;
  }).join("");
  const L = C.cashList(cashItems(plan, draft), S().profile.currency, S().profile.maxNote);
  const D = C.DENOMS[S().profile.currency];
  const cashPanel = !plan.rows.some(r => r.cash) ? "" : L ? `<div class="panel"><h3>Cash for your binder</h3><div class="row"><span class="muted small">Ask the bank for</span><b class="fr" style="font-size:1.6rem">${m(L.amount)}</b></div>${notesHTML(L)}
      <div class="per">${L.per.map(x => `<div><span>${esc(x.name)}</span><b>${x.parts.map(q => `${q.n} × ${esc(cur(q.v))}`).join(", ")}</b></div>`).join("")}</div>
      <label class="field" style="margin:1rem 0 0"><span>Biggest note I want</span><select class="input" data-live="max-note">${D.notes.map(v => `<option value="${v}"${(S().profile.maxNote || D.max) === v ? " selected" : ""}>${esc(cur(v))}</option>`).join("")}</select></label></div>`
    : `<div class="panel"><h3>Cash for your binder</h3><p class="small muted">${m(C.sum(cashItems(plan, draft), x => x.amount))} in cash. The note list works for EUR, USD, GBP, CAD, AUD, NZD and CHF.</p></div>`;
  return `<div class="head"><div><h1 class="title">Stuff <em class="it">${m(target)}</em></h1><div class="sub">Payday · <b>${esc(fdLong(p.start))}</b></div></div>
    <div class="seg" role="group" aria-label="Which payday"><button type="button" data-act="stuff-which" data-v="this" aria-pressed="${app.stuffWhich !== "next"}">This payday</button><button type="button" data-act="stuff-which" data-v="next" aria-pressed="${app.stuffWhich === "next"}">Next payday</button></div></div>
  <div class="stuff"><div>
    <label class="payin">Pay this time<input class="input m" data-live="pay-in" inputmode="decimal" value="${esc(cur(plan.income))}" aria-label="Pay this time"></label>
    <div class="pbar"><i style="width:${pctv.toFixed(1)}%"></i></div><div class="pmeta"><span><b>${m(plan.stuffed)}</b> stuffed</span><span><b>${m(plan.toGo)}</b> to go</span></div>
    ${jobs}
    ${plan.rows.length ? groups : `<div class="empty" style="margin-top:1.4rem">Make envelopes first, then stuff them here every payday.<div class="row-btns" style="justify-content:center"><button type="button" class="btn soft small" data-act="env-new">${ic("plus")}New envelope</button></div></div>`}
    <div class="row-btns" style="margin-top:1.4rem">${plan.rows.length && !plan.allDone ? `<button type="button" class="btn" data-act="stuff-all">${ic("check")}Stuff everything</button>` : ""}<button type="button" class="btn ghost" data-act="env-new">${ic("plus")}New envelope</button><button type="button" class="btn ghost" data-act="fund-new">${ic("plus")}New fund</button></div>
  </div><div class="side">${cashPanel}
    <div class="panel"><h3>Your stuffing card</h3><p class="small muted" style="margin-bottom:.9rem">A picture of this payday for your story: what you stuffed and where it went.</p><button type="button" class="btn soft full" data-act="story-card">${ic("star")}Make my card</button></div>
    <div class="panel"><h3>End of the pay period</h3><p class="small muted" style="margin-bottom:.9rem">Money left in an envelope stays there for next time, unless you unstuff it into savings or debt.</p><button type="button" class="btn ghost full" data-act="unstuff" data-when="this">Unstuff now</button></div>
  </div></div>`;
}

// ---------------- SINKING FUNDS ----------------
function funds() {
  const p = period(), live = S().funds.filter(f => !f.done), done = S().funds.filter(f => f.done);
  const total = C.sum(S().funds, f => C.balance(S(), f.id)), per = C.sum(live, f => C.fundPlan(S(), f, p).per);
  const card = f => { const fp = C.fundPlan(S(), f, p); return envCard(f, { left: fp.saved, budget: f.goal }, { act: "open-fund", fund: true, word: "saved of", note: fundLine(f, p) }); };
  return `<div class="head"><div><h1 class="title">Sinking <em class="it">funds</em></h1><div class="sub">${m(total)} saved in ${pl(S().funds.length, "fund", "funds")}${per ? ` · <b>${m(per)}</b> each payday` : ""}</div></div>
    <div class="btns"><button type="button" class="btn" data-act="fund-new">${ic("plus")}New fund</button></div></div>
    <p class="sub" style="max-width:42rem;margin:1rem 0 1.8rem">Big costs you know are coming. Give each one a goal and a date, and the app works out what to stuff every payday.</p>
    ${live.length ? `<div class="cards">${live.map(card).join("")}</div>` : `<div class="empty">No funds yet. Christmas, car, holiday, birthdays, emergency: start with one.</div>`}
    ${done.length ? `<div class="sec" style="margin-top:2.4rem"><h2>Done</h2></div><div class="cards">${done.map(card).join("")}</div>` : ""}`;
}

// ---------------- CHALLENGES ----------------
function challenges() {
  const list = S().challenges, c = list.find(x => x.id === app.chId) || list[0];
  const head = `<div class="head"><div><h1 class="title">Savings <em class="it">challenges</em></h1><div class="sub">Tick a box each time you put the money aside.</div></div><div class="btns"><button type="button" class="btn" data-act="ch-new">${ic("plus")}New challenge</button></div></div>`;
  if (!c) return `${head}<div class="empty" style="margin-top:2rem">Start a challenge: 100 envelopes, 52 weeks, Save 1,000, or your own.<div class="row-btns" style="justify-content:center"><button type="button" class="btn" data-act="ch-new">Start one</button></div></div>`;
  const pick = c.pick && c.pick.date === app.today && !(c.pick.i in c.done) ? c.pick.i : null, total = C.challengeTotal(c), saved = C.challengeSaved(c);
  const label = (v, i) => (c.type === "custom" || c.type === "save1000" ? esc(cur(v)) : i + 1);
  const cols = c.cells.length > 60 ? 10 : c.cells.length > 30 ? 8 : 6;
  return `${head}<div class="chtabs">${list.map(x => `<button type="button" class="chip" data-act="ch-show" data-id="${x.id}" aria-pressed="${x.id === c.id}">${esc(x.name)}</button>`).join("")}</div>
    <div class="chwrap"><div class="g100 big" style="grid-template-columns:repeat(${cols},1fr)">${c.cells.map((v, i) => `<button type="button" class="${i in c.done ? "on" : i === pick ? "pick" : ""}" data-act="ch-cell" data-c="${c.id}" data-i="${i}" aria-label="${esc(cur(v))}${i in c.done ? ", done" : ""}">${label(v, i)}</button>`).join("")}</div>
    <div><div class="chtot"><b class="fr">${m(saved)}</b><span>saved of ${m(total)}</span></div><div class="pbar"><i style="width:${(total ? saved / total * 100 : 0).toFixed(1)}%;background:var(--gold)"></i></div>
      <p class="sub">${C.challengeCount(c)} of ${c.cells.length} done. ${esc(C.CHALLENGES[c.type]?.blurb || "")} ${m(total)}.</p>
      <div class="row-btns">${pick != null ? `<button type="button" class="btn" data-act="ch-cell" data-c="${c.id}" data-i="${pick}">Stuff ${c.type === "custom" || c.type === "save1000" ? esc(cur(c.cells[pick])) : `envelope ${pick + 1}`} today</button><button type="button" class="btn ghost" data-act="ch-pick" data-c="${c.id}">Pick another</button>` : C.challengeCount(c) < c.cells.length ? `<button type="button" class="btn" data-act="ch-pick" data-c="${c.id}">Pick one for me</button>` : `<b class="fr" style="font-size:1.3rem;color:var(--good)">All done. What a saver.</b>`}</div>
      <div class="row-btns"><button type="button" class="btn text small" data-act="ch-rename" data-c="${c.id}">Rename</button><button type="button" class="btn text small" data-act="ch-del" data-c="${c.id}">Delete this challenge</button></div></div></div>`;
}

// ---------------- YEAR ----------------
function year() {
  const years = [...new Set([Number(app.today.slice(0, 4)), ...S().tx.map(t => Number(t.date.slice(0, 4)))])].sort((a, b) => b - a);
  const Y = app.yearSel || years[0], st = C.yearStats(S(), Y);
  const max = Math.max(1, ...st.months.map(x => Math.max(x.spent, x.saved)));
  const h = v => ((v / max) * 100).toFixed(1) + "%";
  const topMax = Math.max(1, ...st.top.map(x => x.spent));
  return `<div class="head"><div><h1 class="title">Your <em class="it">${Y}</em></h1><div class="sub">Everything you stuffed, spent and saved.</div></div>
    ${years.length > 1 ? `<select class="input" style="width:auto" data-live="year-sel">${years.map(y => `<option${y === Y ? " selected" : ""}>${y}</option>`).join("")}</select>` : ""}</div>
    <div class="stats"><div class="stat"><small>Stuffed</small><b>${mr(st.stuffed)}</b><span>into envelopes and funds</span></div><div class="stat"><small>Spent</small><b>${mr(st.spent)}</b><span>from your envelopes</span></div>
    <div class="stat"><small>Saved</small><b>${mr(st.saved)}</b><span>funds and challenges</span></div><div class="stat"><small>Paid to debt</small><b>${mr(st.debt)}</b><span>from unstuffing</span></div></div>
    <div class="chart">${st.months.map((x, i) => `<div class="mo"><i style="height:${h(x.spent)};background:var(--plum)"></i><i style="height:${h(x.saved)};background:var(--gold)"></i><span>${esc(fMonthShort(`${Y}-${String(i + 1).padStart(2, "0")}`))}</span></div>`).join("")}</div>
    <div class="legend"><span><i style="background:var(--plum)"></i>Spent</span><span><i style="background:var(--gold)"></i>Saved</span></div>
    <div class="two"><section><div class="sec"><h2>Where it went</h2></div>${st.top.length ? st.top.map(x => `<div class="fund"><div class="frow"><span class="nm"><b>${esc(x.env.name)}</b>${ic(x.env.kind === "card" ? "card" : "cash")}</span><span class="v">${mr(x.spent)}</span></div><span class="line"><i style="width:${(x.spent / topMax * 100).toFixed(1)}%"></i></span></div>`).join("") : `<div class="empty">Nothing spent yet this year.</div>`}</section>
    <section><div class="sec"><h2>Unstuffed</h2></div><div class="prow"><span>Into savings</span><span class="v">${mr(st.unstuffSaved)}</span></div><div class="prow"><span>To debt</span><span class="v">${mr(st.unstuffDebt)}</span></div>
      <div class="sec" style="margin-top:1.8rem"><h2>Challenges</h2></div>${S().challenges.map(c => `<div class="prow"><span>${esc(c.name)} <small class="muted">${C.challengeCount(c)} of ${c.cells.length}</small></span><span class="v">${mr(C.challengeSaved(c, `${Y}-12-31`, `${Y}-01-01`))}</span></div>`).join("") || `<p class="small muted">No challenges yet.</p>`}
      <div class="row-btns"><button type="button" class="btn ghost small" data-act="export-csv">Export everything (CSV)</button></div></section></div>`;
}

// ---------------- SETTINGS ----------------
function settings() {
  const P = S().profile, pay = S().pay, tg = (act, on, label, sub = "") => `<button type="button" class="toggle" data-act="${act}" aria-pressed="${!!on}"><span>${label}${sub ? `<small>${sub}</small>` : ""}</span><i></i></button>`;
  const D = C.DENOMS[P.currency];
  const archived = S().envelopes.filter(e => e.archived);
  return `<div class="head"><div><h1 class="title">Settings</h1><div class="sub">Everything stays on this device. Nobody else sees your numbers.</div></div></div>
  <div class="set">
  <section><h2>Your binder</h2><div class="looks">${Object.entries(LOOKS).map(([k, [n, sw, mt]]) => `<button type="button" class="look" data-act="set-look" data-v="${k}" aria-pressed="${P.look === k}" style="--sw:${sw};--mt:${mt}"><i></i>${n}</button>`).join("")}</div>
    <div style="margin-top:1rem">${tg("set-dark", P.dark, "Dark mode", "The same binder for night")}${tg("set-big", P.bigText, "Bigger text")}${tg("set-easy", P.easyFont, "Easy-reading font")}${tg("set-hide", P.hide, "Hide amounts", "Blurs every number, for when someone looks over your shoulder")}</div></section>
  <section><h2>You</h2><form data-form="profile"><div class="row2"><label class="field"><span>Your name</span><input class="input" name="name" value="${esc(P.name)}" autocomplete="given-name"></label>
    <label class="field"><span>Currency</span><select class="input" name="currency">${CURRENCIES.map(([c, l]) => `<option value="${c}"${c === P.currency ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label></div>
    ${D ? `<label class="field"><span>Biggest note you want from the bank</span><select class="input" name="maxNote">${D.notes.map(v => `<option value="${v}"${(P.maxNote || D.max) === v ? " selected" : ""}>${esc(cur(v))}</option>`).join("")}</select><small>Smaller notes make it easier to fill each envelope exactly.</small></label>` : ""}
    <button class="btn small" type="submit">Save</button></form></section>
  <section><h2>Pay</h2><form data-form="pay">${payFields(pay)}<button class="btn small" type="submit">Save</button></form></section>
  <section><h2>Stuffing</h2>${tg("set-topup", P.stuffMode === "topup", "Top up instead of adding", "On payday, fill each envelope back up to its amount instead of adding the full amount on top of what's left")}</section>
  <section><h2>Envelopes</h2><div class="list">${liveEnvs().map(e => `<button type="button" class="li" data-act="env-edit" data-id="${e.id}"><span class="t">${ic(e.kind === "card" ? "card" : "cash")}<span>${esc(e.name)}<small>${esc(C.groupName(e.group))} · ${m(e.amount)} each payday</small></span></span>${ic("pencil")}</button>`).join("")}</div>
    ${archived.length ? `<p class="small muted" style="margin-top:1rem">Put away: ${archived.map(e => `<button type="button" class="act" data-act="env-edit" data-id="${e.id}">${esc(e.name)}</button>`).join(", ")}</p>` : ""}
    <div class="row-btns"><button type="button" class="btn soft small" data-act="env-new">${ic("plus")}New envelope</button></div></section>
  <section><h2>Your data</h2><p class="small muted" style="margin-bottom:.8rem">${S().meta.lastBackup ? `Last backup ${esc(fd(S().meta.lastBackup.slice(0, 10)))}.` : "No backup yet. Make one now and then, and keep it in Files, Drive or email."}</p>
    <div class="row-btns"><button type="button" class="btn small" data-act="backup">Back up</button><button type="button" class="btn ghost small" data-act="restore">Restore from a backup</button><button type="button" class="btn ghost small" data-act="move-phone">${ic("phone")}Move to another device</button><button type="button" class="btn ghost small" data-act="export-csv">Export (CSV)</button><button type="button" class="btn ghost small" data-act="install-help">Put it on my home screen</button></div></section>
  <section><h2>About</h2><p class="small muted">Little Envelopes ${APP_VERSION} by Dear Agneta. Questions or ideas? Message the shop on Etsy. <a href="${ETSY_URL}" target="_blank" rel="noopener">Visit the shop</a></p>
    <div class="row-btns"><button type="button" class="btn text small" data-act="wipe">Delete everything on this device</button></div></section>
  </div>`;
}
export function payFields(pay) {
  const R = pay.rhythm, d = pay.days || [1, 15];
  return `<label class="field"><span>How often are you paid?</span><select class="input" name="rhythm" data-live="rhythm">${Object.entries(C.RHYTHMS).map(([k, r]) => `<option value="${k}"${k === R ? " selected" : ""}>${esc(r.label)}</option>`).join("")}</select></label>
    ${C.RHYTHMS[R]?.step ? `<label class="field"><span>Your last payday</span><input class="input" type="date" name="anchor" value="${esc(pay.anchor || app.today)}"></label>` : ""}
    ${R === "monthly" ? `<label class="field"><span>Day of the month</span><input class="input" name="day" inputmode="numeric" value="${esc(pay.day || 25)}"><small>On short months it moves to the last day.</small></label>` : ""}
    ${R === "semimonthly" ? `<div class="row2"><label class="field"><span>First payday</span><input class="input" name="d1" inputmode="numeric" value="${esc(d[0])}"></label><label class="field"><span>Second payday</span><input class="input" name="d2" inputmode="numeric" value="${esc(d[1])}"></label></div>` : ""}
    <label class="field"><span>Usual pay</span><input class="input" name="amount" inputmode="decimal" value="${esc(pay.amount ? cur(pay.amount) : "")}" placeholder="What lands in your account"><small>You can change it for one payday on the stuffing page.</small></label>`;
}

// ---------------- MORE (phone) ----------------
function more() {
  const item = (act, view, icon, t, s) => `<button type="button" class="li" data-act="${act}"${view ? ` data-view="${view}"` : ""}><span class="t">${ic(icon)}<span>${t}<small>${s}</small></span></span>${ic("arrow")}</button>`;
  return `<div class="head"><div><h1 class="title">More</h1></div></div><div class="list" style="margin-top:1.2rem">
    ${item("nav", "funds", "jar", "Sinking funds", `${S().funds.length} funds`)}${item("nav", "year", "year", "Your year", "Stuffed, spent, saved")}${item("unstuff", "", "swap", "Unstuff", "Move leftovers into savings or debt")}
    ${item("story-card", "", "star", "Stuffing card", "A picture of this payday for your story")}${item("nav", "settings", "sliders", "Settings", "Look, pay, envelopes, backup")}${item("install-help", "", "phone", "Home screen", "Put Little Envelopes on your phone")}</div>`;
}

export const views = { binder, stuff, funds, challenges, year, settings, more };
