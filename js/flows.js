// Little Envelopes — everything you can tap: spending, borrowing, stuffing, unstuffing, funds, challenges, settings, unlock and setup.
import * as C from "./calc.js";
import { app, actions, forms, live, esc, render, commit, toast, openSheet, updateSheet, closeSheet, sheetHead, parseMoney, shareOrDownload, pickFile, fd, fdShort, isIOS, isStandalone } from "./core.js";
import { ic, m, cur, brand, envCard, rangeText } from "./ui.js";
import { period, stuffPeriod, envFor, unstuffDue, payFields, LOOKS, ETSY_URL } from "./views.js";
import { blankState, normalise, uid, newEnvelope, newFund, CURRENCIES, ENVELOPE_IDEAS, FUND_IDEAS } from "./model.js";
import { storyCard } from "./card.js";
import * as store from "./store.js";

const S = () => app.S;
const num = v => { const n = parseMoney(v); return isFinite(n) ? Math.round(n * 100) / 100 : null; };
const val = (f, n) => f.elements[n]?.value ?? "";
const envById = id => S().envelopes.find(e => e.id === id);
const fundById = id => S().funds.find(f => f.id === id);
const thing = id => envById(id) || fundById(id);
const addTx = (s, t) => { const x = { id: uid(), date: app.today, note: "", ...t, amount: C.round2(t.amount) }; s.tx.push(x); return x.id; };
const undoTx = ids => () => commit(s => { s.tx = s.tx.filter(t => !ids.includes(t.id)); });
const leftNow = id => (envById(id) ? C.envPeriod(S(), envById(id), period(), app.today).left : C.balance(S(), id));

// ============ Navigation and looks ============
actions["nav"] = el => { app.view = el.dataset.view; render(); scrollTo({ top: 0 }); };
actions["close-sheet"] = () => closeSheet();
export function applyLook() {
  const P = S()?.profile || {}, h = document.documentElement;
  h.dataset.look = P.look in LOOKS ? P.look : "strawberry";
  for (const [k, on] of [["data-dark", P.dark], ["data-big", P.bigText], ["data-easy", P.easyFont], ["data-hide", P.hide]]) on ? h.setAttribute(k, "") : h.removeAttribute(k);
  const mt = document.querySelector('meta[name="theme-color"]');
  if (mt) mt.content = getComputedStyle(h).getPropertyValue("--leather").trim() || "#E7B3C1";
}
actions["set-look"] = el => commit(s => { s.profile.look = el.dataset.v; applyLook(); });
for (const [a, k] of [["set-dark", "dark"], ["set-big", "bigText"], ["set-easy", "easyFont"], ["set-hide", "hide"]]) actions[a] = () => commit(s => { s.profile[k] = !s.profile[k]; applyLook(); });
actions["set-topup"] = () => commit(s => { s.profile.stuffMode = s.profile.stuffMode === "topup" ? "add" : "topup"; });

// ============ Spending ============
function spendForm(id) {
  const e = envById(id), info = e ? C.envPeriod(S(), e, period(), app.today) : null;
  return `<form data-form="spend" data-id="${id || ""}"><label class="field"><span>How much${e ? ` from ${esc(e.name)}` : ""}?</span><input class="input big" name="amount" inputmode="decimal" placeholder="0.00" autocomplete="off" autofocus required></label>
    <div class="row2"><label class="field"><span>What for? <span class="muted">(optional)</span></span><input class="input" name="note" maxlength="60"></label><label class="field"><span>When</span><input class="input" type="date" name="date" value="${app.today}" max="${app.today}"></label></div>
    <button class="btn full" type="submit">${ic("spend")}Spend${info ? ` <span class="small" style="opacity:.8;font-weight:700">(${esc(cur(Math.max(0, info.left)))} inside)</span>` : ""}</button></form>`;
}
actions["spend"] = el => {
  const live = S().envelopes.filter(e => !e.archived);
  if (!live.length) return toast("Make an envelope first.");
  app.spendEnv = el?.dataset?.id || (live.find(e => e.id === app.spendEnv) ? app.spendEnv : (live.find(e => e.kind === "cash") || live[0]).id);
  openSheet(spendSheet(), { label: "Spend" });
};
function spendSheet() {
  const p = period();
  return `${sheetHead("Spend")}<div class="pickenv">${S().envelopes.filter(e => !e.archived).map(e => { const l = C.envPeriod(S(), e, p, app.today).left; return `<button type="button" data-act="spend-pick" data-id="${e.id}" aria-pressed="${e.id === app.spendEnv}">${esc(e.name)}<small>${esc(cur(l))} inside</small></button>`; }).join("")}</div>${spendForm(app.spendEnv)}`;
}
actions["spend-pick"] = el => { const f = document.querySelector('form[data-form="spend"]'), keep = f ? { a: val(f, "amount"), n: val(f, "note"), d: val(f, "date") } : null; app.spendEnv = el.dataset.id; updateSheet(spendSheet()); const g = document.querySelector('form[data-form="spend"]'); if (g && keep) { g.elements.amount.value = keep.a; g.elements.note.value = keep.n; g.elements.date.value = keep.d; } };
forms["spend"] = f => {
  const id = f.dataset.id, a = num(val(f, "amount")), note = val(f, "note").trim(), date = val(f, "date") || app.today;
  if (!id || !(a > 0)) return toast("Type an amount first.");
  const left = leftNow(id);
  if (a > Math.max(0, left) + 0.001 && envById(id)) return borrowPrompt(id, a, note, date, left);
  doSpend(id, a, note, date);
};
function doSpend(id, a, note, date, extra = []) {
  let tid; commit(s => { tid = addTx(s, { kind: "spend", env: id, amount: a, note, date }); });
  closeSheet();
  toast(`Spent ${cur(a)} from ${thing(id)?.name}. ${cur(leftNow(id))} left.`, undoTx([tid, ...extra]));
}
function borrowPrompt(id, a, note, date, left) {
  const short = C.round2(a - Math.max(0, left)), e = envById(id), p = period();
  const from = [...S().envelopes.filter(x => !x.archived && x.id !== id).map(x => [x, C.envPeriod(S(), x, p, app.today).left]), ...S().funds.filter(f => !f.done).map(f => [f, C.balance(S(), f.id)])].filter(([, l]) => l > 0);
  app.pending = { id, a, note, date, short };
  updateSheet(`${sheetHead("Not enough inside", "Cancel")}<p style="font-weight:700;margin-bottom:1rem">${esc(e.name)} has ${m(Math.max(0, left))}. Borrow the other <b>${m(short)}</b> from:</p>
    <div class="pickenv">${from.map(([x, l]) => `<button type="button" data-act="borrow-cover" data-from="${x.id}"${l < short ? ' disabled style="opacity:.45"' : ""}>${esc(x.name)}<small>${esc(cur(l))} inside</small></button>`).join("") || `<p class="small muted">No other envelope has money in it right now.</p>`}</div>
    <button type="button" class="btn ghost full" data-act="spend-anyway">Spend anyway (${esc(e.name)} goes below zero)</button>`);
}
actions["borrow-cover"] = el => {
  const q = app.pending; if (!q) return;
  let mid; commit(s => { mid = addTx(s, { kind: "move", from: el.dataset.from, to: q.id, amount: q.short, note: q.note ? `For ${q.note}` : "Borrowed", date: q.date }); }, { render: false });
  doSpend(q.id, q.a, q.note, q.date, [mid]);
};
actions["spend-anyway"] = () => { const q = app.pending; if (q) doSpend(q.id, q.a, q.note, q.date); };

// ============ One envelope ============
const KIND_LABEL = { stuff: "Stuffed", add: "Added", spend: "Spent", move: "Moved", unstuff: "Unstuffed", fix: "Counted" };
function histRow(t, id) {
  const d = C.delta(t, id) / 100, other = t.kind === "move" ? thing(t.from === id ? t.to : t.from)?.name : t.kind === "unstuff" ? (t.to === "debt" ? "debt" : t.to === "out" ? "taken out" : thing(t.to)?.name) : "";
  const label = t.kind === "move" ? (d > 0 ? `Borrowed from ${other}` : `Lent to ${other}`) : t.kind === "unstuff" ? `Unstuffed${other ? ` to ${other}` : ""}` : KIND_LABEL[t.kind];
  return `<div class="li"><span class="t"><span>${esc(t.note || label)}<small>${esc(fdShort(t.date))}${t.note ? ` · ${esc(label)}` : ""}</small></span></span><span style="display:flex;align-items:center;gap:.5rem"><b class="num${d < 0 ? "" : ""}">${d > 0 ? "+" : "−"}${m(Math.abs(d))}</b><button type="button" class="del" data-act="tx-del" data-tx="${t.id}" data-back="${id}" aria-label="Delete this entry">Delete</button></span></div>`;
}
export function envSheet(id) {
  const e = envById(id); if (!e) return;
  const p = period(), info = C.envPeriod(S(), e, p, app.today);
  const hist = S().tx.filter(t => C.touches(t, id) && t.date >= p.start && t.date <= p.end).sort((a, b) => b.date.localeCompare(a.date));
  return `${sheetHead(esc(e.name))}${envFor(e, p).replace(/^<button/, "<div").replace(/<\/button>$/, "</div>").replace(/ data-act="open-env"/, "")}
    <p class="small muted" style="margin:-.4rem 0 1.1rem">${info.stuffed ? `Stuffed ${esc(cur(info.stuffed))} on payday` : "Not stuffed yet this payday"}${info.carried ? ` · ${esc(cur(info.carried))} from before` : ""} · spent ${esc(cur(info.spent))} · ${info.daysLeft} ${info.daysLeft === 1 ? "day" : "days"} left</p>
    ${spendForm(id)}
    <div class="row-btns"><button type="button" class="btn soft small" data-act="env-add" data-id="${id}">${ic("plus")}Add money</button><button type="button" class="btn soft small" data-act="env-borrow" data-id="${id}">${ic("swap")}Borrow</button><button type="button" class="btn soft small" data-act="env-fix" data-id="${id}">Count it</button><button type="button" class="btn soft small" data-act="env-edit" data-id="${id}">${ic("pencil")}Edit</button></div>
    <div class="hist">${hist.length ? `<div class="ghead">This pay period</div><div class="list">${hist.map(t => histRow(t, id)).join("")}</div>` : ""}</div>`;
}
actions["open-env"] = el => { app.spendEnv = el.dataset.id; openSheet(envSheet(el.dataset.id), { label: "Envelope" }); };
actions["tx-del"] = el => {
  const t = S().tx.find(x => x.id === el.dataset.tx); if (!t) return;
  commit(s => { s.tx = s.tx.filter(x => x.id !== t.id); });
  const back = el.dataset.back;
  if (envById(back)) updateSheet(envSheet(back)); else if (fundById(back)) updateSheet(fundSheet(back));
  toast("Entry deleted.", () => { commit(s => s.tx.push(t)); if (envById(back)) updateSheet(envSheet(back)); else if (fundById(back)) updateSheet(fundSheet(back)); });
};
const amountSheet = (title, form, id, label, button, extra = "") => openSheet(`${sheetHead(title, "Cancel")}<form data-form="${form}" data-id="${id}"><label class="field"><span>${label}</span><input class="input big" name="amount" inputmode="decimal" placeholder="0.00" autofocus required></label>${extra}<label class="field"><span>Note <span class="muted">(optional)</span></span><input class="input" name="note" maxlength="60"></label><button class="btn full" type="submit">${button}</button></form>`, { label: title });
actions["env-add"] = el => amountSheet(`Add money to ${envById(el.dataset.id).name}`, "env-add", el.dataset.id, "How much are you putting in?", "Add it");
forms["env-add"] = f => { const id = f.dataset.id, a = num(val(f, "amount")); if (!(a > 0)) return; let t; commit(s => { t = addTx(s, { kind: "add", env: id, amount: a, note: val(f, "note").trim() }); }); closeSheet(); toast(`Added ${cur(a)} to ${thing(id).name}.`, undoTx([t])); };
actions["env-fix"] = el => { const e = envById(el.dataset.id), l = C.balance(S(), e.id); openSheet(`${sheetHead(`Count ${esc(e.name)}`, "Cancel")}<form data-form="env-fix" data-id="${e.id}"><p class="small muted" style="margin-bottom:1rem">The app thinks there's ${m(l)} inside. Count it and type what's really there; the difference is noted.</p><label class="field"><span>What's inside now</span><input class="input big" name="amount" inputmode="decimal" value="${esc(String(C.round2(l)))}" autofocus required></label><button class="btn full" type="submit">Save the count</button></form>`, { label: "Count" }); };
forms["env-fix"] = f => { const id = f.dataset.id, a = num(val(f, "amount")); if (a == null) return; const d = C.round2(a - C.balance(S(), id)); if (!d) { closeSheet(); return toast("Spot on. Nothing to change."); } let t; commit(s => { t = addTx(s, { kind: "fix", env: id, amount: d, note: "Counted" }); }); closeSheet(); toast(`${d > 0 ? "Found" : "Missing"} ${cur(Math.abs(d))}. Noted.`, undoTx([t])); };
actions["env-borrow"] = el => {
  const id = el.dataset.id, e = envById(id), p = period(), info = C.envPeriod(S(), e, p, app.today);
  const from = [...S().envelopes.filter(x => !x.archived && x.id !== id).map(x => [x, C.envPeriod(S(), x, p, app.today).left]), ...S().funds.filter(f => !f.done).map(f => [f, C.balance(S(), f.id)])].filter(([, l]) => l > 0);
  app.borrowFrom = from[0]?.[0].id;
  openSheet(`${sheetHead(`Borrow for ${esc(e.name)}`, "Cancel")}<p class="small muted" style="margin-bottom:.8rem">Take from another envelope. It's noted on both, so you can see where it went.</p>
    <div class="pickenv">${from.map(([x, l], i) => `<button type="button" data-act="borrow-pick" data-id="${x.id}" aria-pressed="${i === 0}">${esc(x.name)}<small>${esc(cur(l))} inside</small></button>`).join("") || `<p class="small muted">No other envelope has money in it right now.</p>`}</div>
    <form data-form="borrow" data-id="${id}"><label class="field"><span>How much?</span><input class="input big" name="amount" inputmode="decimal" value="${info.left < 0 ? esc(String(-info.left)) : ""}" placeholder="0.00" autofocus required></label><button class="btn full" type="submit"${from.length ? "" : " disabled"}>Borrow it</button></form>`, { label: "Borrow" });
};
actions["borrow-pick"] = el => { app.borrowFrom = el.dataset.id; document.querySelectorAll('[data-act="borrow-pick"]').forEach(b => b.setAttribute("aria-pressed", String(b === el))); };
forms["borrow"] = f => { const to = f.dataset.id, a = num(val(f, "amount")), from = app.borrowFrom; if (!(a > 0) || !from) return; let t; commit(s => { t = addTx(s, { kind: "move", from, to, amount: a, note: "Borrowed" }); }); closeSheet(); toast(`Borrowed ${cur(a)} from ${thing(from).name}.`, undoTx([t])); };

// ============ New and edit envelope ============
let envDraft = null;
function envForm() {
  const d = envDraft, isNew = !S().envelopes.some(e => e.id === d.id);
  return `${sheetHead(isNew ? "New envelope" : `Edit ${esc(d.name)}`, "Cancel")}<form data-form="env-edit">
    <label class="field"><span>Name</span><input class="input" name="name" value="${esc(d.name)}" list="env-ideas" maxlength="28" required ${isNew ? "autofocus" : ""}></label>
    <datalist id="env-ideas">${ENVELOPE_IDEAS.map(([n]) => `<option value="${esc(n)}">`).join("")}</datalist>
    <div class="field"><span>Where the money lives</span><div class="seg" role="group"><button type="button" data-act="env-kind" data-v="cash" aria-pressed="${d.kind === "cash"}">Cash, in my binder</button><button type="button" data-act="env-kind" data-v="card" aria-pressed="${d.kind === "card"}">Card, stays in the bank</button></div></div>
    <div class="row2"><label class="field"><span>Each payday</span><input class="input" name="amount" inputmode="decimal" value="${d.amount ? esc(String(d.amount)) : ""}" placeholder="0"></label>
    <label class="field"><span>Group</span><select class="input" name="group">${C.GROUPS.map(([k, l]) => `<option value="${k}"${d.group === k ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label></div>
    <button class="btn full" type="submit">Save</button>
    ${isNew ? "" : `<div class="row-btns" style="justify-content:center"><button type="button" class="btn text small" data-act="env-archive">${d.archived ? "Bring it back" : "Put it away (keeps its history)"}</button><button type="button" class="btn text small" data-act="env-del">Delete it</button></div>`}</form>`;
}
const syncEnvDraft = () => { const f = document.querySelector('form[data-form="env-edit"]'); if (!f) return; envDraft.name = val(f, "name"); envDraft.amount = num(val(f, "amount")) || 0; envDraft.group = val(f, "group"); };
actions["env-new"] = () => { envDraft = newEnvelope(); openSheet(envForm(), { label: "Envelope" }); };
actions["env-edit"] = el => { const e = envById(el.dataset.id); if (!e) return; envDraft = { ...e }; openSheet(envForm(), { label: "Envelope" }); };
actions["env-kind"] = el => { syncEnvDraft(); envDraft.kind = el.dataset.v; updateSheet(envForm()); };
live["env-name"] = () => {};
forms["env-edit"] = f => {
  syncEnvDraft(); const d = { ...envDraft, name: envDraft.name.trim().slice(0, 28) }; if (!d.name) return;
  const idea = ENVELOPE_IDEAS.find(([n]) => n.toLowerCase() === d.name.toLowerCase());
  const isNew = !S().envelopes.some(e => e.id === d.id);
  if (isNew && idea && !f.dataset.touched) { d.group = d.group === "everyday" ? idea[2] : d.group; }
  commit(s => { const i = s.envelopes.findIndex(e => e.id === d.id); i >= 0 ? (s.envelopes[i] = d) : s.envelopes.push(d); });
  closeSheet(); toast(isNew ? `${d.name} is in your binder.` : "Saved.");
};
actions["env-archive"] = () => { const id = envDraft.id; commit(s => { const e = s.envelopes.find(x => x.id === id); e.archived = !e.archived; }); closeSheet(); toast(envById(id).archived ? "Put away. Find it again in Settings." : "Back in your binder."); };
actions["env-del"] = () => {
  const id = envDraft.id, e = envById(id), n = S().tx.filter(t => C.touches(t, id)).length;
  if (n && !confirm(`Delete ${e.name} and its ${n} entries? To keep the history, choose "Put it away" instead.`)) return;
  const before = JSON.parse(JSON.stringify({ e: S().envelopes, t: S().tx }));
  commit(s => { s.envelopes = s.envelopes.filter(x => x.id !== id); s.tx = s.tx.filter(t => !C.touches(t, id)); });
  closeSheet(); toast(`${e.name} deleted.`, () => commit(s => { s.envelopes = before.e; s.tx = before.t; }));
};

// ============ Stuffing ============
actions["stuff-which"] = el => { app.stuffWhich = el.dataset.v; render(); };
const draftOf = p => ((app.stuffDraft ||= {})[p.start] ||= {});
function tickRow(s, p, r, amount) {
  const existing = s.tx.filter(t => t.kind === "stuff" && t.env === r.id && t.date >= p.start && t.date <= p.end);
  if (existing.length) { s.tx = s.tx.filter(t => !existing.includes(t)); return; }
  if (amount > 0) addTx(s, { kind: "stuff", env: r.id, amount, date: p.start, note: "Payday" });
  else s.tx.push({ id: uid(), kind: "stuff", env: r.id, amount: 0.0001, date: p.start, note: "Nothing this time" });
}
actions["stuff-tick"] = el => {
  const p = stuffPeriod(), plan = C.stuffPlan(S(), p), r = plan.rows.find(x => x.id === el.dataset.id); if (!r) return;
  const d = draftOf(p), amount = d[r.id] ?? r.suggested;
  const y = scrollY; commit(s => tickRow(s, p, r, amount)); scrollTo(0, y);
  const after = C.stuffPlan(S(), p);
  if (after.allDone && !plan.allDone) toast(after.unassigned === 0 ? "All stuffed. Every bit has a job." : "All stuffed.");
};
actions["stuff-all"] = () => {
  const p = stuffPeriod(), plan = C.stuffPlan(S(), p), d = draftOf(p), y = scrollY;
  const ids = [];
  commit(s => { for (const r of plan.rows.filter(x => x.done == null)) { const a = d[r.id] ?? r.suggested; tickRow(s, p, r, a); ids.push(s.tx[s.tx.length - 1].id); } });
  scrollTo(0, y); toast(`Stuffed ${cur(plan.toGo)}. Every envelope is full.`, undoTx(ids));
};
live["stuff-amt"] = el => {
  const p = stuffPeriod(), a = num(el.value); if (a == null || a < 0) return;
  const id = el.dataset.id, row = C.stuffPlan(S(), p).rows.find(r => r.id === id); if (!row) return;
  if (row.done != null) { commit(s => { const t = s.tx.find(x => x.kind === "stuff" && x.env === id && x.date >= p.start && x.date <= p.end); if (t) t.amount = a || 0.0001; }, { render: false }); }
  else draftOf(p)[id] = a;
  clearTimeout(app.stuffT); app.stuffT = setTimeout(() => { const y = scrollY, f = document.activeElement?.dataset?.id; render(); scrollTo(0, y); if (f) { const i = document.querySelector(`[data-live="stuff-amt"][data-id="${f}"]`); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } }, 900);
};
live["pay-in"] = el => { const p = stuffPeriod(), a = num(el.value); if (a == null) return; commit(s => { if (a === C.round2(s.pay.amount)) delete s.periodIncome[p.start]; else s.periodIncome[p.start] = a; }, { render: false }); clearTimeout(app.payT); app.payT = setTimeout(() => { const y = scrollY; render(); scrollTo(0, y); }, 1200); };
live["max-note"] = el => commit(s => { s.profile.maxNote = Number(el.value) || 0; });

// ============ Unstuffing ============
actions["unstuff"] = el => {
  const due = unstuffDue(), which = el?.dataset?.when || due?.which || "this";
  const p = period(), u = which === "prev" ? C.prevPeriod(S().pay, p) : p, date = which === "prev" ? u.end : app.today;
  const rows = S().envelopes.filter(e => !e.archived).map(e => ({ e, l: which === "prev" ? C.balance(S(), e.id, u.end) : C.envPeriod(S(), e, p, app.today).left })).filter(x => x.l > 0);
  app.unstuff = { which, u, date, rows };
  const funds = S().funds.filter(f => !f.done);
  openSheet(`${sheetHead("Unstuff", "Cancel")}<p class="small muted" style="margin-bottom:1rem">What's left from ${esc(rangeText(u))}. Keep it for next time, save it, or pay off debt. You choose for each envelope.</p>
    ${rows.length ? `<form data-form="unstuff">${rows.map(({ e, l }) => `<div class="li"><span class="t">${ic(e.kind === "card" ? "card" : "cash")}<span>${esc(e.name)}<small>${esc(cur(l))} left</small></span></span>
      <select class="input" style="width:auto;max-width:12rem" name="u-${e.id}"><option value="keep">Keep it</option>${funds.map(f => `<option value="${f.id}">Into ${esc(f.name)}</option>`).join("")}<option value="debt">Pay off debt</option><option value="out">Take it out</option></select></div>`).join("")}
      <button class="btn full" type="submit" style="margin-top:1.2rem">Done</button></form>` : `<div class="empty">Every envelope is empty. Nothing to unstuff.</div><button type="button" class="btn full" data-act="unstuff-skip" style="margin-top:1rem">OK</button>`}`, { label: "Unstuff", wide: true });
};
forms["unstuff"] = f => {
  const U = app.unstuff; if (!U) return;
  let moved = 0, saved = 0, debt = 0; const ids = [];
  commit(s => {
    for (const { e, l } of U.rows) {
      const to = val(f, "u-" + e.id); if (!to || to === "keep") continue;
      addTx(s, { kind: "unstuff", env: e.id, to, amount: l, date: U.date, note: "Unstuffed" }); ids.push(s.tx[s.tx.length - 1].id);
      moved += l; if (to === "debt") debt += l; else if (to !== "out") saved += l;
    }
    s.meta.unstuffed = { ...(s.meta.unstuffed || {}), [U.u.start]: true };
  });
  closeSheet();
  toast(moved ? `Unstuffed ${cur(moved)}${saved ? `: ${cur(saved)} saved` : ""}${debt ? `${saved ? "," : ":"} ${cur(debt)} to debt` : ""}.` : "Kept everything for next time.", ids.length ? undoTx(ids) : null);
};
actions["unstuff-skip"] = () => { const U = app.unstuff; commit(s => { s.meta.unstuffed = { ...(s.meta.unstuffed || {}), [U.u.start]: true }; }); closeSheet(); };

// ============ Sinking funds ============
export function fundSheet(id) {
  const f = fundById(id); if (!f) return "";
  const p = period(), fp = C.fundPlan(S(), f, p);
  const hist = S().tx.filter(t => C.touches(t, id)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  const line = f.done ? "Marked as done." : fp.remaining <= 0 ? "Goal reached." : f.date ? `${cur(fp.per)} each payday reaches ${cur(f.goal)} by ${fd(f.date)}.` : fp.per ? `${cur(fp.per)} each payday${fp.finish ? `: done around ${fd(fp.finish)}` : ""}.` : `${cur(fp.remaining)} to go.`;
  return `${sheetHead(esc(f.name))}${envCard(f, { left: fp.saved, budget: f.goal }, { tag: "div", fund: true, word: "saved of", note: esc(line) })}
    <div class="row-btns" style="margin-top:0"><button type="button" class="btn small" data-act="fund-add" data-id="${id}">${ic("plus")}Add money</button><button type="button" class="btn soft small" data-act="fund-take" data-id="${id}">${ic("spend")}Take out</button><button type="button" class="btn soft small" data-act="fund-edit" data-id="${id}">${ic("pencil")}Edit</button><button type="button" class="btn text small" data-act="fund-done" data-id="${id}">${f.done ? "Start it again" : "Mark as done"}</button></div>
    <div class="hist">${hist.length ? `<div class="ghead">History</div><div class="list">${hist.map(t => histRow(t, id)).join("")}</div>` : ""}</div>`;
}
actions["open-fund"] = el => openSheet(fundSheet(el.dataset.id), { label: "Fund" });
actions["fund-add"] = el => amountSheet(`Add to ${fundById(el.dataset.id).name}`, "fund-add", el.dataset.id, "How much are you putting in?", "Add it");
forms["fund-add"] = f => { const id = f.dataset.id, a = num(val(f, "amount")); if (!(a > 0)) return; let t; commit(s => { t = addTx(s, { kind: "add", env: id, amount: a, note: val(f, "note").trim() }); }); closeSheet(); toast(`Added ${cur(a)} to ${thing(id).name}.`, undoTx([t])); };
actions["fund-take"] = el => amountSheet(`Take out of ${fundById(el.dataset.id).name}`, "fund-take", el.dataset.id, "How much did you use?", "Take it out");
forms["fund-take"] = f => { const id = f.dataset.id, a = num(val(f, "amount")); if (!(a > 0)) return; let t; commit(s => { t = addTx(s, { kind: "spend", env: id, amount: a, note: val(f, "note").trim() }); }); closeSheet(); toast(`Took ${cur(a)} out of ${thing(id).name}.`, undoTx([t])); };
actions["fund-done"] = el => { const id = el.dataset.id; commit(s => { const f = s.funds.find(x => x.id === id); f.done = !f.done; }); updateSheet(fundSheet(id)); };
let fundDraft = null;
function fundForm() {
  const d = fundDraft, isNew = !S().funds.some(f => f.id === d.id);
  return `${sheetHead(isNew ? "New sinking fund" : `Edit ${esc(d.name)}`, "Cancel")}<form data-form="fund">
    <label class="field"><span>Name</span><input class="input" name="name" value="${esc(d.name)}" list="fund-ideas" maxlength="28" required ${isNew ? "autofocus" : ""}></label><datalist id="fund-ideas">${FUND_IDEAS.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <div class="field"><span>Where the money lives</span><div class="seg" role="group"><button type="button" data-act="fund-kind" data-v="cash" aria-pressed="${d.kind === "cash"}">Cash</button><button type="button" data-act="fund-kind" data-v="card" aria-pressed="${d.kind === "card"}">Card / savings account</button></div></div>
    <div class="row2"><label class="field"><span>Goal</span><input class="input" name="goal" inputmode="decimal" value="${d.goal ? esc(String(d.goal)) : ""}" placeholder="0" required></label><label class="field"><span>Need it by <span class="muted">(optional)</span></span><input class="input" type="date" name="date" value="${esc(d.date || "")}"></label></div>
    <label class="field"><span>No date? Put in each payday</span><input class="input" name="per" inputmode="decimal" value="${d.per ? esc(String(d.per)) : ""}" placeholder="0"><small>With a date, the app works out the amount for you.</small></label>
    ${isNew ? `<label class="field"><span>Already saved <span class="muted">(optional)</span></span><input class="input" name="start" inputmode="decimal" placeholder="0"></label>` : ""}
    <button class="btn full" type="submit">Save</button>${isNew ? "" : `<div class="row-btns" style="justify-content:center"><button type="button" class="btn text small" data-act="fund-del">Delete this fund</button></div>`}</form>`;
}
const syncFund = () => { const f = document.querySelector('form[data-form="fund"]'); if (!f) return; Object.assign(fundDraft, { name: val(f, "name"), goal: num(val(f, "goal")) || 0, date: val(f, "date"), per: num(val(f, "per")) || 0, start: f.elements.start ? val(f, "start") : "" }); };
actions["fund-new"] = () => { fundDraft = newFund(); openSheet(fundForm(), { label: "Fund" }); };
actions["fund-edit"] = el => { fundDraft = { ...fundById(el.dataset.id) }; openSheet(fundForm(), { label: "Fund" }); };
actions["fund-kind"] = el => { syncFund(); fundDraft.kind = el.dataset.v; const keep = fundDraft.start; updateSheet(fundForm()); const st = document.querySelector('form[data-form="fund"] [name="start"]'); if (st) st.value = keep || ""; };
forms["fund"] = () => {
  syncFund(); const { start, ...d } = fundDraft; d.name = d.name.trim().slice(0, 28); if (!d.name) return;
  const isNew = !S().funds.some(f => f.id === d.id), st = num(start);
  commit(s => { const i = s.funds.findIndex(f => f.id === d.id); i >= 0 ? (s.funds[i] = d) : s.funds.push(d); if (isNew && st > 0) addTx(s, { kind: "add", env: d.id, amount: st, note: "Already saved", date: C.addDays(period().start, -1) }); });
  closeSheet(); toast(isNew ? `${d.name} fund started.` : "Saved.");
};
actions["fund-del"] = () => {
  const id = fundDraft.id, f = fundById(id); if (!confirm(`Delete the ${f.name} fund and its history?`)) return;
  const before = JSON.parse(JSON.stringify({ f: S().funds, t: S().tx }));
  commit(s => { s.funds = s.funds.filter(x => x.id !== id); s.tx = s.tx.filter(t => !C.touches(t, id)); });
  closeSheet(); toast(`${f.name} deleted.`, () => commit(s => { s.funds = before.f; s.tx = before.t; }));
};

// ============ Challenges ============
actions["ch-show"] = el => { app.chId = el.dataset.id; render(); };
actions["ch-cell"] = el => {
  const c = S().challenges.find(x => x.id === el.dataset.c), i = Number(el.dataset.i); if (!c) return;
  const was = c.done[i];
  commit(s => { const x = s.challenges.find(y => y.id === c.id); if (i in x.done) delete x.done[i]; else { x.done[i] = app.today; if (x.pick?.i === i) x.pick = null; } });
  const x = S().challenges.find(y => y.id === c.id);
  toast(was ? "Unticked." : `${cur(c.cells[i])} saved. ${cur(C.challengeSaved(x))} so far.`, () => commit(s => { const y = s.challenges.find(z => z.id === c.id); if (was) y.done[i] = was; else delete y.done[i]; }));
};
actions["ch-pick"] = el => { commit(s => { const c = s.challenges.find(x => x.id === el.dataset.c); const i = C.pickCell(c); c.pick = i == null ? null : { i, date: app.today }; }); };
let chType = "env100";
function chForm() {
  const opt = (k, t, s) => `<button type="button" class="li" data-act="ch-type" data-v="${k}" aria-pressed="${chType === k}" style="${chType === k ? "box-shadow:inset 3px 0 0 var(--plum);padding-left:.8rem" : ""}"><span class="t"><span><b>${t}</b><small>${s}</small></span></span>${chType === k ? ic("check") : ""}</button>`;
  return `${sheetHead("New challenge", "Cancel")}<div class="list" style="margin-bottom:1rem">${opt("env100", "100 envelopes", "Numbers 1 to 100. All of them make 5,050")}${opt("week52", "52 weeks", "Week 1 put in 1, up to week 52. All of them make 1,378")}${opt("save1000", "Save 1,000", "40 little amounts that add up to 1,000")}${opt("custom", "Your own", "Pick a goal and how many envelopes")}</div>
    <form data-form="ch-new">${chType === "custom" ? `<div class="row2"><label class="field"><span>Goal</span><input class="input" name="goal" inputmode="decimal" required placeholder="500"></label><label class="field"><span>How many envelopes</span><input class="input" name="count" inputmode="numeric" required placeholder="20"></label></div><label class="field"><span>Name</span><input class="input" name="name" maxlength="28" placeholder="Holiday challenge"></label>`
      : `<label class="field"><span>Each number is worth</span><select class="input" name="scale">${[1, 2, 5, 10, 100].map(v => `<option value="${v}">${v === 1 ? `1 (as it says)` : `${v} times the number`}</option>`).join("")}</select><small>For a bigger challenge, or a currency with small units.</small></label>`}
    <button class="btn full" type="submit">Start it</button></form>`;
}
actions["ch-new"] = () => { chType = "env100"; openSheet(chForm(), { label: "Challenge" }); };
actions["ch-type"] = el => { chType = el.dataset.v; updateSheet(chForm()); };
forms["ch-new"] = f => {
  const opts = chType === "custom" ? { goal: num(val(f, "goal")) || 0, count: Number(val(f, "count")) || 0, name: val(f, "name").trim() } : { scale: Number(val(f, "scale")) || 1 };
  if (chType === "custom" && (!(opts.goal > 0) || !(opts.count > 0))) return toast("Type a goal and how many envelopes.");
  const c = { id: uid(), ...C.makeChallenge(chType, opts) };
  commit(s => s.challenges.push(c)); app.chId = c.id; app.view = "challenges"; closeSheet(); render();
};
actions["ch-rename"] = el => { const c = S().challenges.find(x => x.id === el.dataset.c); const n = prompt("Name this challenge", c.name); if (n && n.trim()) commit(s => { s.challenges.find(x => x.id === c.id).name = n.trim().slice(0, 28); }); };
actions["ch-del"] = el => { const c = S().challenges.find(x => x.id === el.dataset.c); if (!confirm(`Delete "${c.name}"? Its ticks go too.`)) return; const i = S().challenges.indexOf(c); commit(s => { s.challenges = s.challenges.filter(x => x.id !== c.id); }); toast("Challenge deleted.", () => commit(s => { s.challenges.splice(i, 0, c); })); };

// ============ Settings forms ============
forms["profile"] = f => { commit(s => { s.profile.name = val(f, "name").trim().slice(0, 30); s.profile.currency = val(f, "currency"); if (f.elements.maxNote) s.profile.maxNote = Number(val(f, "maxNote")) || 0; }); toast("Saved."); };
function readPay(f, base) {
  const p = { ...base, rhythm: val(f, "rhythm") };
  if (f.elements.anchor) p.anchor = val(f, "anchor") || app.today;
  if (f.elements.day) p.day = Math.max(1, Math.min(31, Number(val(f, "day")) || 1));
  if (f.elements.d1) p.days = [Math.max(1, Math.min(31, Number(val(f, "d1")) || 1)), Math.max(1, Math.min(31, Number(val(f, "d2")) || 15))];
  if (f.elements.amount) p.amount = num(val(f, "amount")) || 0;
  if (C.RHYTHMS[p.rhythm]?.step && !p.anchor) p.anchor = app.today;
  return p;
}
forms["pay"] = f => { commit(s => { s.pay = readPay(f, s.pay); }); toast("Pay saved."); };
live["rhythm"] = el => { const f = el.form; const p = readPay(f, f.dataset.form === "setup" ? wz.pay : S().pay); if (f.dataset.form === "setup") wz.pay = p; const box = f.querySelector("[data-payfields]") || f; const keepBtn = [...f.querySelectorAll("button[type=submit],.wz-nav")]; box.innerHTML = payFields(p); if (box === f) keepBtn.forEach(b => f.appendChild(b)); };

// ============ Data: backup, restore, export, move, install ============
actions["backup"] = async () => {
  const data = JSON.stringify({ app: "littleenvelopes", version: 1, exportedAt: new Date().toISOString(), state: S() }, null, 1);
  const r = await shareOrDownload(`little-envelopes-backup-${app.today}.json`, data, "application/json");
  if (r === "cancelled") return;
  commit(s => { s.meta.lastBackup = new Date().toISOString(); });
  toast(r === "shared" ? "Backup ready. Save it to Files, Drive or email." : "Backup saved to your downloads.");
};
actions["restore"] = async () => {
  const f = await pickFile(".json,application/json"); if (!f) return;
  let d; try { d = JSON.parse(f.text); } catch { return toast("That file isn't a Little Envelopes backup."); }
  if (d?.app !== "littleenvelopes" || !d.state) return toast("That file isn't a Little Envelopes backup.");
  openSheet(`${sheetHead("Restore this backup?", "Cancel")}<p style="font-weight:700;margin-bottom:1rem">Backup from ${esc(fd(String(d.exportedAt || "").slice(0, 10) || app.today))} with ${(d.state.envelopes || []).length} envelopes and ${(d.state.tx || []).length} entries. It replaces what's on this device now.</p><button type="button" class="btn full" data-act="restore-go">Yes, restore it</button>`, { label: "Restore" });
  actions["restore-go"] = () => { const st = normalise(d.state); st.meta.unlocked = true; st.meta.setupDone = true; st.meta.demo = app.demo; app.S = st; commit(null); applyLook(); closeSheet(); app.view = "binder"; render(); toast("Restored. Welcome back."); };
};
actions["move-phone"] = () => {
  const link = location.origin + location.pathname.replace(/index\.html$/, "");
  openSheet(`${sheetHead("Move to another device")}<p class="small muted" style="margin-bottom:1rem">Your binder lives on this device only, for privacy. Moving it takes a minute.</p>
    <ol class="steps"><li>Make a backup here<div style="margin-top:.4rem"><button type="button" class="btn soft small" data-act="backup">Back up now</button></div></li><li>Send the file to yourself<small>AirDrop, WhatsApp to yourself, email or Google Drive.</small></li>
    <li>On the other device, open Little Envelopes<small><span style="word-break:break-all">${esc(link)}</span></small></li><li>Unlock, then Settings, Restore from a backup</li></ol>`, { label: "Move" });
};
actions["export-csv"] = async () => {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`, name = id => (id === "debt" ? "Debt" : id === "out" ? "Taken out" : thing(id)?.name || "");
  const rows = [...S().tx].sort((a, b) => a.date.localeCompare(b.date)).filter(t => t.amount >= 0.01 || t.amount <= -0.01).map(t => [t.date, KIND_LABEL[t.kind] || t.kind, q(name(t.env || t.from)), q(t.to ? name(t.to) : ""), String(C.round2(t.amount)).replace(".", "."), q(t.note)].join(","));
  await shareOrDownload(`little-envelopes-${app.today}.csv`, "﻿" + ["Date,What,Envelope or fund,To,Amount,Note", ...rows].join("\r\n"), "text/csv");
  toast("Exported. Open it in Google Sheets (File, Import) or Excel.");
};
let deferredPrompt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; });
actions["install-now"] = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice.catch(() => {}); deferredPrompt = null; closeSheet(); };
actions["install-help"] = () => openSheet(`${sheetHead("Put it on your home screen")}<p class="small muted" style="margin-bottom:1rem">Then it opens like an app, works offline, and your phone keeps your binder safe.</p>
  ${deferredPrompt ? `<button type="button" class="btn full" data-act="install-now" style="margin-bottom:1rem">Install now</button>` : ""}
  <h3 class="fr" style="margin-bottom:.5rem">iPhone or iPad</h3><ol class="steps"><li>Open this page in Safari</li><li>Tap the Share button<small>The square with an arrow.</small></li><li>Tap "Add to Home Screen", then "Add"</li></ol>
  <h3 class="fr" style="margin:.4rem 0 .5rem">Android</h3><ol class="steps"><li>Open this page in Chrome</li><li>Tap the three dots, top right</li><li>Tap "Install app" or "Add to Home screen"</li></ol>
  <h3 class="fr" style="margin:.4rem 0 .5rem">Laptop</h3><ol class="steps"><li>Chrome or Edge: the install icon at the right end of the address bar</li><li>Safari on Mac: File, then "Add to Dock"</li></ol>`, { label: "Install" });
actions["wipe"] = async () => {
  if (app.demo) return toast("This is the demo. Nothing is saved anyway.");
  if (!confirm("Delete your whole binder from this device? Make a backup first if you might want it back.")) return;
  await store.wipe(); location.reload();
};

// ============ Stuffing card (story picture) ============
actions["story-card"] = async () => {
  openSheet(`${sheetHead("Your stuffing card")}<div class="empty">Making your card&hellip;</div>`, { label: "Stuffing card" });
  const p = app.view === "stuff" ? stuffPeriod() : period();
  const blob = await storyCard(S(), p), url = URL.createObjectURL(blob);
  updateSheet(`${sheetHead("Your stuffing card")}<img src="${url}" alt="Your stuffing card" class="card-img"><div class="row-btns" style="justify-content:center;margin-top:1.2rem"><button type="button" class="btn" data-act="card-save">Save or share</button></div><p class="small muted" style="text-align:center;margin-top:.5rem">Made for Instagram and TikTok stories (1080 × 1920).</p>`);
  actions["card-save"] = async () => {
    const file = new File([blob], `stuffing-${p.start}.png`, { type: "image/png" });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  };
};

// ============ Unlock and setup ============
const CODE_HASH = "6d923ce28ce0d8faecc10784fa8e946ebc61e0c5feda691ba6c14077712646cc";
async function codeOK(code) {
  try { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""))); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("") === CODE_HASH; }
  catch { return false; }
}
export function renderUnlock(msg = "") {
  document.getElementById("app").innerHTML = `<div class="center-screen"><div class="center-card">${brand()}
    <h1 class="fr">Welcome to your <em class="it">binder</em></h1>
    <p style="margin-bottom:1.2rem;color:var(--body)">Type the unlock code from your Etsy download (the PDF). You only do this once on each device.</p>
    <form data-form="unlock"><label class="field"><span>Unlock code</span><input class="input" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="LITTLE-ENV-0000" autofocus></label>
    ${msg ? `<p style="color:var(--rose);font-weight:800;margin:-.3rem 0 .8rem">${esc(msg)}</p>` : ""}<button class="btn full" type="submit">Unlock</button></form>
    <p class="small muted" style="margin-top:1rem">Haven't bought it yet? <a href="?demo">Try the free demo</a>, or <a href="${ETSY_URL}" target="_blank" rel="noopener">find it on Etsy</a>.</p></div></div>`;
}
forms["unlock"] = async f => {
  if (!(await codeOK(val(f, "code")))) return renderUnlock("That code doesn't match. Check the PDF, or message the shop and we'll help.");
  app.S = blankState(); app.S.meta.unlocked = true; store.save(app.S); await store.flush(); wz = null; renderSetup();
};
let wz = null;
const round5 = n => Math.max(5, Math.round(n / 5) * 5);
function guessCurrency() { const r = (navigator.language || "").split("-")[1] || ""; return { US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CH: "CHF", IN: "INR", ZA: "ZAR", MX: "MXN", BR: "BRL", PH: "PHP", SG: "SGD" }[r] || "EUR"; }
export function renderSetup() {
  if (!wz) wz = { step: 1, name: "", look: "strawberry", currency: guessCurrency(), pay: { rhythm: "biweekly", anchor: app.today, day: 25, days: [1, 15], amount: 0 }, envs: null };
  app.S.profile.look = wz.look; app.S.profile.currency = wz.currency; applyLook();
  const prog = `<div class="progress">${[1, 2, 3].map(i => `<i class="${i <= wz.step ? "on" : ""}"></i>`).join("")}</div>`;
  let body = "";
  if (wz.step === 1) body = `<h1 class="fr">Let's make your <em class="it">binder</em></h1><p style="margin:.2rem 0 1.2rem;color:var(--body)">Three quick steps. You can change everything later.</p>
    <label class="field"><span>What should I call you? <span class="muted">(optional)</span></span><input class="input" name="name" value="${esc(wz.name)}" autocomplete="given-name"></label>
    <div class="field"><span>Pick your binder</span><div class="looks">${Object.entries(LOOKS).map(([k, [n, sw, mt]]) => `<button type="button" class="look" data-act="wz-look" data-v="${k}" aria-pressed="${wz.look === k}" style="--sw:${sw};--mt:${mt}"><i></i>${n}</button>`).join("")}</div><small>Each one has a dark mode too.</small></div>
    <label class="field"><span>Currency</span><select class="input" name="currency">${CURRENCIES.map(([c, l]) => `<option value="${c}"${c === wz.currency ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  if (wz.step === 2) body = `<h1 class="fr">Your <em class="it">payday</em></h1><p style="margin:.2rem 0 1.2rem;color:var(--body)">So the app knows when to stuff and how long each pay period is.</p><div data-payfields>${payFields(wz.pay)}</div>`;
  if (wz.step === 3) {
    const pay = wz.pay.amount || 0;
    if (!wz.envs) wz.envs = ENVELOPE_IDEAS.map(([name, kind, group, share], i) => ({ name, kind, group, amount: pay ? round5(pay * share) : "", on: [0, 3, 4, 9, 10].includes(i) }));
    const planned = C.sum(wz.envs.filter(e => e.on), e => Number(e.amount) || 0);
    body = `<h1 class="fr">Your first <em class="it">envelopes</em></h1><p style="margin:.2rem 0 1rem;color:var(--body)">Tick the ones you want and set what goes in each payday. Tap cash or card to switch.</p>
      <div class="ideas">${wz.envs.map((e, i) => `<div class="idea"><button type="button" class="cb" data-act="wz-env" data-i="${i}" aria-pressed="${e.on}" style="${e.on ? "background:var(--plum);box-shadow:none" : ""}" aria-label="${esc(e.name)}">${e.on ? ic("check") : ""}</button><span style="font-weight:700">${esc(e.name)}</span><button type="button" class="ck" data-act="wz-kind" data-i="${i}">${e.kind}</button><input class="amtin" name="e-${i}" inputmode="decimal" value="${esc(String(e.amount))}" placeholder="0" aria-label="${esc(e.name)} each payday"></div>`).join("")}</div>
      <div class="row" style="font-size:.9rem;color:var(--body)"><span>Planned each payday</span><b class="fr" style="font-size:1.2rem;color:var(--ink)">${esc(cur(planned))}${pay ? ` <span class="small muted" style="font-family:Nunito">of ${esc(cur(pay))}</span>` : ""}</b></div>
      <p class="small muted" style="margin-top:.6rem">Add your own envelopes, sinking funds and challenges later.</p>`;
  }
  document.getElementById("app").innerHTML = `<div class="center-screen"><div class="center-card" style="max-width:34rem">${brand()}${prog}
    <form data-form="setup">${body}<div class="wz-nav" style="display:flex;gap:.6rem;margin-top:1.3rem">${wz.step > 1 ? `<button type="button" class="btn ghost" data-act="wz-back">Back</button>` : ""}<button class="btn" type="submit" style="flex:1">${wz.step < 3 ? "Next" : "Open my binder"}</button></div></form></div></div>`;
}
function syncWz() {
  const f = document.querySelector('form[data-form="setup"]'); if (!f) return;
  if (f.elements.name) { wz.name = val(f, "name"); wz.currency = val(f, "currency"); }
  if (f.elements.rhythm) { wz.pay = readPay(f, wz.pay); if (wz.envs && !wz.envs.some(e => e.touched)) wz.envs = null; }
  if (wz.envs) wz.envs.forEach((e, i) => { if (f.elements["e-" + i]) { const v = val(f, "e-" + i); if (String(v) !== String(e.amount)) e.touched = true; e.amount = v; } });
}
actions["wz-look"] = el => { syncWz(); wz.look = el.dataset.v; renderSetup(); };
actions["wz-env"] = el => { syncWz(); const e = wz.envs[Number(el.dataset.i)]; e.on = !e.on; renderSetup(); };
actions["wz-kind"] = el => { syncWz(); const e = wz.envs[Number(el.dataset.i)]; e.kind = e.kind === "cash" ? "card" : "cash"; renderSetup(); };
actions["wz-back"] = () => { syncWz(); wz.step--; renderSetup(); };
forms["setup"] = () => { syncWz(); if (wz.step < 3) { wz.step++; renderSetup(); return; } finishSetup(); };
function finishSetup() {
  const s = S();
  Object.assign(s.profile, { name: wz.name.trim().slice(0, 30), look: wz.look, currency: wz.currency });
  s.pay = { ...wz.pay };
  s.envelopes = wz.envs.filter(e => e.on).map(e => newEnvelope({ name: e.name, kind: e.kind, group: e.group, amount: num(e.amount) || 0 }));
  s.meta.setupDone = true; s.meta.createdAt = new Date().toISOString();
  commit(null, { render: false }); store.askToPersist(); wz = null; app.view = "stuff"; app.start();
  if (isIOS() && !isStandalone()) setTimeout(() => actions["install-help"](), 900);
}
