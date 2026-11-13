#!/usr/bin/env node
// Builds the PDF guide: fills the style prompts from styles.json, then prints with Edge or Chrome.
//   node guide/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(here, '..', 'skills', 'style-remix', 'styles.json'), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const styles = data.styles.map((s, i) => `<div class="pname"><span>${String(i + 1).padStart(2, '0')}</span>${esc(s.name)}</div><div class="prompt">${esc(s.look)}</div>`).join('\n  ');
const html = fs.readFileSync(path.join(here, 'guide.html'), 'utf8').replace('<!--STYLES-->', styles);
const built = path.join(here, '.guide.built.html');
fs.writeFileSync(built, html);
const browsers = [process.env.BROWSER_BIN, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter((b) => b && fs.existsSync(b));
if (!browsers.length) { console.error('no Edge or Chrome found; set BROWSER_BIN'); process.exit(1); }
const out = path.join(here, 'Claude-Animate-Pack-Guide.pdf');
fs.rmSync(out, { force: true });
const r = spawnSync(browsers[0], ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=10000', `--print-to-pdf=${out}`, pathToFileURL(built).href], { encoding: 'utf8' });
// Edge can hand the print to a background process and return before the file lands.
for (let i = 0; i < 60 && !fs.existsSync(out); i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
fs.rmSync(built, { force: true });
if (!fs.existsSync(out)) { console.error(r.stderr || 'the browser did not write the PDF'); process.exit(1); }
console.log(`wrote ${out}`);
