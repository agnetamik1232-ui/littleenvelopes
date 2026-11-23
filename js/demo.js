// Little Envelopes — the free demo: Mia's binder, always dated around today, so it never looks old.
// Paid every 2 weeks; today is day 11 of the pay period; six months of history behind it.
import { blankState, uid } from "./model.js";
import { addDays, periodOf, prevPeriod, round2, balance, makeChallenge, diffDays } from "./calc.js";

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const ENVS = [
  // name, kind, group, amount, what Mia has spent so far this pay period [day offset, amount, note]
  ["Rent", "card", "bills", 850, [[0, 850, "November rent"]]],
  ["Transport", "card", "bills", 90, [[1, 24, "Bus pass top up"], [6, 14, "Train to Mum's"]]],
  ["Groceries", "cash", "everyday", 300, [[1, 41.2, "Big shop"], [4, 18.6, "Market"], [7, 33.4, "Weekly shop"], [9, 22.8, "Bread, milk, fruit"]]],
  ["Pet", "cash", "everyday", 60, [[3, 15, "Cat food"]]],
  ["Coffee", "cash", "fun", 30, [[2, 3.8, "Flat white"], [5, 3.8, "Flat white"], [8, 4.2, "Oat latte"], [10, 7.2, "Coffee with Lina"]]],
  ["Fun money", "cash", "fun", 80, [[4, 12, "Cinema"], [8, 15, "Craft market"]]],
  ["Takeaway", "cash", "fun", 40, [[5, 26, "Pizza night"], [9, 29, "Thai"]]],
  ["Beauty", "cash", "fun", 50, [[6, 28, "Nail polish + cream"]]],
];
// name, kind, goal, date offset from this payday (days) or null, per payday (no date), balance before this payday
const FUNDS = [
  ["Christmas", "cash", 400, 37, 0, 190],
  ["Car service", "card", 450, 97, 0, 135],
  ["Holiday", "card", 1500, 229, 0, 565],
  ["Emergency", "card", 1000, null, 100, 800],
  ["Birthdays", "cash", 600, null, 80, 240],
];
const NOTES = {
  Groceries: ["Weekly shop", "Market", "Big shop", "Bread and milk", "Fruit and veg"], Transport: ["Bus pass", "Train", "Taxi home"], Pet: ["Cat food", "Litter", "Vet treats"],
  Coffee: ["Flat white", "Oat latte", "Coffee with Lina"], "Fun money": ["Cinema", "Books", "Craft market", "Bowling"], Takeaway: ["Pizza night", "Thai", "Sushi", "Burgers"], Beauty: ["Nails", "Skincare", "Hair"],
};

export function demoState(today) {
  const S = blankState(), r = rng(20261123);
  S.profile = { ...S.profile, name: "Mia", currency: "EUR", locale: "en-GB", look: "strawberry", maxNote: 50 };
  const start = addDays(today, -10);
  S.pay = { rhythm: "biweekly", anchor: start, day: 25, days: [1, 15], amount: 1850 };
  S.meta = { ...S.meta, unlocked: true, setupDone: true, demo: true, createdAt: addDays(today, -190) + "T09:00:00Z" };
  const p = periodOf(S.pay, today);
  const tx = (date, kind, f) => S.tx.push({ id: uid(), date, kind, amount: 0, note: "", ...f });

  S.envelopes = ENVS.map(([name, kind, group, amount]) => ({ id: uid(), name, kind, group, amount, archived: false }));
  S.funds = FUNDS.map(([name, kind, goal, off, per]) => ({ id: uid(), name, kind, goal, date: off == null ? "" : addDays(p.start, off), per, done: false }));
  const env = n => S.envelopes.find(e => e.name === n), fund = n => S.funds.find(f => f.name === n);

  // Six months of past pay periods: stuffed, spent, then the leftovers unstuffed on the last day.
  let q = p;
  for (let k = 0; k < 13; k++) {
    q = prevPeriod(S.pay, q);
    for (const e of S.envelopes) {
      tx(q.start, "stuff", { env: e.id, amount: e.amount });
      if (e.name === "Rent") { tx(q.start, "spend", { env: e.id, amount: 850, note: "Rent" }); continue; }
      const use = e.name === "Groceries" ? 0.86 + r() * 0.14 : 0.55 + r() * 0.45, n = e.name === "Groceries" ? 4 + Math.floor(r() * 3) : 1 + Math.floor(r() * 3);
      let left = round2(e.amount * use);
      for (let i = 0; i < n && left > 1; i++) {
        const a = i === n - 1 ? left : round2(Math.min(left, (e.amount * use / n) * (0.7 + r() * 0.6)));
        const list = NOTES[e.name] || ["Shop"];
        tx(addDays(q.start, 1 + Math.floor(r() * 12)), "spend", { env: e.id, amount: a, note: list[Math.floor(r() * list.length)] });
        left = round2(left - a);
      }
    }
    for (const f of S.funds) { const a = { Christmas: k < 8 ? 10 : 0, "Car service": 10, Holiday: 25, Emergency: 0, Birthdays: 80 }[f.name]; if (a) tx(q.start, "stuff", { env: f.id, amount: a }); }
    for (const e of S.envelopes) {
      const b = balance(S, e.id, q.end);
      if (b > 0) tx(q.end, "unstuff", { env: e.id, to: r() < 0.7 ? fund("Emergency").id : "debt", amount: b, note: "Unstuffed" });
    }
    S.meta.unstuffed[q.start] = true;
  }
  // Set each fund to where Mia's binder really is before this payday.
  const first = addDays(q.start, 0);
  for (const [name, , , , , before] of FUNDS) {
    const f = fund(name), have = balance(S, f.id, addDays(p.start, -1));
    if (before > have) tx(first, "add", { env: f.id, amount: round2(before - have), note: "Already saved when I started" });
    else if (before < have) tx(addDays(p.start, -2), "spend", { env: f.id, amount: round2(have - before), note: { Emergency: "Boiler repair", Birthdays: "Birthday presents" }[name] || "Spent from the fund" });
  }

  // This pay period: everything stuffed on payday, then a normal week and a half.
  for (const e of S.envelopes) tx(p.start, "stuff", { env: e.id, amount: e.amount });
  for (const f of S.funds) tx(p.start, "stuff", { env: f.id, amount: { Christmas: 70, "Car service": 45, Holiday: 55, Emergency: 100, Birthdays: 80 }[f.name] });
  for (const [name, , , , spends] of ENVS) for (const [d, a, note] of spends) tx(addDays(p.start, Math.min(d, diffDays(p.start, today))), "spend", { env: env(name).id, amount: a, note });
  tx(addDays(p.start, Math.min(9, diffDays(p.start, today))), "move", { from: env("Fun money").id, to: env("Takeaway").id, amount: 15, note: "Thai ran over" });

  // Savings challenges: 100 envelopes (43 done) and 52 weeks (12 done).
  const c = { id: uid(), ...makeChallenge("env100") };
  const DONE = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 14, 15, 17, 18, 20, 21, 23, 25, 26, 28, 30, 31, 33, 35, 36, 40, 41, 42, 44, 45, 47, 50, 52, 55, 60, 61, 66, 70, 75, 80, 88, 99];
  DONE.forEach((n, i) => { c.done[n - 1] = addDays(today, -150 + Math.round(i * 3.4)); });
  c.pick = { i: 63, date: today };
  const w = { id: uid(), ...makeChallenge("week52") };
  for (let i = 0; i < 12; i++) w.done[i] = addDays(today, -7 * (12 - i));
  S.challenges = [c, w];
  return S;
}
