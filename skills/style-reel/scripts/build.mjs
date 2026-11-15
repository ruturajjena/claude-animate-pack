#!/usr/bin/env node
// Builds the "one scene, ten styles" reel as a HyperFrames project.
//   node build.mjs <project>
// Reads <project>/reel.json, <project>/assets/styles/manifest.json, the voice and its word-level
// transcript, and writes <project>/index.html. Every cue is timed to the word that says it.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = path.resolve(process.argv[2] || '.');
const die = (m) => { console.error(m); process.exit(1); };
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const exists = (f) => f && fs.existsSync(path.join(dir, f));

const cfg = { ...defaults(), ...(exists('reel.json') ? read('reel.json') : {}) };
cfg.colors = { ...defaults().colors, ...(cfg.colors || {}) };
cfg.cues = { ...defaults().cues, ...(cfg.cues || {}) };
const manifest = exists('assets/styles/manifest.json') ? read('assets/styles/manifest.json') : die('no assets/styles/manifest.json: run the style-remix skill first');
const styles = manifest.styles.filter((s) => s.image || s.clip);
if (styles.length < 2) die('the manifest needs at least two styles with a picture or clip');
if (!exists(cfg.voice)) die(`no voice at ${cfg.voice}`);
const tr = exists(cfg.transcript) ? read(cfg.transcript) : die(`no transcript at ${cfg.transcript}: run npx hyperframes transcribe ${cfg.voice}`);
const words = (Array.isArray(tr) ? tr : tr.words || []).map((w) => ({ text: String(w.text ?? w.word ?? '').trim(), start: +w.start, end: +w.end })).filter((w) => w.text);
if (!words.length) die('the transcript has no words');
// Speech recognition mishears names ("reel" as "real"). When script.txt has the same number of
// words, captions use the script's spelling and the transcript only gives the times.
if (fs.existsSync(path.join(dir, 'script.txt'))) {
  const said = fs.readFileSync(path.join(dir, 'script.txt'), 'utf8').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (said.length === words.length) said.forEach((w, i) => { words[i].text = w; });
  else console.warn(`  captions use the transcript's spelling (script ${said.length} words, transcript ${words.length})`);
}

// ---------------------------------------------------------------------------- timing
const bare = (t) => String(t).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const lev = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
const near = (a, b) => a === b || (a.length > 4 && lev(a, b) <= 2);
// The first word at or after `from` that matches cue (one word, or the first of several).
function find(cue, from = 0) {
  if (cue == null) return -1;
  const first = bare(String(cue).split(/\s+/)[0]);
  for (let i = from; i < words.length; i++) if (near(bare(words[i].text), first)) return i;
  return -1;
}

let cursor = 0;
const styleAt = styles.map((s) => {
  const i = find(s.say || s.name, cursor);
  if (i >= 0) cursor = i + 1;
  return i >= 0 ? words[i].start : null;
});
// Fill any style the voice did not say by spacing it between its neighbours.
for (let i = 0; i < styleAt.length; i++) if (styleAt[i] == null) {
  const prev = i ? styleAt[i - 1] : 0;
  let j = i; while (j < styleAt.length && styleAt[j] == null) j++;
  const next = j < styleAt.length ? styleAt[j] : prev + 0.8 * (j - i + 1);
  for (let k = i; k < j; k++) styleAt[k] = prev + ((next - prev) * (k - i + 1)) / (j - i + 1);
}
const lastWordEnd = words[words.length - 1].end;
const DUR = +(lastWordEnd + cfg.hold).toFixed(3);
const cueTime = (name, fallback) => { const i = find(cfg.cues[name], cursor); return i >= 0 ? words[i].start : fallback; };
const T = {};
T.grid = cueTime('grid', styleAt[styleAt.length - 1] + 0.9);
T.middle = cfg.middle ? cueTime('middle', T.grid + 4) : null;
T.cta = cueTime('cta', (T.middle ?? T.grid) + 5);
T.save = cueTime('save', Math.max(T.cta + 3, DUR - 2));
const wordTime = (cue, from, fallback) => { const i = find(cue, from); return i >= 0 ? words[i].start : fallback; };
const idxAt = (t) => Math.max(0, words.findIndex((w) => w.start >= t - 0.01));

// ---------------------------------------------------------------------------- media
const C = cfg.colors;
const n = styles.length;
const r3 = (x) => +(+x).toFixed(3);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const src = (f) => `assets/styles/${f}`;

// A spoken intro longer than about a second would leave frame one empty; open on the first card.
const OPEN_EARLY = cfg.openOnFirstCard ?? styleAt[0] > 1.2;

// Big card and grid geometry (1080 x 1920 frame).
const CARD = { x: 440, y: 430, w: 540, h: 960 };
// The grid block (rows x (tile + label)) must stay within 764 px, so the CTA and save card
// still fit under it once the grid slides up. Up to 10 styles that is 2 rows of 5; for more,
// pick the column count that gives the biggest tiles. Past 12 styles the tiles are too small
// for readable labels, so the labels are left out (the numbered list already names each one).
const showLabels = cfg.gridLabels ?? n <= 12;
const labelGap = showLabels ? 58 : 22;
const MAX_BLOCK = 764;
let G = null;
for (let c = Math.min(5, Math.ceil(n / 2)); c <= Math.min(10, n); c++) {
  const r = Math.ceil(n / c), g = c > 5 ? 12 : 16;
  const byWidth = Math.round((Math.floor((1080 - 2 * 52 - (c - 1) * g) / c) * 16) / 9);
  const h = Math.min(byWidth, Math.floor(MAX_BLOCK / r - labelGap));
  if (!G || h > G.h) G = { cols: c, rows: r, gap: g, h };
}
const { cols, rows, gap } = G;
const tileH = G.h;
const tileW = Math.round((tileH * 9) / 16);
const s = tileW / CARD.w;
const gridTop = 430;
const tile = (i) => {
  const c = i % cols, r = Math.floor(i / cols);
  const rowCount = r === rows - 1 ? n - cols * (rows - 1) : cols;
  const rowW = rowCount * tileW + (rowCount - 1) * gap;
  const x0 = (1080 - rowW) / 2;
  return { x: x0 + c * (tileW + gap), y: gridTop + r * (tileH + labelGap) };
};
// GSAP moves each card from its deck spot to its tile with x, y and scale about the centre.
const toTile = (i) => { const t = tile(i); return { x: r3(t.x + tileW / 2 - (CARD.x + CARD.w / 2)), y: r3(t.y + tileH / 2 - (CARD.y + CARD.h / 2)), scale: r3(s) }; };

// Captions: up to three words a chunk, broken at punctuation, shown from the grid on.
const chunks = [];
{
  let cur = [];
  const from = idxAt(cfg.captionsFrom === 'start' ? 0 : T.grid);
  for (let i = from; i < words.length; i++) {
    cur.push(words[i]);
    if (cur.length === cfg.captionWords || /[.?!:;]$/.test(words[i].text) || (cur.length >= 2 && /,$/.test(words[i].text)) || i === words.length - 1) { chunks.push(cur); cur = []; }
  }
}

// ---------------------------------------------------------------------------- html
const list = styles.map((st, i) => `
      <div class="row" id="row-${i}" style="top:${470 + i * Math.min(92, 900 / n)}px"><span class="num">${String(i + 1).padStart(2, '0')}</span><span class="name" id="name-${i}">${esc(st.name.toLowerCase())}</span></div>`).join('');

const cards = styles.map((st, i) => {
  const vs = i === 0 && OPEN_EARLY ? 0 : Math.max(0, styleAt[i] - 0.1);
  const vid = st.clip ? `\n        <video class="clip media" id="clip-${i}" data-start="${r3(vs)}" data-duration="${r3(Math.max(0.5, DUR - vs))}" src="${src(st.clip)}" muted playsinline></video>` : '';
  const img = st.image ? `<img class="media still" id="still-${i}" src="${src(st.image)}" alt="${esc(st.name)}">` : '';
  return `
      <div class="card" id="card-${i}" style="z-index:${10 + i}">
        <div class="inner" id="inner-${i}">${img}${vid}
          <div class="shine" id="shine-${i}"></div>
          <div class="tag"><span>${String(i + 1).padStart(2, '0')}/${String(n).padStart(2, '0')}</span>${esc(st.name.toLowerCase())}</div>
        </div>
      </div>`;
}).join('');

const glabels = !showLabels ? "" : styles.map((st, i) => { const t = tile(i); return `<div class="glabel" id="gl-${i}" style="left:${t.x}px;top:${t.y + tileH + 12}px;width:${tileW}px">${esc(st.name.toLowerCase())}</div>`; }).join('');

const pills = (cfg.pills || []).map((p, i) => `<div class="pill" id="pill-${i}">${esc(p.text)}</div>`).join('');
const ctaLines = (cfg.cta.lines || []).map((l, i) => `<div class="cline" id="cl-${i}"><span class="tick">✓</span>${esc(l.text)}</div>`).join('');
const capHtml = chunks.map((c, k) => {
  const start = c[0].start, end = k < chunks.length - 1 ? chunks[k + 1][0].start : DUR;
  return `<div class="clip cap" id="cap-${k}" data-start="${r3(start)}" data-duration="${r3(end - start)}"><span class="capbox">${c.map((w, j) => `<span id="cw-${k}-${j}">${esc(w.text.replace(/[.,?!:;]+$/, ''))}</span>`).join(' ')}</span></div>`;
}).join('\n    ');

const mid = cfg.middle;
const midHtml = mid ? `
    <div class="phone" id="phone"><video class="clip" id="midvid" data-start="${r3(T.middle - 0.4)}" data-duration="${r3(T.cta - T.middle + 0.8)}" data-media-start="${mid.mediaStart || 0}" src="${esc(mid.src)}" muted playsinline></video><div class="sticker" id="sticker">${esc(mid.sticker || 'FREE')}</div></div>
    <div class="midtag" id="midtag">${esc(mid.tag || '')}</div>
    <div class="midtitle" id="midtitle">${esc(mid.title || '')}</div>` : '';

const music = cfg.music && exists(cfg.music) ? `\n    <audio id="music" class="clip" data-start="0" src="${esc(cfg.music)}" data-volume="${cfg.musicVolume}" data-fade-out="2"></audio>` : '';

// ---------------------------------------------------------------------------- timeline
const js = [];
const at = (t) => r3(Math.max(0, t));
js.push(`tl.set('#root',{opacity:1},0);`);
if (cfg.middle) js.push(`tl.set('#phone',{y:1500},0);`);
// Background glows drift for the whole reel.
js.push(`tl.fromTo('#glowA',{x:-80,y:-40},{x:120,y:90,duration:${DUR},ease:'none'},0);`);
js.push(`tl.fromTo('#glowB',{x:60,y:40},{x:-140,y:-120,duration:${DUR},ease:'none'},0);`);
// Header.
js.push(`tl.from('#htag',{y:-20,opacity:0,duration:.4,ease:'power2.out'},0);`);
js.push(`tl.from('#h1 .w',{y:60,opacity:0,stagger:.06,duration:.5,ease:'back.out(1.6)'},0.05);`);
// Rows and cards, one per style.
js.push(`tl.from('.row .num',{opacity:0,x:-20,stagger:.03,duration:.3},0.1);`);
styles.forEach((st, i) => {
  const t = at(styleAt[i] - 0.06);
  js.push(`tl.fromTo('#name-${i}',{opacity:0,x:-14},{opacity:1,x:0,duration:.22,ease:'power2.out'},${t});`);
  js.push(`tl.to('#row-${i}',{color:'${C.accent}',duration:.12},${t});`);
  js.push(`tl.to('#hl',{y:${r3(i * Math.min(92, 900 / n))},duration:.28,ease:'power3.out'},${t});`);
  if (i > 0) js.push(`tl.to('#row-${i - 1}',{color:'${C.ink}',duration:.2},${t});`);
  // The new card swings in from the right; the last one tucks behind. When the script has a
  // spoken intro before the first style, the first card opens the reel so frame one moves.
  const ct = i === 0 && OPEN_EARLY ? 0.25 : t;
  js.push(`tl.fromTo('#card-${i}',{x:420,rotation:9,scale:.86,opacity:0},{x:0,rotation:0,scale:1,opacity:1,duration:.42,ease:'back.out(1.3)'},${ct});`);
  js.push(`tl.fromTo('#shine-${i}',{xPercent:-160},{xPercent:160,duration:.6,ease:'power2.inOut'},${r3(ct + 0.12)});`);
  if (i > 0) js.push(`tl.to('#card-${i - 1}',{rotation:-5,x:-34,scale:.94,duration:.4,ease:'power2.out'},${t});`);
  if (i > 0) js.push(`tl.to('#inner-${i - 1} .tag',{opacity:0,duration:.15},${t});`);
  // Only two cards stay in the deck; older ones wait off stage for the grid.
  if (i > 1) js.push(`tl.to('#card-${i - 2}',{opacity:0,duration:.2},${r3(t + 0.2)});`);
});
js.push(`tl.to('#hl',{opacity:0,duration:.2},${at(T.grid - 0.2)});`);
// Grid: the deck deals out into tiles; the list steps aside.
js.push(`tl.to('#list',{x:-420,opacity:0,duration:.45,ease:'power2.in'},${at(T.grid - 0.25)});`);
styles.forEach((st, i) => {
  const g = toTile(i);
  js.push(`tl.to('#card-${i}',{x:${g.x},y:${g.y},scale:${g.scale},rotation:0,opacity:1,duration:.7,ease:'power3.inOut'},${at(T.grid - 0.15 + i * 0.045)});`);
  if (showLabels) js.push(`tl.to('#gl-${i}',{opacity:1,y:0,duration:.3},${at(T.grid + 0.45 + i * 0.04)});`);
  if (i === n - 1) js.push(`tl.to('#inner-${i} .tag',{opacity:0,duration:.2},${at(T.grid - 0.15)});`);
  // Each tile floats on its own phase so the grid breathes.
  // (on the inner layer, so it never fights the card's own move)
  const per = r3(1.6 + (i % 3) * 0.3);
  js.push(`tl.fromTo('#inner-${i}',{y:0},{y:${i % 2 ? 24 : -24},duration:${per},ease:'sine.inOut',yoyo:true,repeat:${Math.max(1, Math.floor((DUR - T.grid - 1) / per))}},${at(T.grid + 0.7 + i * 0.045)});`);
});
(cfg.pills || []).forEach((p, i) => {
  const t = wordTime(p.at, idxAt(T.grid), T.grid + 0.6 + i * 0.6);
  js.push(`tl.fromTo('#pill-${i}',{scale:.4,opacity:0,y:20},{scale:1,opacity:1,y:0,duration:.35,ease:'back.out(2.2)'},${at(t)});`);
});
let gridOut = T.middle ?? T.cta;
js.push(`tl.to('#pills',{opacity:0,y:-20,duration:.3},${at(gridOut - 0.2)});`);
// Middle video in a phone.
if (mid) {
  js.push(`tl.to('#deck',{opacity:.14,scale:.92,duration:.5,ease:'power2.inOut'},${at(T.middle - 0.3)});`);
  if (showLabels) js.push(`tl.to('.glabel',{opacity:0,duration:.25},${at(T.middle - 0.3)});`);
  if (showLabels) js.push(`tl.to('.glabel',{opacity:1,duration:.3},${at(T.cta + 0.2)});`);
  js.push(`tl.to('#header',{opacity:0,y:-30,duration:.3},${at(T.middle - 0.3)});`);
  js.push(`tl.fromTo('#phone',{y:1500,rotation:6},{y:0,rotation:0,duration:.75,ease:'power3.out'},${at(T.middle - 0.35)});`);
  js.push(`tl.fromTo('#midtag',{opacity:0,y:-16},{opacity:1,y:0,duration:.35},${at(T.middle)});`);
  js.push(`tl.fromTo('#midtitle',{opacity:0,y:30},{opacity:1,y:0,duration:.45,ease:'back.out(1.6)'},${at(T.middle + 0.12)});`);
  const st = wordTime(mid.stickerAt || 'free', idxAt(T.middle), T.middle + 3);
  js.push(`tl.fromTo('#sticker',{scale:3,opacity:0,rotation:-30},{scale:1,opacity:1,rotation:-12,duration:.32,ease:'back.out(2)'},${at(st)});`);
  js.push(`tl.to('#phone',{y:1500,rotation:-6,duration:.55,ease:'power3.in'},${at(T.cta - 0.45)});`);
  js.push(`tl.to(['#midtag','#midtitle'],{opacity:0,duration:.25},${at(T.cta - 0.4)});`);
  js.push(`tl.to('#deck',{opacity:1,scale:1,duration:.5,ease:'power2.out'},${at(T.cta - 0.2)});`);
} else {
  js.push(`tl.to('#header',{opacity:0,y:-30,duration:.3},${at(T.cta - 0.3)});`);
}
// Call to action: the grid rises, the comment word lands letter by letter.
js.push(`tl.to('#deck',{y:-250,duration:.6,ease:'power3.inOut'},${at(T.cta - 0.25)});`);
js.push(`tl.fromTo('#ctaSmall',{opacity:0,y:20},{opacity:1,y:0,duration:.3},${at(T.cta)});`);
js.push(`tl.fromTo('#ctaWord .ch',{opacity:0,y:80,rotation:-12},{opacity:1,y:0,rotation:0,stagger:.045,duration:.45,ease:'back.out(2)'},${at(T.cta + 0.12)});`);
js.push(`tl.fromTo('#ctaUnder',{scaleX:0},{scaleX:1,duration:.5,ease:'power3.out'},${at(T.cta + 0.5)});`);
(cfg.cta.lines || []).forEach((l, i) => {
  const t = wordTime(l.at, idxAt(T.cta), T.cta + 1 + i * 0.7);
  js.push(`tl.fromTo('#cl-${i}',{opacity:0,x:-30},{opacity:1,x:0,duration:.3,ease:'power2.out'},${at(t)});`);
  js.push(`tl.fromTo('#cl-${i} .tick',{scale:0},{scale:1,duration:.3,ease:'back.out(3)'},${at(t + 0.1)});`);
});
// Save.
js.push(`tl.to('#cta',{opacity:0,y:-30,duration:.3},${at(T.save - 0.3)});`);
js.push(`tl.fromTo('#save',{opacity:0},{opacity:1,duration:.2},${at(T.save - 0.05)});`);
js.push(`tl.fromTo('#mark',{y:-260,scale:.6},{y:0,scale:1,duration:.6,ease:'bounce.out'},${at(T.save - 0.05)});`);
js.push(`tl.fromTo('#saveText',{opacity:0,y:30},{opacity:1,y:0,duration:.4,ease:'back.out(1.6)'},${at(T.save + 0.2)});`);
// Captions: the word being said turns accent.
chunks.forEach((c, k) => c.forEach((w, j) => {
  js.push(`tl.set('#cw-${k}-${j}',{color:'${C.accent}'},${at(w.start)});`);
  if (j > 0) js.push(`tl.set('#cw-${k}-${j - 1}',{color:'${C.ink}'},${at(w.start)});`);
}));
chunks.forEach((c, k) => js.push(`tl.from('#cap-${k} .capbox',{scale:.85,opacity:0,duration:.14,ease:'back.out(2)'},${at(c[0].start)});`));

const title = cfg.title.map((line, i) => `<div class="hl${i}">${line.split(' ').map((w) => `<span class="w">${esc(w)}</span>`).join(' ')}</div>`).join('');
const ctaWord = [...cfg.cta.word].map((ch) => `<span class="ch">${esc(ch)}</span>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<title>${esc(cfg.name)}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
  html,body{margin:0;background:${C.paper};}
  #root{position:relative;width:1080px;height:1920px;overflow:hidden;background:${C.paper};font-family:Inter,sans-serif;color:${C.ink};isolation:isolate}
  .dots{position:absolute;inset:0;background-image:radial-gradient(${C.dot} 1.6px,transparent 1.7px);background-size:36px 36px;opacity:.55;z-index:0}
  .glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:.55;z-index:0}
  #glowA{width:760px;height:760px;left:-200px;top:-120px;background:${C.glowA}}
  #glowB{width:820px;height:820px;right:-260px;bottom:120px;background:${C.glowB}}
  #header{position:absolute;left:0;right:0;top:150px;text-align:center;z-index:5}
  #htag{font:600 26px/1 'JetBrains Mono',monospace;letter-spacing:.06em;color:${C.muted};text-transform:lowercase;margin-bottom:22px}
  #h1{font:900 82px/1.02 Inter,sans-serif;letter-spacing:-.03em}
  #h1 .hl1{font:italic 400 96px/1.02 'Playfair Display',serif;color:${C.payoff};letter-spacing:-.01em}
  #h1 .w{display:inline-block}
  #list{position:absolute;left:56px;top:0;width:360px;height:1920px;z-index:6}
  #hl{position:absolute;left:-14px;top:${470 - 14}px;width:370px;height:66px;border-radius:33px;background:${C.accentSoft}}
  .row{position:absolute;left:0;height:40px;display:flex;align-items:center;gap:18px;font:700 34px/1 Inter,sans-serif;color:${C.ink}}
  .num{font:500 24px/1 'JetBrains Mono',monospace;opacity:.5;width:40px}
  .name{opacity:0;letter-spacing:-.01em}
  #deck{position:absolute;inset:0;z-index:4}
  .card{position:absolute;left:${CARD.x}px;top:${CARD.y}px;width:${CARD.w}px;height:${CARD.h}px;opacity:0}
  .inner{position:absolute;inset:0;border-radius:34px;overflow:hidden;background:#ddd;border:8px solid #fff;box-shadow:0 30px 60px -20px rgba(60,30,60,.45),0 6px 18px rgba(60,30,60,.18)}
  .media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .shine{position:absolute;top:-20%;bottom:-20%;width:40%;left:30%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-14deg)}
  .tag{position:absolute;left:22px;bottom:22px;display:flex;gap:12px;align-items:center;padding:12px 20px;border-radius:30px;background:rgba(255,255,255,.92);font:700 30px/1 Inter,sans-serif;color:${C.ink}}
  .tag span{font:700 28px/1 'JetBrains Mono',monospace;color:${C.payoff}}
  .glabel{position:absolute;text-align:center;font:700 28px/1.05 Inter,sans-serif;color:${C.ink};opacity:0;transform:translateY(10px);z-index:5}
  #pills{position:absolute;left:0;right:0;top:${gridTop + rows * (tileH + labelGap) + 30}px;display:flex;justify-content:center;gap:16px;z-index:6}
  .pill{padding:16px 28px;border-radius:40px;background:#fff;font:700 34px/1 Inter,sans-serif;box-shadow:0 8px 24px -8px rgba(60,30,60,.35);opacity:0}
  .pill:last-child{background:${C.accent};color:#fff}
  .phone{position:absolute;left:${(1080 - 500) / 2}px;top:560px;width:500px;height:889px;border-radius:56px;overflow:hidden;border:12px solid #17141a;background:#000;box-shadow:0 40px 80px -24px rgba(40,10,40,.6);z-index:8}
  .phone video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .sticker{position:absolute;right:16px;top:30px;padding:14px 22px;border-radius:16px;background:${C.accent};color:#fff;font:900 40px/1 Inter,sans-serif;letter-spacing:.02em;opacity:0}
  .midtag{position:absolute;left:0;right:0;top:300px;text-align:center;font:600 28px/1 'JetBrains Mono',monospace;color:${C.muted};opacity:0;z-index:8}
  .midtitle{position:absolute;left:0;right:0;top:360px;text-align:center;font:italic 400 110px/1 'Playfair Display',serif;color:${C.payoff};opacity:0;z-index:8}
  #cta{position:absolute;left:0;right:0;top:${gridTop + rows * (tileH + labelGap) - 250 + 40}px;text-align:center;z-index:7}
  #ctaSmall{font:700 40px/1 Inter,sans-serif;color:${C.ink};opacity:0}
  #ctaWord{font:italic 400 168px/1.05 'Playfair Display',serif;color:${C.accent};letter-spacing:-.01em;margin-top:6px}
  #ctaWord .ch{display:inline-block;opacity:0}
  #ctaUnder{width:560px;height:10px;border-radius:5px;margin:4px auto 26px;background:${C.payoff};transform-origin:left center;transform:scaleX(0)}
  .cline{font:600 36px/1.5 Inter,sans-serif;color:${C.ink};opacity:0}
  .tick{display:inline-block;width:42px;height:42px;line-height:42px;border-radius:50%;background:${C.payoff};color:#fff;font-size:24px;margin-right:16px;vertical-align:4px}
  #save{position:absolute;left:0;right:0;top:${gridTop + rows * (tileH + labelGap) - 250 + 60}px;text-align:center;opacity:0;z-index:7}
  #mark{width:80px;height:104px;margin:0 auto 26px;background:${C.accent};clip-path:polygon(0 0,100% 0,100% 100%,50% 76%,0 100%)}
  #saveText{font:italic 400 130px/1 'Playfair Display',serif;color:${C.accent}}
  #saveText b{font:900 104px/1 Inter,sans-serif;color:${C.ink};font-style:normal;letter-spacing:-.03em}
  #saveSub{font:500 34px/1 Inter,sans-serif;color:${C.muted};margin-top:20px}
  .cap{position:absolute;left:0;right:0;top:1585px;display:flex;justify-content:center;z-index:20}
  .capbox{display:inline-block;padding:16px 30px;border-radius:22px;background:#fff;font:800 50px/1.1 Inter,sans-serif;color:${C.ink};box-shadow:0 10px 26px -10px rgba(60,30,60,.4)}
  #brand{position:absolute;left:0;right:0;top:1810px;text-align:center;font:600 28px/1 'JetBrains Mono',monospace;color:${C.muted};opacity:.8;z-index:3}
</style>
</head>
<body>
  <div id="root" data-composition-id="root" data-width="1080" data-height="1920" data-start="0" data-duration="${DUR}" data-layout-allow-overlap data-layout-allow-overflow>
    <div class="dots"></div>
    <div class="glow" id="glowA"></div>
    <div class="glow" id="glowB"></div>
    <div id="header"><div id="htag">${esc(cfg.tag)}</div><div id="h1">${title}</div></div>
    <div id="list"><div id="hl"></div>${list}
    </div>
    <div id="deck">${cards}
      ${glabels}
    </div>
    <div id="pills">${pills}</div>${midHtml}
    <div id="cta"><div id="ctaSmall">${esc(cfg.cta.small)}</div><div id="ctaWord">${ctaWord}</div><div id="ctaUnder"></div>${ctaLines}</div>
    <div id="save"><div id="mark"></div><div id="saveText"><span>Save</span> <b>this</b></div><div id="saveSub">${esc(cfg.saveSub)}</div></div>
    <div id="brand">${esc(cfg.brand)}</div>
    ${capHtml}
    <audio id="voice" class="clip" data-start="0" src="${esc(cfg.voice)}"></audio>${music}
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    ${js.join('\n    ')}
    window.__timelines["root"] = tl;
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(dir, 'index.html'), html);
const timing = { duration: DUR, styles: styles.map((st, i) => ({ name: st.name, at: r3(styleAt[i]) })), ...Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v == null ? null : r3(v)])) };
fs.writeFileSync(path.join(dir, 'timing.json'), JSON.stringify(timing, null, 2));
console.log(`wrote index.html (${DUR}s): styles ${timing.styles.map((x) => x.at).join(' ')} | grid ${timing.grid} middle ${timing.middle} cta ${timing.cta} save ${timing.save}`);

// ---------------------------------------------------------------------------- defaults
function defaults() {
  return {
    name: 'Style reel',
    tag: 'made in claude · steal the prompts',
    title: ['One scene,', 'ten styles.'],
    voice: 'assets/voice.wav',
    transcript: 'transcript.json',
    music: null,
    musicVolume: 0.12,
    hold: 1.5,
    captionsFrom: 'grid',
    captionWords: 4,
    brand: '',
    cues: { grid: 'ten', middle: null, cta: 'comment', save: 'save' },
    pills: [{ text: '1 scene', at: 'scene' }, { text: '1 prompt each', at: 'prompt' }, { text: 'in Claude', at: 'claude' }],
    middle: null,
    cta: { small: 'comment', word: 'ANIMATE', lines: [{ text: 'all 10 prompts', at: 'prompts' }] },
    saveSub: "so you don't lose it",
    colors: {
      paper: '#FAF6F0', ink: '#1D1A1F', muted: '#5E5560', dot: '#E3D6CF',
      accent: '#E5414B', accentSoft: 'rgba(229,65,75,.12)', payoff: '#5B2A55',
      glowA: '#F6C9C9', glowB: '#D9CBF2',
    },
  };
}
