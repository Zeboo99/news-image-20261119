// WORLD NEWS — Thursday 19 November 2026.
// A newspaper front page summing up the day's world news in one image.
// Deterministic: no network, no dates, no randomness. Writes /output/entry.png.
//
// Lead: Trump, Xi and Putin meet in Shenzhen (Reuters, 19 Nov 2026).
// Gulf: Iran hits US bases in Kuwait and Bahrain; US struck Qeshm Island (Reuters, 18 Nov).
// Markets: Anthropic IPO priced at $83, $81.3bn raised, biggest IPO ever (Reuters, 18 Nov).
// Europe: EU proposes a 45bn euro loan for Ukraine (Reuters, 18 Nov).
// India: Cyclone Akvan — Odisha evacuates 47,000+ (Reuters, 19 Nov).
// Space: Voyager 1 reaches one light-day from Earth (NASA / Smithsonian, 18 Nov).

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---------- colours ----------
const PAPER = 0xf6f1e7;
const INK = 0x161616;
const RED = 0x9e1b1b;
const NAVY = 0x1c2f5e;
const BLUE = 0x1e3a8a;
const GOLD = 0xd4a017;
const GREEN = 0x1a7a3a;
const SKY = 0xbfd9ea;
const WHITE = 0xffffff;
const BLACK = 0x000000;
const GREY = 0x6b6b6b;
const ORANGE = 0xe07b00;

// ---------- 5x7 bitmap font (rows as 5-bit numbers, MSB = left pixel) ----------
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14], "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 6, 8, 16, 31], "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2], "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14], "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14], "9": [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0], ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8], ":": [0, 12, 12, 0, 12, 12, 0],
  ";": [0, 12, 12, 0, 12, 4, 8], "!": [4, 4, 4, 4, 4, 0, 4],
  "?": [14, 17, 1, 6, 4, 0, 4], "-": [0, 0, 0, 31, 0, 0, 0],
  "'": [4, 4, 8, 0, 0, 0, 0], '"': [10, 10, 10, 0, 0, 0, 0],
  "(": [2, 4, 8, 8, 8, 4, 2], ")": [8, 4, 2, 2, 2, 4, 8],
  "/": [1, 2, 2, 4, 8, 8, 16], "&": [12, 18, 20, 8, 21, 18, 13],
  "$": [4, 15, 20, 14, 5, 30, 4], "%": [25, 26, 2, 4, 8, 11, 19],
  "+": [0, 4, 4, 31, 4, 4, 0], "=": [0, 0, 31, 0, 31, 0, 0],
  "\u2022": [0, 0, 12, 12, 0, 0, 0], "\u20ac": [6, 9, 16, 30, 16, 9, 6],
  "x": [0, 17, 10, 4, 10, 17, 0],
};

// ---------- canvas ----------
const px = new Uint8Array(W * H * 3);
function fill(color: number): void {
  const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
  for (let i = 0; i < W * H; i++) { px[i * 3] = r; px[i * 3 + 1] = g; px[i * 3 + 2] = b; }
}
function setPix(x: number, y: number, color: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = (color >> 16) & 255; px[i + 1] = (color >> 8) & 255; px[i + 2] = color & 255;
}
function rect(x: number, y: number, w: number, h: number, color: number): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPix(xx, yy, color);
}
function hline(x: number, y: number, w: number, color: number, t = 1): void { rect(x, y, w, t, color); }
function vline(x: number, y: number, h: number, color: number, t = 1): void { rect(x, y, t, h, color); }
function line(x0: number, y0: number, x1: number, y1: number, color: number): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    setPix(x, y, color);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function disc(cx: number, cy: number, r: number, color: number): void {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (x * x + y * y <= r * r) setPix(cx + x, cy + y, color);
  }
}
function ring(cx: number, cy: number, r: number, color: number): void {
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    setPix(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), color);
  }
}

// ---------- text ----------
function charW(scale: number): number { return 6 * scale; }
function textW(s: string, scale: number): number { return s.length * 6 * scale - scale; }
function drawChar(x: number, y: number, ch: string, scale: number, color: number): void {
  const g = FONT[ch] ?? FONT["?"];
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let c = 0; c < 5; c++) {
      if (row & (1 << (4 - c))) rect(x + c * scale, y + r * scale, scale, scale, color);
    }
  }
}
function drawText(x: number, y: number, s: string, scale: number, color: number): void {
  // The bitmap font holds capitals, digits and punctuation only:
  // normalise everything to upper case so no glyph ever falls back to "?".
  const up = s.toUpperCase();
  let cx = x;
  for (const ch of up) { drawChar(cx, y, ch, scale, color); cx += charW(scale); }
}
function drawTextC(cx: number, y: number, s: string, scale: number, color: number): void {
  drawText(cx - Math.floor(textW(s, scale) / 2), y, s, scale, color);
}
function wrap(s: string, scale: number, maxW: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textW(t, scale) <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawWrapped(x: number, y: number, s: string, scale: number, maxW: number, color: number, lh: number): number {
  const lines = wrap(s, scale, maxW);
  lines.forEach((ln, i) => drawText(x, y + i * lh, ln, scale, color));
  return lines.length;
}

// ---------- PNG encoder (stdlib only) ----------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- illustrations ----------
function drawFlagUS(x: number, y: number, w: number, h: number): void {
  const stripe = Math.floor(h / 13);
  for (let i = 0; i < 13; i++) rect(x, y + i * stripe, w, stripe, i % 2 === 0 ? 0xb22234 : WHITE);
  rect(x, y, Math.floor(w * 0.4), stripe * 7, NAVY);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    disc(x + 8 + c * 8, y + 5 + r * 7, 1, WHITE);
  }
}
function drawFlagCN(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, 0xde2910);
  disc(x + 16, y + 18, 6, GOLD);
  for (const [sx, sy] of [[34, 10], [42, 18], [42, 28], [34, 34]]) disc(x + sx, y + sy, 2, GOLD);
}
function drawFlagRU(x: number, y: number, w: number, h: number): void {
  const third = Math.floor(h / 3);
  rect(x, y, w, third, WHITE);
  rect(x, y + third, w, third, 0x0039a6);
  rect(x, y + 2 * third, w, h - 2 * third, 0xd52b1e);
}
function drawSeaPanel(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, NAVY);
  rect(x, y + Math.floor(h * 0.62), w, h - Math.floor(h * 0.62), 0x274b8f);
  // ship silhouette
  rect(x + 18, y + 58, 74, 12, INK);
  rect(x + 42, y + 44, 26, 14, INK);
  vline(x + 54, y + 30, 16, INK, 3);
  // explosion burst
  const bx = x + w - 26, by = y + 22;
  for (let a = 0; a < 12; a++) {
    const t = (a * Math.PI) / 6;
    line(bx, by, Math.round(bx + 16 * Math.cos(t)), Math.round(by + 16 * Math.sin(t)), ORANGE);
  }
  disc(bx, by, 5, GOLD);
}
function drawChartPanel(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, WHITE);
  rect(x, y, w, h, INK); // border via overwrite below
  rect(x + 2, y + 2, w - 4, h - 4, WHITE);
  line(x + 10, y + h - 22, x + 34, y + h - 40, GREEN);
  line(x + 34, y + h - 40, x + 56, y + h - 34, GREEN);
  line(x + 56, y + h - 34, x + 82, y + h - 62, GREEN);
  line(x + 82, y + h - 62, x + w - 12, y + 14, GREEN);
  disc(x + w - 12, y + 14, 3, GREEN);
  drawText(x + 10, y + 8, "$83", 3, INK);
}
function drawEUFlag(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, BLUE);
  for (let i = 0; i < 12; i++) {
    const t = (i * Math.PI) / 6 - Math.PI / 2;
    disc(Math.round(x + w / 2 + 34 * Math.cos(t)), Math.round(y + h / 2 + 34 * Math.sin(t)), 3, GOLD);
  }
}
function drawCyclone(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SKY);
  const cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2);
  for (let r = 8; r <= 44; r += 9) {
    for (let a = 0; a < 300; a += 6) {
      const t = (a * Math.PI) / 180;
      setPix(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), NAVY);
    }
  }
  disc(cx, cy, 5, WHITE);
  line(x + 12, y + h - 14, x + w - 12, y + h - 14, NAVY);
}
function drawSpace(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, BLACK);
  const stars: Array<[number, number]> = [[14, 12], [40, 30], [70, 10], [96, 26], [120, 14], [26, 48], [58, 58], [92, 52], [130, 44], [10, 70], [48, 84], [86, 76], [118, 88], [140, 66]];
  for (const [sx, sy] of stars) disc(x + sx, y + sy, 1, WHITE);
  // dashed trajectory
  for (let i = 0; i < 10; i++) line(x + 8 + i * 14, y + 78 - i * 5, x + 16 + i * 14, y + 74 - i * 5, GOLD);
  // spacecraft: gold body + dish
  rect(x + 96, y + 34, 26, 10, GOLD);
  line(x + 96, y + 44, x + 88, y + 56, GOLD);
  line(x + 122, y + 34, x + 132, y + 26, GOLD);
  disc(x + 109, y + 39, 3, WHITE);
}

// ---------- layout ----------
function kicker(x: number, y: number, s: string): void { drawText(x, y, s, 2, RED); }
function headline(x: number, y: number, s: string, scale: number, maxW: number): number {
  return drawWrapped(x, y, s, scale, maxW, INK, scale === 5 ? 36 : 22);
}
function standfirst(x: number, y: number, s: string, maxW: number): number {
  return drawWrapped(x, y, s, 2, maxW, INK, 17);
}
function rule(y: number): void { hline(30, y, 964, INK, 2); }

function build(): void {
  fill(PAPER);

  // masthead
  hline(30, 22, 964, INK, 5);
  drawTextC(512, 36, "WORLD NEWS", 11, INK);
  hline(30, 126, 964, INK, 2);
  drawTextC(512, 140, "THURSDAY 19 NOVEMBER 2026", 2, INK);
  drawTextC(512, 160, "SHENZHEN  \u2022  KUWAIT  \u2022  NEW YORK  \u2022  BRUSSELS  \u2022  NEW DELHI  \u2022  SPACE", 2, GREY);
  hline(30, 182, 964, INK, 3);
  hline(30, 187, 964, INK, 1);

  // ---- LEAD: Shenzhen summit ----
  kicker(30, 202, "SHENZHEN - THE SUMMIT");
  headline(30, 222, "TRUMP, XI AND PUTIN", 5, 610);
  headline(30, 260, "MEET IN SHENZHEN", 5, 610);
  standfirst(30, 308, "First trilateral of the world's three nuclear powers puts arms control on the table - but no deal is expected as the APEC summit closes.", 600);
  drawFlagUS(668, 202, 100, 130);
  drawFlagCN(780, 202, 100, 130);
  drawFlagRU(892, 202, 100, 130);
  drawTextC(718, 340, "USA", 2, INK);
  drawTextC(830, 340, "CHINA", 2, INK);
  drawTextC(942, 340, "RUSSIA", 2, INK);
  drawTextC(830, 362, "THE THREE NUCLEAR POWERS", 2, GREY);
  rule(392);

  // ---- GRID: stories 2-5 ----
  const colX = [30, 532];
  const rowY = [412, 592];
  const cells: Array<{ kick: string; head: string; stand: string; art: (x: number, y: number, w: number, h: number) => void }> = [
    {
      kick: "THE GULF - WAR",
      head: "IRAN HITS US BASES IN KUWAIT AND BAHRAIN",
      stand: "Gulf states intercept drones and missiles after US jets hit a missile site on Qeshm Island.",
      art: drawSeaPanel,
    },
    {
      kick: "MARKETS - AI",
      head: "ANTHROPIC IPO IS THE BIGGEST EVER",
      stand: "$83 a share raises $81.3bn and values the AI maker at about $1.5tn. Shares debut on Nasdaq today.",
      art: drawChartPanel,
    },
    {
      kick: "EUROPE - UKRAINE",
      head: "EU OFFERS UKRAINE A \u20ac45BN LOAN",
      stand: "Brussels proposes \u20ac25bn for arms and \u20ac20bn for the budget - repaid only after Russia pays reparations.",
      art: drawEUFlag,
    },
    {
      kick: "INDIA - CYCLONE",
      head: "AKVAN BEARS DOWN ON ODISHA",
      stand: "More than 47,000 people evacuated as the third severe cyclone in a month nears land.",
      art: drawCyclone,
    },
  ];
  cells.forEach((c, i) => {
    const x = colX[i % 2];
    const y = rowY[Math.floor(i / 2)];
    kicker(x, y, c.kick);
    const hl = headline(x, y + 20, c.head, 3, 330);
    standfirst(x, y + 20 + hl * 22 + 8, c.stand, 330);
    c.art(x + 348, y + 6, 114, 118);
    if (i % 2 === 0) vline(512, y, 150, INK, 1);
  });
  rule(772);

  // ---- BOTTOM: Voyager ----
  drawSpace(30, 792, 150, 118);
  kicker(200, 792, "SPACE - RECORD");
  headline(200, 812, "VOYAGER 1 REACHES ONE LIGHT-DAY FROM EARTH", 3, 794);
  standfirst(200, 842, "The 1977 probe is 16 billion miles out - the first human-made object a full day of light from home. A radio signal now takes 24 hours to reach it.", 794);

  // ---- TICKER ----
  rect(0, 946, W, 78, BLACK);
  drawTextC(512, 958, "TRUMP-XI-PUTIN MEET IN SHENZHEN  \u2022  IRAN HITS US BASES IN THE GULF", 2, WHITE);
  drawTextC(512, 982, "ANTHROPIC IPO $83  \u2022  EU \u20ac45BN FOR UKRAINE  \u2022  CYCLONE AKVAN  \u2022  VOYAGER 1 LIGHT-DAY", 2, WHITE);
}

build();
mkdirSync("/output", { recursive: true });
writeFileSync("/output/entry.png", encodePNG());
