#!/usr/bin/env node
// Checks everything the animate pack needs and says how to fix what is missing.
//   node doctor.mjs

import { spawnSync } from 'node:child_process';

const win = process.platform === 'win32';
// npx is a .cmd shim on Windows and needs a shell; everything else runs without one.
const run = (cmd, args = []) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: win && cmd === 'npx', timeout: 180000 });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
};
const rows = [];
const add = (name, ok, detail, fix) => rows.push({ name, ok, detail, fix });

const nodeMajor = +process.versions.node.split('.')[0];
add('Node.js 22+', nodeMajor >= 22, `v${process.versions.node}`, 'Install the LTS from https://nodejs.org (22 or newer), then open a new terminal.');

const ff = run('ffmpeg', ['-version']);
add('FFmpeg', ff.ok, ff.ok ? ff.out.split('\n')[0].slice(0, 40) : 'not found',
  win ? 'winget install Gyan.FFmpeg  (then open a new terminal)' : process.platform === 'darwin' ? 'brew install ffmpeg' : 'sudo apt install ffmpeg');

const git = run('git', ['--version']);
add('Git', git.ok, git.ok ? git.out : 'not found', win ? 'winget install Git.Git' : process.platform === 'darwin' ? 'xcode-select --install' : 'sudo apt install git');

const hf = run('npx', ['-y', 'hyperframes', '--version']);
add('HyperFrames CLI', hf.ok, hf.ok ? hf.out.split('\n').pop() : 'could not run npx hyperframes', 'Needs Node first. Then: npx hyperframes --version');

const auth = hf.ok ? run('npx', ['-y', 'hyperframes', 'auth', 'status']) : { ok: false, out: '' };
const signed = /Account:/i.test(auth.out);
const pro = /HyperFrames:\s*(Pro|Team|Business)/i.test(auth.out);
add('HyperFrames sign-in (optional)', signed, signed ? (pro ? 'signed in, Pro' : 'signed in, Free (generation needs Pro)') : 'not signed in',
  'Optional. Only for making pictures and clips with HyperFrames: npx hyperframes auth login');

const py = run(win ? 'python' : 'python3', ['-c', 'import kokoro_onnx, soundfile; print("ok")']);
add('Free voice (optional)', py.ok, py.ok ? 'kokoro-onnx ready' : 'not installed',
  'Optional. Only if you want the free robot voice instead of your own: pip install kokoro-onnx soundfile');

const width = Math.max(...rows.map((r) => r.name.length));
for (const r of rows) console.log(`${r.ok ? 'OK  ' : 'MISS'}  ${r.name.padEnd(width)}  ${r.detail}${r.ok ? '' : `\n      fix: ${r.fix}`}`);
const needed = rows.filter((r) => !r.name.includes('optional') && !r.ok);
console.log(needed.length ? `\n${needed.length} required thing(s) missing. Fix them, open a new terminal, and run this again.` : '\nReady. Ask Claude: "make a reel from this script" or "redraw my scene in 10 styles".');
process.exit(needed.length ? 1 : 0);
