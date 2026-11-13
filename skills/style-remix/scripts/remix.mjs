#!/usr/bin/env node
// One scene, many styles. Writes every prompt, makes the pictures and clips with HyperFrames
// (needs a HyperFrames Pro sign-in), or takes in pictures and clips you made somewhere else.
//
//   node remix.mjs prompts <dir> --subject "..." --pose "..." --background "..."   write prompts.md only
//   node remix.mjs make    <dir> [--scene-image my.png] [--styles pixel-art,claymation] [--no-clips] [--plan]
//   node remix.mjs import  <dir> <folder>     adopt files you downloaded (Higgsfield, ChatGPT, Gemini...)
//
// Everything lands in <dir>/assets/styles/ with a manifest.json that the style-reel skill reads.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'styles.json'), 'utf8'));
const [cmd, dirArg, ...rest] = process.argv.slice(2);
const flag = (name, def = null) => { const i = rest.indexOf(`--${name}`); return i < 0 ? def : (rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : true); };
const die = (m) => { console.error(m); process.exit(1); };
if (!cmd || !dirArg) die('usage: node remix.mjs prompts|make|import <dir> [...]  (see the comment at the top of this file)');

const dir = path.resolve(dirArg);
const out = path.join(dir, 'assets', 'styles');
fs.mkdirSync(out, { recursive: true });
const manifestFile = path.join(out, 'manifest.json');
const settingsFile = path.join(dir, 'remix.json');
const settings = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};
for (const k of ['subject', 'pose', 'background', 'motion']) if (flag(k)) settings[k] = flag(k);
fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));

const pick = flag('styles') ? String(flag('styles')).split(',').map((s) => s.trim()) : null;
const styles = DATA.styles.filter((s) => !pick || pick.includes(s.id));
if (!styles.length) die(`no style matches --styles; known: ${DATA.styles.map((s) => s.id).join(', ')}`);
const nn = (i) => String(i + 1).padStart(2, '0');

function scenePrompt() {
  let p = DATA.scene.prompt;
  for (const [k, re] of [['subject', /\[who[^\]]*\]/], ['pose', /\[what they are doing[^\]]*\]/], ['background', /\[two or three things[^\]]*\]/]]) {
    if (settings[k]) p = p.replace(re, settings[k]);
  }
  return p;
}
const restyle = (s) => DATA.restyle.template.replace('{style}', s.name.toLowerCase()).replace('{look}', s.look);
const animate = (s) => DATA.animate.template.replace('{motion}', settings.motion || DATA.animate.motion).replace('{style}', s.name.toLowerCase());

function writePrompts() {
  const lines = ['# Your prompts', '', 'Paste them into Claude (with the Higgsfield connector), or any image tool, in this order.', '',
    '## 1. The scene', '', '```', scenePrompt(), '```', ''];
  styles.forEach((s, i) => {
    lines.push(`## ${i + 2}. ${s.name}`, '', 'Picture:', '', '```', restyle(s), '```', '', 'Clip:', '', '```', animate(s), '```', '');
  });
  const file = path.join(dir, 'prompts.md');
  fs.writeFileSync(file, lines.join('\n'));
  return file;
}

function manifest(items) {
  fs.writeFileSync(manifestFile, JSON.stringify({ scene: items.scene || null, styles: items.styles }, null, 2));
  return manifestFile;
}

// Run the HyperFrames CLI. HYPERFRAMES_CMD lets a plugin install point at its own launcher.
function hf(args) {
  const base = process.env.HYPERFRAMES_CMD ? process.env.HYPERFRAMES_CMD.split(' ') : ['npx', '-y', 'hyperframes'];
  const r = spawnSync(base[0], [...base.slice(1), ...args], { cwd: dir, encoding: 'utf8', shell: process.platform === 'win32' });
  const text = `${r.stdout || ''}${r.stderr || ''}`;
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try { return JSON.parse(json); } catch { return { ok: r.status === 0, raw: text.trim().slice(-600) }; }
}
// The shell on Windows needs every prompt quoted.
const q = (s) => (process.platform === 'win32' ? `"${String(s).replace(/"/g, '\\"')}"` : s);

if (cmd === 'prompts') {
  console.log(`wrote ${writePrompts()}`);
} else if (cmd === 'make') {
  writePrompts();
  const plan = flag('plan') ? ['--plan'] : [];
  const items = { styles: [] };
  let scene = flag('scene-image') ? path.resolve(String(flag('scene-image'))) : path.join(out, '00-scene.png');
  if (!fs.existsSync(scene)) {
    console.log('making the scene...');
    const r = hf(['media-use', 'generate', '--type', 'image', '--aspect', '9:16', '--prompt', q(scenePrompt()), '--out', path.relative(dir, scene), ...plan]);
    if (!r.ok && !r.plan) die(`scene failed: ${r.error || r.raw}\n${r.fix || ''}`);
    if (r.plan) console.log(`scene: ${r.price?.credits} credits`);
  }
  items.scene = path.relative(out, scene).split(path.sep).join('/');
  for (const [i, s] of styles.entries()) {
    const img = path.join(out, `${nn(i)}-${s.id}.png`);
    const clip = path.join(out, `${nn(i)}-${s.id}.mp4`);
    if (!fs.existsSync(img) || plan.length) {
      console.log(`${s.name}: picture...`);
      const r = hf(['media-use', 'generate', '--type', 'image', '--reference', path.relative(dir, scene), '--aspect', '9:16', '--prompt', q(restyle(s)), '--out', path.relative(dir, img), ...plan]);
      if (!r.ok && !r.plan) { console.error(`  failed: ${r.error || r.raw}`); continue; }
      if (r.plan) console.log(`  ${r.price?.credits} credits`);
    }
    if (!flag('no-clips') && (!fs.existsSync(clip) || plan.length)) {
      console.log(`${s.name}: clip...`);
      const r = hf(['media-use', 'generate', '--type', 'video', '--first-frame', path.relative(dir, img), '--seconds', '5', '--aspect', '9:16', '--prompt', q(animate(s)), '--out', path.relative(dir, clip), ...plan]);
      if (!r.ok && !r.plan) console.error(`  failed: ${r.error || r.raw}`);
      if (r.plan) console.log(`  ${r.price?.credits} credits`);
    }
    items.styles.push({ id: s.id, name: s.name, image: path.basename(img), clip: fs.existsSync(clip) ? path.basename(clip) : null });
  }
  if (!plan.length) console.log(`wrote ${manifest(items)}`);
} else if (cmd === 'import') {
  const from = path.resolve(rest[0] || die('import needs a folder'));
  // Files are matched to styles by a style word in the name, else by sorted order.
  const files = fs.readdirSync(from).filter((f) => /\.(png|jpe?g|webp|mp4|mov|webm)$/i.test(f)).sort();
  const items = { scene: null, styles: [] };
  const key = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const imgs = files.filter((f) => !/\.(mp4|mov|webm)$/i.test(f));
  const clips = files.filter((f) => /\.(mp4|mov|webm)$/i.test(f));
  const sceneFile = imgs.find((f) => /scene|base|original/i.test(f));
  if (sceneFile) { fs.copyFileSync(path.join(from, sceneFile), path.join(out, `00-scene${path.extname(sceneFile)}`)); items.scene = `00-scene${path.extname(sceneFile)}`; }
  const rest2 = imgs.filter((f) => f !== sceneFile);
  for (const [i, s] of styles.entries()) {
    const match = (list) => list.find((f) => key(f).includes(key(s.id)) || key(f).includes(key(s.name)));
    const img = match(rest2) || rest2[i];
    const clip = match(clips) || clips[i];
    const entry = { id: s.id, name: s.name, image: null, clip: null };
    if (img) { entry.image = `${nn(i)}-${s.id}${path.extname(img).toLowerCase()}`; fs.copyFileSync(path.join(from, img), path.join(out, entry.image)); }
    if (clip) { entry.clip = `${nn(i)}-${s.id}${path.extname(clip).toLowerCase()}`; fs.copyFileSync(path.join(from, clip), path.join(out, entry.clip)); }
    items.styles.push(entry);
    console.log(`${s.name.padEnd(18)} picture: ${img || '-'}  clip: ${clip || '-'}`);
  }
  console.log(`wrote ${manifest(items)}`);
} else die(`unknown command ${cmd}`);
