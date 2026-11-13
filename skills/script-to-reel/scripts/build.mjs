#!/usr/bin/env node
// Script to reel: turns beats.json + a voice + its word timings into a HyperFrames reel.
//   node build.mjs <project>
// Each beat lands on the word that says it and holds until the next beat. Captions follow the voice.

import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] || '.');
const die = (m) => { console.error(m); process.exit(1); };
const has = (f) => f && fs.existsSync(path.join(dir, f));
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
if (!has('beats.json')) die('no beats.json: write it first (see SKILL.md)');
const B = read('beats.json');
const voice = B.voice || 'assets/voice.wav';
const trFile = B.transcript || 'transcript.json';
if (!has(voice)) die(`no voice at ${voice}`);
if (!has(trFile)) die(`no ${trFile}: run  npx hyperframes transcribe ${voice}`);
const tr = read(trFile);
const words = (Array.isArray(tr) ? tr : tr.words || []).map((w) => ({ text: String(w.text ?? w.word ?? '').trim(), start: +w.start, end: +w.end })).filter((w) => w.text);
if (!words.length) die('the transcript has no words');
// Speech recognition mishears names ("reel" as "real"). When script.txt has the same number of
// words, captions use the script's spelling and the transcript only gives the times.
if (fs.existsSync(path.join(dir, 'script.txt'))) {
  const said = fs.readFileSync(path.join(dir, 'script.txt'), 'utf8').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (said.length === words.length) said.forEach((w, i) => { words[i].text = w; });
  else console.warn(`  captions use the transcript's spelling (script ${said.length} words, transcript ${words.length})`);
}

const LOOKS = {
  paper: { paper: '#FAF6F0', ink: '#1D1A1F', muted: '#5E5560', dot: '#E3D6CF', accent: '#E5414B', payoff: '#5B2A55', card: '#FFFFFF', glowA: '#F6C9C9', glowB: '#D9CBF2' },
  night: { paper: '#121018', ink: '#F4EFF7', muted: '#B9AFC2', dot: '#2A2433', accent: '#FF6B6B', payoff: '#C9A7FF', card: '#1E1A26', glowA: '#4A2440', glowB: '#2B2850' },
  mint: { paper: '#F1F6F2', ink: '#14231B', muted: '#4D5E54', dot: '#D2E2D7', accent: '#1F8A5B', payoff: '#0E4D64', card: '#FFFFFF', glowA: '#CDEBD9', glowB: '#CFE3F2' },
};
const C = { ...(LOOKS[B.look] || LOOKS.paper), ...(B.colors || {}) };

// ---------------------------------------------------------------------------- timing
const bare = (t) => String(t).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const r3 = (x) => +(+x).toFixed(3);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// *word* turns into the italic payoff colour.
const rich = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
let cursor = 0;
// A cue is seconds, or a phrase: the first word of it, at or after the last cue found.
function cue(c, from = cursor, move = true) {
  if (typeof c === 'number') return c;
  if (c == null) return null;
  const parts = String(c).split(/\s+/).map(bare).filter(Boolean);
  for (let i = from; i < words.length; i++) {
    if (parts.every((p, k) => words[i + k] && bare(words[i + k].text) === p)) { if (move) cursor = i + 1; return words[i].start; }
  }
  console.warn(`  cue not heard: "${c}"`);
  return null;
}
const DUR = r3(words[words.length - 1].end + (B.hold ?? 1.5));
const beats = B.beats.map((b, i) => ({ ...b, i, t: cue(b.at) }));
beats.forEach((b, i) => { if (b.t == null) b.t = i ? beats[i - 1].t + 2 : 0; });
beats[0].t = Math.min(beats[0].t, 0.05);
beats.forEach((b, i) => { b.end = i < beats.length - 1 ? beats[i + 1].t : DUR; });

// ---------------------------------------------------------------------------- beats
const js = [];
const at = (t) => r3(Math.max(0, t));
const html = [];
const IN = { title: 'up', stat: 'pop', list: 'up', image: 'flip', video: 'rise', quote: 'up', code: 'rise', chat: 'up', cta: 'up' };

for (const b of beats) {
  const id = `b${b.i}`;
  let inner = '';
  const local = []; // [time, js] item cues inside the beat
  const itemCue = (c, k, fallback) => { const t = cue(c, Math.max(0, words.findIndex((w) => w.start >= b.t - 0.01)), false); return t != null && t < b.end ? t : fallback; };
  switch (b.type) {
    case 'title':
      inner = `${b.kicker ? `<div class="kicker">${esc(b.kicker)}</div>` : ''}<div class="big">${String(b.text).split(' ').map((w) => `<span class="w">${rich(w)}</span>`).join(' ')}</div>${b.sub ? `<div class="sub">${rich(b.sub)}</div>` : ''}`;
      local.push([b.t + 0.05, `tl.from('#${id} .w',{y:70,opacity:0,rotation:4,stagger:.07,duration:.5,ease:'back.out(1.7)'},T);`]);
      break;
    case 'stat': {
      const target = parseFloat(String(b.value).replace(/[^0-9.]/g, '')) || 0;
      const prefix = String(b.value).match(/^[^0-9]*/)[0], suffix = String(b.value).match(/[^0-9.,]*$/)[0];
      inner = `${b.kicker ? `<div class="kicker">${esc(b.kicker)}</div>` : ''}<div class="stat"><span id="${id}-n">${esc(b.value)}</span></div><div class="sub">${rich(b.label || '')}</div>`;
      local.push([b.t + 0.1, `{const o={v:0};tl.to(o,{v:${target},duration:${r3(Math.min(1.4, (b.end - b.t) * 0.6))},ease:'power2.out',onUpdate:()=>{document.getElementById('${id}-n').textContent='${esc(prefix)}'+Math.round(o.v).toLocaleString('en-US')+'${esc(suffix)}'}},T);}`]);
      local.push([b.t + 0.1, `tl.fromTo('#${id} .stat',{scale:.6},{scale:1,duration:.6,ease:'back.out(2)'},T);`]);
      break;
    }
    case 'list':
      inner = `${b.heading ? `<div class="kicker">${rich(b.heading)}</div>` : ''}<div class="list">${b.items.map((it, k) => `<div class="li" id="${id}-i${k}"><span class="dot">${k + 1}</span>${rich(typeof it === 'string' ? it : it.text)}</div>`).join('')}</div>`;
      b.items.forEach((it, k) => {
        const t = itemCue(typeof it === 'string' ? null : it.at, k, b.t + 0.3 + k * 0.5);
        local.push([t, `tl.fromTo('#${id}-i${k}',{x:-60,opacity:0},{x:0,opacity:1,duration:.35,ease:'power3.out'},T);tl.fromTo('#${id}-i${k} .dot',{scale:0},{scale:1,duration:.35,ease:'back.out(3)'},T+.08);`]);
      });
      break;
    case 'image':
      inner = `<div class="frame"><img class="ph" id="${id}-img" src="${esc(b.src)}" alt="${esc(b.caption || '')}"></div>${b.caption ? `<div class="cap2">${rich(b.caption)}</div>` : ''}`;
      local.push([b.t, `tl.fromTo('#${id}-img',{scale:1.12},{scale:1,duration:${r3(b.end - b.t + 0.4)},ease:'none'},T);`]);
      break;
    case 'video':
      inner = `<div class="frame phone"><video class="clip ph" id="${id}-vid" data-start="${r3(Math.max(0, b.t - 0.3))}" data-duration="${r3(b.end - b.t + 0.6)}" data-media-start="${b.mediaStart || 0}" src="${esc(b.src)}" muted playsinline></video></div>${b.caption ? `<div class="cap2">${rich(b.caption)}</div>` : ''}`;
      break;
    case 'quote':
      inner = `<div class="quote">“${rich(b.text)}”</div>${b.by ? `<div class="sub">— ${esc(b.by)}</div>` : ''}`;
      break;
    case 'code':
      inner = `<div class="term"><div class="bar"><i></i><i></i><i></i></div>${b.lines.map((l, k) => `<div class="cl" id="${id}-c${k}"><span>${esc(l)}</span></div>`).join('')}</div>${b.caption ? `<div class="cap2">${rich(b.caption)}</div>` : ''}`;
      b.lines.forEach((l, k) => local.push([b.t + 0.35 + k * Math.min(0.7, (b.end - b.t - 0.6) / Math.max(1, b.lines.length)), `tl.fromTo('#${id}-c${k} span',{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)',duration:${r3(Math.min(0.6, 0.02 * l.length + 0.15))},ease:'steps(${Math.max(4, Math.min(40, l.length))})'},T);`]));
      break;
    case 'chat':
      inner = `<div class="chat"><div class="msg me" id="${id}-q">${rich(b.prompt)}</div><div class="msg ai" id="${id}-a"><b>${esc(b.from || 'Claude')}</b>${rich(b.reply)}</div></div>`;
      local.push([b.t + 0.2, `tl.fromTo('#${id}-q',{y:40,opacity:0},{y:0,opacity:1,duration:.4,ease:'back.out(1.6)'},T);`]);
      local.push([itemCue(b.replyAt, 0, b.t + Math.min(1.4, (b.end - b.t) / 2)), `tl.fromTo('#${id}-a',{y:40,opacity:0},{y:0,opacity:1,duration:.4,ease:'back.out(1.6)'},T);`]);
      break;
    case 'cta':
      inner = `<div class="sub">${esc(b.small || 'comment')}</div><div class="ctaw">${[...String(b.word)].map((ch) => `<span class="ch">${esc(ch)}</span>`).join('')}</div><div class="under"></div>${(b.lines || []).map((l, k) => `<div class="cline" id="${id}-l${k}"><span class="tick">✓</span>${rich(typeof l === 'string' ? l : l.text)}</div>`).join('')}`;
      local.push([b.t + 0.1, `tl.fromTo('#${id} .ch',{opacity:0,y:80,rotation:-12},{opacity:1,y:0,rotation:0,stagger:.045,duration:.45,ease:'back.out(2)'},T);tl.fromTo('#${id} .under',{scaleX:0},{scaleX:1,duration:.5,ease:'power3.out'},T+.4);`]);
      (b.lines || []).forEach((l, k) => local.push([itemCue(typeof l === 'string' ? null : l.at, k, b.t + 1 + k * 0.6), `tl.fromTo('#${id}-l${k}',{opacity:0,x:-30},{opacity:1,x:0,duration:.3},T);`]));
      break;
    default:
      die(`beat ${b.i}: unknown type "${b.type}"`);
  }
  html.push(`<div class="beat t-${b.type}" id="${id}">${inner}</div>`);
  // In, items, out.
  const kind = IN[b.type];
  const from = kind === 'pop' ? '{scale:.7,opacity:0}' : kind === 'flip' ? '{rotationY:-70,opacity:0,y:40}' : kind === 'rise' ? '{y:500,opacity:0}' : '{y:80,opacity:0}';
  const to = kind === 'pop' ? '{scale:1,opacity:1' : kind === 'flip' ? '{rotationY:0,opacity:1,y:0' : '{y:0,opacity:1';
  js.push(`tl.fromTo('#${id}',${from},${to},duration:.5,ease:'power3.out'},${at(b.t - 0.12)});`);
  for (const [t, code] of local) js.push(code.replace(/\bT\b/g, String(at(t))));
  if (b.end < DUR - 0.01) js.push(`tl.to('#${id}',{opacity:0,y:-60,duration:.25,ease:'power2.in'},${at(b.end - 0.22)});`);
}

// ---------------------------------------------------------------------------- captions
const chunks = [];
{ let cur = []; words.forEach((w, i) => { cur.push(w); if (cur.length === 4 || /[.?!:;]$/.test(w.text) || (cur.length >= 2 && /,$/.test(w.text)) || i === words.length - 1) { chunks.push(cur); cur = []; } }); }
const caps = B.captions === false ? '' : chunks.map((c, k) => {
  const s0 = c[0].start, e0 = k < chunks.length - 1 ? chunks[k + 1][0].start : DUR;
  c.forEach((w, j) => { js.push(`tl.set('#w${k}-${j}',{color:'${C.accent}'},${at(w.start)});`); if (j) js.push(`tl.set('#w${k}-${j - 1}',{color:'${C.ink}'},${at(w.start)});`); });
  return `<div class="clip cap" id="cap${k}" data-start="${r3(s0)}" data-duration="${r3(e0 - s0)}"><span class="capbox">${c.map((w, j) => `<span id="w${k}-${j}">${esc(w.text.replace(/[.,?!:;]+$/, ''))}</span>`).join(' ')}</span></div>`;
}).join('\n    ');
js.push(`tl.fromTo('#glowA',{x:-80,y:-40},{x:120,y:90,duration:${DUR},ease:'none'},0);`, `tl.fromTo('#glowB',{x:60,y:40},{x:-140,y:-120,duration:${DUR},ease:'none'},0);`);
const music = B.music && has(B.music) ? `\n    <audio id="music" class="clip" data-start="0" src="${esc(B.music)}" data-volume="${B.musicVolume ?? 0.12}" data-fade-out="2"></audio>` : '';

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<title>${esc(B.title || 'Reel')}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
  html,body{margin:0;background:${C.paper}}
  #root{position:relative;width:1080px;height:1920px;overflow:hidden;background:${C.paper};color:${C.ink};font-family:Inter,sans-serif;isolation:isolate}
  .dots{position:absolute;inset:0;background-image:radial-gradient(${C.dot} 1.6px,transparent 1.7px);background-size:36px 36px;opacity:.6}
  .glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:.55}
  #glowA{width:760px;height:760px;left:-200px;top:-120px;background:${C.glowA}}
  #glowB{width:820px;height:820px;right:-260px;bottom:120px;background:${C.glowB}}
  em{font-family:'Playfair Display',serif;font-style:italic;font-weight:400;color:${C.payoff}}
  .beat{position:absolute;left:70px;right:70px;top:300px;height:1160px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;opacity:0;perspective:1400px}
  .kicker{font:600 30px/1.2 'JetBrains Mono',monospace;color:${C.muted};margin-bottom:28px;letter-spacing:.04em}
  .big{font:900 104px/1.02 Inter,sans-serif;letter-spacing:-.035em}
  .big .w{display:inline-block}
  .big em{font-size:116px;letter-spacing:-.01em}
  .sub{font:500 40px/1.3 Inter,sans-serif;color:${C.muted};margin-top:26px}
  .stat{font:900 220px/1 Inter,sans-serif;letter-spacing:-.05em;color:${C.accent}}
  .list{display:flex;flex-direction:column;gap:26px;align-items:stretch;width:880px}
  .li{display:flex;align-items:center;gap:26px;padding:28px 34px;border-radius:28px;background:${C.card};font:700 44px/1.15 Inter,sans-serif;text-align:left;box-shadow:0 18px 40px -22px rgba(40,20,50,.45);opacity:0}
  .dot{flex:none;width:64px;height:64px;border-radius:50%;background:${C.accent};color:#fff;font:800 32px/64px Inter,sans-serif;text-align:center}
  .frame{width:760px;height:1000px;border-radius:40px;overflow:hidden;border:10px solid ${C.card};box-shadow:0 40px 80px -30px rgba(40,20,50,.55);position:relative;background:#000}
  .frame.phone{width:560px;height:996px;border:14px solid #17141a;border-radius:60px}
  .ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .cap2{font:700 42px/1.25 Inter,sans-serif;margin-top:30px}
  .quote{font:italic 400 84px/1.15 'Playfair Display',serif;color:${C.ink}}
  .term{width:900px;border-radius:28px;background:#17141a;color:#EDE6F2;text-align:left;padding:0 0 34px;box-shadow:0 40px 80px -30px rgba(20,10,30,.6);overflow:hidden}
  .bar{display:flex;gap:12px;padding:22px 26px;background:#24202b}
  .bar i{width:20px;height:20px;border-radius:50%;background:#FF5F57}.bar i+i{background:#FEBC2E}.bar i+i+i{background:#28C840}
  .cl{font:500 36px/1.6 'JetBrains Mono',monospace;padding:0 34px;white-space:pre}
  .cl span{display:inline-block}
  .chat{width:900px;display:flex;flex-direction:column;gap:30px}
  .msg{padding:30px 36px;border-radius:32px;font:600 40px/1.3 Inter,sans-serif;text-align:left;opacity:0;box-shadow:0 18px 40px -22px rgba(40,20,50,.45)}
  .msg.me{align-self:flex-end;max-width:720px;background:${C.accent};color:#fff;border-bottom-right-radius:8px}
  .msg.ai{align-self:flex-start;max-width:800px;background:${C.card};border-bottom-left-radius:8px}
  .msg.ai b{display:block;font:700 28px/1 'JetBrains Mono',monospace;color:${C.payoff};margin-bottom:14px}
  .ctaw{font:italic 400 180px/1.05 'Playfair Display',serif;color:${C.accent}}
  .ctaw .ch{display:inline-block;opacity:0}
  .under{width:560px;height:10px;border-radius:5px;margin:6px auto 30px;background:${C.payoff};transform-origin:left center}
  .cline{font:600 40px/1.6 Inter,sans-serif;opacity:0}
  .tick{display:inline-block;width:44px;height:44px;line-height:44px;border-radius:50%;background:${C.payoff};color:#fff;font-size:24px;margin-right:16px;vertical-align:5px}
  .cap{position:absolute;left:0;right:0;top:1560px;display:flex;justify-content:center;z-index:20}
  .capbox{display:inline-block;padding:16px 30px;border-radius:22px;background:${C.card};font:800 50px/1.1 Inter,sans-serif;color:${C.ink};box-shadow:0 10px 26px -10px rgba(40,20,50,.4)}
  #brand{position:absolute;left:0;right:0;top:1810px;text-align:center;font:600 28px/1 'JetBrains Mono',monospace;color:${C.muted};opacity:.8}
</style>
</head>
<body>
  <div id="root" data-composition-id="root" data-width="1080" data-height="1920" data-start="0" data-duration="${DUR}" data-layout-allow-overlap data-layout-allow-overflow>
    <div class="dots"></div><div class="glow" id="glowA"></div><div class="glow" id="glowB"></div>
    ${html.join('\n    ')}
    <div id="brand">${esc(B.brand || '')}</div>
    ${caps}
    <audio id="voice" class="clip" data-start="0" src="${esc(voice)}"></audio>${music}
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
fs.writeFileSync(path.join(dir, 'index.html'), page);
console.log(`wrote index.html (${DUR}s, ${beats.length} beats): ${beats.map((b) => `${b.type}@${r3(b.t)}`).join(' ')}`);
