// Little Envelopes — the money maths. Pure functions only (no DOM, no storage), so they can be tested in Node.
// Dates are "YYYY-MM-DD" strings in the buyer's own calendar. Money is worked out in cents to avoid rounding drift.

const DAY = 86400000;
export const pad = n => String(n).padStart(2, "0");
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const parts = s => String(s).split("-").map(Number);
export const dayNum = s => { const [y, m, d] = parts(s); return Math.round(Date.UTC(y, m - 1, d) / DAY); };
export const fromDayNum = n => { const t = new Date(n * DAY); return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
export const addDays = (s, n) => fromDayNum(dayNum(s) + n);
export const diffDays = (a, b) => dayNum(b) - dayNum(a);
export const weekday = s => new Date(dayNum(s) * DAY).getUTCDay();
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const clampDay = (y, m, d) => iso(y, m, Math.min(d, daysInMonth(y, m)));
export const todayISO = (now = new Date()) => iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
export const addMonths = (y, m, n) => { const t = (y * 12 + (m - 1)) + n; return [Math.floor(t / 12), (t % 12) + 1]; };
export const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
export const cents = n => Math.round((Number(n) || 0) * 100);
export const sum = (arr, f = x => x) => round2(arr.reduce((a, x) => a + cents(f(x)), 0) / 100);

// ---------- Pay rhythm and pay periods ----------
export const RHYTHMS = {
  weekly: { label: "Every week", step: 7 },
  biweekly: { label: "Every 2 weeks", step: 14 },
  fourweekly: { label: "Every 4 weeks", step: 28 },
  monthly: { label: "Once a month" },
  semimonthly: { label: "Twice a month" },
  irregular: { label: "It changes (each calendar month)" },
};

function monthlyPaydays(pay, y, m) {
  if (pay.rhythm === "monthly") return [clampDay(y, m, pay.day || 1)];
  const days = [...(pay.days || [1, 15])].map(Number).sort((a, b) => a - b);
  return [...new Set(days.map(d => clampDay(y, m, d)))];
}

export function lastPayday(pay, t) {
  const step = RHYTHMS[pay.rhythm]?.step;
  if (step) return addDays(pay.anchor, Math.floor(diffDays(pay.anchor, t) / step) * step);
  if (pay.rhythm === "monthly" || pay.rhythm === "semimonthly") {
    let [y, m] = parts(t);
    for (let i = 0; i < 3; i++) {
      const c = monthlyPaydays(pay, y, m).filter(d => d <= t);
      if (c.length) return c[c.length - 1];
      [y, m] = addMonths(y, m, -1);
    }
  }
  const [y, m] = parts(t);
  return iso(y, m, 1);
}

export function nextPayday(pay, t) {
  const step = RHYTHMS[pay.rhythm]?.step;
  if (step) return addDays(lastPayday(pay, t), step);
  if (pay.rhythm === "monthly" || pay.rhythm === "semimonthly") {
    let [y, m] = parts(t);
    for (let i = 0; i < 3; i++) {
      const c = monthlyPaydays(pay, y, m).filter(d => d > t);
      if (c.length) return c[0];
      [y, m] = addMonths(y, m, 1);
    }
  }
  const [y, m] = parts(t);
  const [ny, nm] = addMonths(y, m, 1);
  return iso(ny, nm, 1);
}

export function periodOf(pay, t) {
  const start = lastPayday(pay, t), next = nextPayday(pay, t), end = addDays(next, -1);
  return { start, end, next, days: diffDays(start, end) + 1 };
}
export const nextPeriod = (pay, p) => periodOf(pay, p.next);
export const prevPeriod = (pay, p) => periodOf(pay, addDays(p.start, -1));
export const daysLeft = (p, today) => Math.max(1, diffDays(today, p.end) + 1);   // today counts

// Paydays from `from` up to and including `to`.
export function paydaysBetween(pay, from, to) {
  const out = [];
  let p = periodOf(pay, from);
  if (p.start < from) p = nextPeriod(pay, p);
  for (let g = 0; p.start <= to && g < 600; g++) { out.push(p.start); p = nextPeriod(pay, p); }
  return out;
}

// ---------- Money moving between envelopes, funds and the outside world ----------
// Every change is one entry in state.tx:
//   stuff  { env, amount }        cash or money put into an envelope or fund on payday (date = the payday)
//   add    { env, amount }        extra money put in later
//   spend  { env, amount }        money spent from it
//   move   { from, to, amount }   borrowed from one envelope (or fund) for another
//   unstuff{ env, to, amount }    left over at the end of a pay period: to a fund id, or "debt", or "out"
//   fix    { env, amount }        a count that didn't match: the difference (+ or -)
export function delta(t, id) {
  const a = cents(t.amount);
  switch (t.kind) {
    case "stuff": case "add": case "fix": return t.env === id ? a : 0;
    case "spend": return t.env === id ? -a : 0;
    case "move": return (t.to === id ? a : 0) - (t.from === id ? a : 0);
    case "unstuff": return (t.to === id ? a : 0) - (t.env === id ? a : 0);
    default: return 0;
  }
}
export const touches = (t, id) => t.env === id || t.to === id || t.from === id;

export function balance(S, id, upTo = "9999-12-31") {
  let c = 0;
  for (const t of S.tx) if (t.date <= upTo && touches(t, id)) c += delta(t, id);
  return c / 100;
}

const inPeriod = (t, p) => t.date >= p.start && t.date <= p.end;

// One envelope in one pay period.
export function envPeriod(S, env, p, today) {
  const id = env.id;
  let carried = 0, stuffed = 0, inflow = 0, spent = 0, out = 0, unstuffed = 0, borrowedIn = [], lentOut = [], lastSpend = null;
  for (const t of S.tx) {
    if (!touches(t, id)) continue;
    if (t.date < p.start) { carried += delta(t, id); continue; }
    if (t.date > p.end) continue;
    const a = cents(t.amount);
    if (t.kind === "stuff" && t.env === id) stuffed += a;
    else if ((t.kind === "add" || (t.kind === "fix" && a > 0)) && t.env === id) inflow += a;
    else if (t.kind === "fix" && t.env === id) out += -a;
    else if (t.kind === "spend" && t.env === id) { spent += a; if (!lastSpend || t.date > lastSpend) lastSpend = t.date; }
    else if (t.kind === "move" && t.to === id) { inflow += a; borrowedIn.push(t); }
    else if (t.kind === "move" && t.from === id) { out += a; lentOut.push(t); }
    else if (t.kind === "unstuff" && t.env === id) unstuffed += a;
  }
  const left = (carried + stuffed + inflow - spent - out - unstuffed) / 100;
  const budget = (carried + stuffed + inflow) / 100;
  const dl = daysLeft(p, today);
  return {
    carried: carried / 100, stuffed: stuffed / 100, inflow: inflow / 100, spent: spent / 100, out: out / 100, unstuffed: unstuffed / 100,
    left, budget, pctLeft: budget > 0 ? Math.max(0, Math.min(100, (left / budget) * 100)) : 0,
    perDay: left > 0 ? Math.floor((left / dl) * 100) / 100 : 0, daysLeft: dl,
    borrowedIn, lentOut, lastSpend, over: left < 0 ? -left : 0,
  };
}

// ---------- Sinking funds ----------
// How much to put in each payday so the fund reaches its goal by its date. Fixed for the whole pay period
// (it is worked out from what was saved before this payday), so ticking it off doesn't change the number.
export function fundPlan(S, f, p) {
  const before = balance(S, f.id, addDays(p.start, -1)), now = balance(S, f.id);
  const remaining = round2(Math.max(0, (Number(f.goal) || 0) - before));
  if (f.done || !(Number(f.goal) > 0)) return { saved: now, remaining: Math.max(0, (Number(f.goal) || 0) - now), per: f.done ? 0 : round2(Number(f.per) || 0), paydays: null, finish: null };
  if (f.date) {
    const n = paydaysBetween(S.pay, p.start, f.date).length;
    const per = remaining <= 0 ? 0 : Math.ceil(remaining / Math.max(1, n));
    return { saved: now, remaining: Math.max(0, round2(f.goal - now)), per, paydays: n, finish: f.date, late: f.date < p.start && remaining > 0 };
  }
  const per = round2(Number(f.per) || 0);
  let finish = null;
  if (per > 0 && remaining > 0) {
    const n = Math.ceil(remaining / per);
    let q = p; for (let i = 1; i < n && i < 600; i++) q = nextPeriod(S.pay, q);
    finish = q.start;
  }
  return { saved: now, remaining: Math.max(0, round2(f.goal - now)), per, paydays: null, finish };
}

// ---------- Payday stuffing ----------
export const GROUPS = [["bills", "Bills first"], ["everyday", "Everyday"], ["fun", "Fun"], ["other", "Other"]];
export const groupName = g => (GROUPS.find(x => x[0] === g) || GROUPS[3])[1];

export function stuffPlan(S, p) {
  const topup = S.profile.stuffMode === "topup";
  const rows = [];
  const live = S.envelopes.filter(e => !e.archived);
  for (const [g] of GROUPS) {
    for (const e of live.filter(x => (GROUPS.some(y => y[0] === x.group) ? x.group : "other") === g)) {
      const done = S.tx.filter(t => t.kind === "stuff" && t.env === e.id && inPeriod(t, p));
      const carried = balance(S, e.id, addDays(p.start, -1));
      const planned = round2(Number(e.amount) || 0);
      const suggested = topup ? round2(Math.max(0, planned - carried)) : planned;
      rows.push({ type: "env", id: e.id, name: e.name, cash: e.kind === "cash", group: g, planned, suggested, carried, done: done.length ? sum(done, t => t.amount) : null });
    }
  }
  for (const f of S.funds.filter(x => !x.done)) {
    const fp = fundPlan(S, f, p);
    const done = S.tx.filter(t => t.kind === "stuff" && t.env === f.id && inPeriod(t, p));
    if (fp.per <= 0 && !done.length) continue;
    rows.push({ type: "fund", id: f.id, name: f.name, cash: f.kind === "cash", group: "savings", planned: fp.per, suggested: fp.per, carried: 0, done: done.length ? sum(done, t => t.amount) : null });
  }
  const income = round2(S.periodIncome?.[p.start] ?? S.pay.amount ?? 0);
  const planned = sum(rows, r => r.suggested);
  const stuffed = sum(rows.filter(r => r.done != null), r => r.done);
  const toGo = sum(rows.filter(r => r.done == null), r => r.suggested);
  return { rows, income, planned, stuffed, toGo, unassigned: round2(income - planned), allDone: rows.length > 0 && rows.every(r => r.done != null) };
}

// What this payday did: stuffed, spent, still in envelopes, put away.
export function periodSummary(S, p, today) {
  const envs = S.envelopes.filter(e => !e.archived), fundIds = new Set(S.funds.map(f => f.id)), envIds = new Set(S.envelopes.map(e => e.id));
  const tx = S.tx.filter(t => inPeriod(t, p));
  const stuffed = sum(tx.filter(t => t.kind === "stuff"), t => t.amount);
  const spent = sum(tx.filter(t => t.kind === "spend" && envIds.has(t.env)), t => t.amount);
  const putAway = sum(tx.filter(t => (t.kind === "stuff" || t.kind === "add") && fundIds.has(t.env)), t => t.amount);
  const per = envs.map(e => ({ e, ...envPeriod(S, e, p, today) }));
  const left = sum(per, x => Math.max(0, x.left));
  const leftCash = sum(per.filter(x => x.e.kind === "cash"), x => Math.max(0, x.left));
  return { stuffed, spent, putAway, left, leftCash, per };
}

// ---------- Savings challenges ----------
export const CHALLENGES = {
  env100: { name: "100 envelopes", blurb: "Pick a number, put that much in. All 100 make", cells: () => Array.from({ length: 100 }, (_, i) => i + 1) },
  week52: { name: "52 weeks", blurb: "Week 1 put in 1, week 2 put in 2, up to week 52. All of them make", cells: () => Array.from({ length: 52 }, (_, i) => i + 1) },
  save1000: { name: "Save 1,000", blurb: "40 little envelopes of different sizes. All of them make", cells: () => [5, 10, 20, 30, 60].flatMap(v => Array(8).fill(v)).sort((a, b) => ((a * 7919) % 13) - ((b * 7919) % 13) || a - b) },
  custom: { name: "Your own", blurb: "Your own challenge. All of it makes", cells: (goal, n) => splitEven(goal, n) },
};
export function splitEven(goal, n) {
  n = Math.max(1, Math.min(200, Math.round(n) || 1));
  const c = cents(goal), base = Math.floor(c / n / 100) * 100, out = Array(n).fill(base / 100);
  out[n - 1] = round2((c - base * (n - 1)) / 100);
  return out;
}
export function makeChallenge(type, { goal = 0, count = 0, scale = 1, name = "" } = {}) {
  const def = CHALLENGES[type] || CHALLENGES.custom;
  const cells = type === "custom" ? def.cells(goal, count) : def.cells().map(v => round2(v * (Number(scale) || 1)));
  return { type, name: name || def.name, cells, scale: type === "custom" ? 1 : Number(scale) || 1, done: {}, pick: null };
}
export const challengeTotal = c => sum(c.cells);
export const challengeSaved = (c, upTo = "9999-12-31", from = "0000-01-01") => sum(Object.entries(c.done).filter(([, d]) => d >= from && d <= upTo), ([i]) => c.cells[i]);
export const challengeCount = c => Object.keys(c.done).length;
export function pickCell(c, rnd = Math.random) {
  const open = c.cells.map((_, i) => i).filter(i => !(i in c.done));
  return open.length ? open[Math.floor(rnd() * open.length)] : null;
}

// ---------- Cash for the binder: which notes and coins ----------
export const DENOMS = {
  EUR: { notes: [500, 200, 100, 50, 20, 10, 5], coins: [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01], max: 50 },
  USD: { notes: [100, 50, 20, 10, 5, 1], coins: [0.25, 0.1, 0.05, 0.01], max: 20 },
  GBP: { notes: [50, 20, 10, 5], coins: [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01], max: 20 },
  CAD: { notes: [100, 50, 20, 10, 5], coins: [2, 1, 0.25, 0.1, 0.05], max: 20 },
  AUD: { notes: [100, 50, 20, 10, 5], coins: [2, 1, 0.5, 0.2, 0.1, 0.05], max: 50 },
  NZD: { notes: [100, 50, 20, 10, 5], coins: [2, 1, 0.5, 0.2, 0.1], max: 20 },
  CHF: { notes: [1000, 200, 100, 50, 20, 10], coins: [5, 2, 1, 0.5, 0.2, 0.1, 0.05], max: 50 },
};
export function breakdown(amount, currency, maxNote) {
  const d = DENOMS[currency]; if (!d) return null;
  const top = maxNote || d.max;
  let c = cents(amount);
  const out = [];
  for (const v of [...d.notes.filter(n => n <= top), ...d.coins]) {
    const vc = cents(v), n = Math.floor(c / vc);
    if (n > 0) { out.push({ v, n, coin: d.coins.includes(v) }); c -= n * vc; }
  }
  return { parts: out, rest: c / 100 };   // rest > 0 only where the smallest coin can't make it (e.g. 1 cent in Canada)
}
// Each cash envelope is broken down on its own (so every envelope can be filled exactly), then added up for the bank.
export function cashList(items, currency, maxNote) {
  if (!DENOMS[currency]) return null;
  const per = items.filter(x => x.amount > 0).map(x => ({ ...x, ...breakdown(x.amount, currency, maxNote) }));
  const tally = new Map();
  for (const x of per) for (const p of x.parts) tally.set(p.v, (tally.get(p.v) || 0) + p.n);
  const total = [...tally.entries()].sort((a, b) => b[0] - a[0]).map(([v, n]) => ({ v, n, coin: DENOMS[currency].coins.includes(v) }));
  return { per, total, amount: sum(items, x => Math.max(0, x.amount)) };
}

// ---------- The year ----------
export function yearStats(S, Y) {
  const fundIds = new Set(S.funds.map(f => f.id)), envIds = new Set(S.envelopes.map(e => e.id));
  const from = `${Y}-01-01`, to = `${Y}-12-31`;
  const months = Array.from({ length: 12 }, () => ({ stuffed: 0, spent: 0, saved: 0, debt: 0 }));
  const byEnv = new Map();
  let unstuffSaved = 0, unstuffDebt = 0;
  for (const t of S.tx) {
    if (t.date < from || t.date > to) continue;
    const m = months[parts(t.date)[1] - 1], a = Number(t.amount) || 0;
    if (t.kind === "stuff") m.stuffed += a;
    if (t.kind === "spend" && envIds.has(t.env)) { m.spent += a; byEnv.set(t.env, (byEnv.get(t.env) || 0) + a); }
    if ((t.kind === "stuff" || t.kind === "add") && fundIds.has(t.env)) m.saved += a;
    if (t.kind === "unstuff" && fundIds.has(t.to)) { m.saved += a; unstuffSaved += a; }
    if (t.kind === "unstuff" && t.to === "debt") { m.debt += a; unstuffDebt += a; }
  }
  for (const c of S.challenges) for (const [i, d] of Object.entries(c.done)) if (d >= from && d <= to) months[parts(d)[1] - 1].saved += Number(c.cells[i]) || 0;
  months.forEach(m => { for (const k in m) m[k] = round2(m[k]); });
  const tot = k => sum(months, m => m[k]);
  const top = [...byEnv.entries()].map(([id, v]) => ({ env: S.envelopes.find(e => e.id === id), spent: round2(v) })).filter(x => x.env).sort((a, b) => b.spent - a.spent);
  return { months, stuffed: tot("stuffed"), spent: tot("spent"), saved: tot("saved"), debt: tot("debt"), unstuffSaved: round2(unstuffSaved), unstuffDebt: round2(unstuffDebt), top };
}
export const savedThisYear = (S, Y) => yearStats(S, Y).saved;
