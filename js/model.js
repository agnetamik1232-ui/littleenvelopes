// Little Envelopes — the shape of a buyer's binder, and defaults.
export const VERSION = 1;
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const CURRENCIES = [["EUR", "Euro (€)"], ["USD", "US dollar ($)"], ["GBP", "Pound (£)"], ["CAD", "Canadian dollar"], ["AUD", "Australian dollar"], ["NZD", "New Zealand dollar"], ["CHF", "Swiss franc"], ["SEK", "Swedish krona"], ["NOK", "Norwegian krone"], ["DKK", "Danish krone"], ["PLN", "Polish złoty"], ["ZAR", "South African rand"], ["INR", "Indian rupee"], ["SGD", "Singapore dollar"], ["MXN", "Mexican peso"], ["BRL", "Brazilian real"], ["PHP", "Philippine peso"]];

// Ideas offered in setup and when adding an envelope: [name, cash or card, group, share of pay]
export const ENVELOPE_IDEAS = [
  ["Rent", "card", "bills", 0.42], ["Bills", "card", "bills", 0.08], ["Phone + internet", "card", "bills", 0.04], ["Transport", "card", "bills", 0.05],
  ["Groceries", "cash", "everyday", 0.16], ["Household", "cash", "everyday", 0.03], ["Pet", "cash", "everyday", 0.03], ["Kids", "cash", "everyday", 0.05], ["Petrol", "cash", "everyday", 0.05],
  ["Fun money", "cash", "fun", 0.04], ["Takeaway", "cash", "fun", 0.02], ["Beauty", "cash", "fun", 0.03], ["Coffee", "cash", "fun", 0.015], ["Clothes", "cash", "fun", 0.03], ["Gifts", "cash", "fun", 0.02],
];
export const FUND_IDEAS = ["Emergency", "Christmas", "Holiday", "Car", "Birthdays", "Vet", "Home", "Wedding"];

export function blankState() {
  return {
    version: VERSION,
    profile: { name: "", currency: "EUR", locale: navLocale(), look: "strawberry", dark: false, bigText: false, easyFont: false, hide: false, stuffMode: "add", maxNote: 0 },
    pay: { rhythm: "biweekly", anchor: "", day: 25, days: [1, 15], amount: 0 },
    periodIncome: {},           // a different pay for one payday: { "2026-11-13": 1900 }
    envelopes: [],              // { id, name, kind: "cash" | "card", group, amount (each payday), archived }
    funds: [],                  // sinking funds: { id, name, kind, goal, date, per, done }
    challenges: [],             // { id, type, name, cells: [amount], scale, done: { index: date }, pick }
    tx: [],                     // see calc.js
    meta: { createdAt: new Date().toISOString(), setupDone: false, unlocked: false, demo: false, lastBackup: null, unstuffed: {} },
  };
}
function navLocale() { try { return navigator.language || "en-GB"; } catch { return "en-GB"; } }

export const newEnvelope = (f = {}) => ({ id: uid(), name: "", kind: "cash", group: "everyday", amount: 0, archived: false, ...f });
export const newFund = (f = {}) => ({ id: uid(), name: "", kind: "card", goal: 0, date: "", per: 0, done: false, ...f });
export const newTx = (f = {}) => ({ id: uid(), date: "", kind: "spend", amount: 0, note: "", ...f });

export function normalise(s) {
  const b = blankState(), out = { ...b, ...s };
  out.profile = { ...b.profile, ...(s.profile || {}) };
  out.pay = { ...b.pay, ...(s.pay || {}) };
  out.meta = { ...b.meta, ...(s.meta || {}) };
  out.periodIncome = s.periodIncome && typeof s.periodIncome === "object" ? s.periodIncome : {};
  out.envelopes = Array.isArray(s.envelopes) ? s.envelopes.map(e => newEnvelope({ ...e, id: e.id || uid(), amount: Number(e.amount) || 0, kind: e.kind === "card" ? "card" : "cash" })) : [];
  out.funds = Array.isArray(s.funds) ? s.funds.map(f => newFund({ ...f, id: f.id || uid(), goal: Number(f.goal) || 0, per: Number(f.per) || 0 })) : [];
  out.challenges = Array.isArray(s.challenges) ? s.challenges.filter(c => c && Array.isArray(c.cells)).map(c => ({ id: c.id || uid(), type: c.type || "custom", name: c.name || "Challenge", cells: c.cells.map(Number), scale: c.scale || 1, done: c.done || {}, pick: c.pick || null })) : [];
  out.tx = Array.isArray(s.tx) ? s.tx.filter(t => t && t.date && t.kind).map(t => ({ ...t, id: t.id || uid(), amount: Number(t.amount) || 0 })) : [];
  out.version = VERSION;
  return out;
}
