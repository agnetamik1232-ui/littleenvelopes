// Little Envelopes — the stuffing card: a 1080 × 1920 picture of this payday for Instagram and TikTok stories.
import * as C from "./calc.js";
import { fdLong } from "./core.js";
import { cur } from "./ui.js";

const WORD = { EUR: "euro", USD: "dollar", GBP: "pound", CAD: "dollar", AUD: "dollar", NZD: "dollar", CHF: "franc", INR: "rupee", ZAR: "rand", MXN: "peso", PHP: "peso", BRL: "real", SGD: "dollar" };

function spaced(g, text, x, y, gap, align = "left") {
  const chars = [...text], widths = chars.map(c => g.measureText(c).width), total = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const keep = g.textAlign; g.textAlign = "left";
  chars.forEach((c, i) => { g.fillText(c, cx, y); cx += widths[i] + gap; });
  g.textAlign = keep;
  return total;
}
function fit(g, text, font, size, maxW) { let s = size; do { g.font = font.replace("SIZE", s + "px"); } while (g.measureText(text).width > maxW && (s -= 2) > 20); return s; }

export async function storyCard(S, p) {
  await Promise.all(["500 80px Fraunces", "italic 400 80px Fraunces", "italic 500 80px Fraunces", "800 30px Nunito", "700 30px Nunito", "600 30px Nunito"].map(f => document.fonts.load(f).catch(() => null)));
  const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d"), css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue("--" + n).trim();
  const plan = C.stuffPlan(S, p), total = plan.stuffed || plan.planned;

  g.fillStyle = v("page"); g.fillRect(0, 0, W, H);
  // the binder cover band, with stitching and three rings
  g.fillStyle = v("leather"); g.fillRect(0, 0, W, 260);
  g.strokeStyle = v("stitch"); g.lineWidth = 3; g.setLineDash([14, 10]); g.strokeRect(24, 24, W - 48, 212); g.setLineDash([]);
  g.fillStyle = v("coverink"); g.font = "800 24px Nunito"; spaced(g, "LITTLE", 84, 118, 9);
  g.font = "italic 500 72px Fraunces"; g.fillText("Envelopes", 80, 190);
  g.font = "700 30px Nunito"; g.textAlign = "right"; g.fillText(`Payday · ${fdLong(p.start)}`, W - 84, 160); g.textAlign = "left";
  for (const x of [300, 540, 780]) {
    const gr = g.createLinearGradient(0, 246, 0, 286); gr.addColorStop(0, v("m1")); gr.addColorStop(.45, v("m2")); gr.addColorStop(1, v("m3"));
    g.strokeStyle = gr; g.lineWidth = 9; g.beginPath(); g.roundRect(x - 50, 248, 100, 34, 17); g.stroke();
  }

  // the headline
  g.fillStyle = v("ink"); g.font = "500 92px Fraunces"; g.fillText("I stuffed", 80, 450);
  g.fillStyle = v("rose"); fit(g, cur(total), "italic 400 SIZE Fraunces", 190, W - 160); g.fillText(cur(total), 72, 640);
  g.fillStyle = v("ink"); g.font = "500 92px Fraunces"; g.fillText("this payday", 80, 760);

  // the envelopes (up to 8 tiles: envelopes first, then one tile for all the sinking funds)
  const envRows = plan.rows.filter(r => r.type === "env" && (r.done ?? r.suggested) > 0);
  const fundRows = plan.rows.filter(r => r.type === "fund" && (r.done ?? r.suggested) > 0);
  const slots = fundRows.length ? 7 : 8;
  const tiles = envRows.length > slots ? [...envRows.slice(0, slots - 1), { more: envRows.length - (slots - 1) }] : [...envRows];
  if (fundRows.length) tiles.push({ name: fundRows.length === 1 ? fundRows[0].name : "Sinking funds", cash: false, type: "fund", done: C.sum(fundRows, r => r.done ?? r.suggested) });
  const pat = document.createElement("canvas"); pat.width = pat.height = 28;
  const pg = pat.getContext("2d"); pg.fillStyle = v("liningbg"); pg.fillRect(0, 0, 28, 28); pg.fillStyle = v("lining"); pg.fillRect(0, 0, 28, 14); pg.fillRect(0, 0, 14, 28);
  const lining = g.createPattern(pat, "repeat");
  const cw = 440, ch = 184, gx = 40, gy = 26, x0 = 80, y0 = 830;
  tiles.forEach((r, i) => {
    const x = x0 + (i % 2) * (cw + gx), y = y0 + Math.floor(i / 2) * (ch + gy);
    if (r.more) {
      g.strokeStyle = v("rule"); g.lineWidth = 3; g.setLineDash([12, 9]); g.strokeRect(x + 2, y + 2, cw - 4, ch - 4); g.setLineDash([]);
      g.fillStyle = v("rose"); g.font = "italic 500 52px Fraunces"; g.textAlign = "center"; g.fillText(`+ ${r.more} more`, x + cw / 2, y + ch / 2 + 18); g.textAlign = "left";
      return;
    }
    g.save(); g.shadowColor = "rgba(0,0,0,.14)"; g.shadowBlur = 24; g.shadowOffsetY = 10; g.fillStyle = v("envbg"); g.fillRect(x, y, cw, ch); g.restore();
    g.strokeStyle = v("envrule"); g.lineWidth = 2; g.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
    g.save(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + cw, y); g.lineTo(x + cw / 2, y + 82); g.closePath(); g.clip();
    g.fillStyle = r.cash ? lining : v("petal"); g.fillRect(x, y, cw, 90); g.restore();
    g.font = "800 20px Nunito"; const name = r.name.toUpperCase().slice(0, 18);
    const tw = [...name].reduce((a, c) => a + g.measureText(c).width + 5, -5);
    const lw = tw + 36, lx = x + cw / 2 - lw / 2, ly = y + 30;
    g.fillStyle = v("lblbg"); g.fillRect(lx - 5, ly - 5, lw + 10, 48); g.strokeStyle = v("goldl"); g.lineWidth = 1.5; g.strokeRect(lx - 4, ly - 4, lw + 8, 46);
    g.strokeStyle = v("gold"); g.lineWidth = 2; g.strokeRect(lx, ly, lw, 38);
    g.fillStyle = v("plum"); spaced(g, name, x + cw / 2, ly + 26, 5, "center");
    g.fillStyle = v("ink"); fit(g, cur(r.done ?? r.suggested), "500 SIZE Fraunces", 62, cw - 170); g.fillText(cur(r.done ?? r.suggested), x + 28, y + ch - 26);
    g.fillStyle = v("kind"); g.font = "800 21px Nunito"; spaced(g, r.cash ? "CASH" : r.type === "fund" ? "SAVED" : "CARD", x + cw - 28, y + ch - 32, 3, "right");
  });

  // the footer
  const fy = 1840;
  g.fillStyle = v("rose"); g.font = "italic 400 54px Fraunces"; g.textAlign = "center";
  g.fillText(plan.unassigned === 0 && plan.rows.length ? `Every ${WORD[S.profile.currency] || "penny"} has a job` : "Every envelope has a job", W / 2, fy - 70);
  g.fillStyle = v("mute"); g.font = "700 26px Nunito"; g.fillText("made with Little Envelopes", W / 2, fy); g.textAlign = "left";
  return new Promise(r => cv.toBlob(r, "image/png"));
}
