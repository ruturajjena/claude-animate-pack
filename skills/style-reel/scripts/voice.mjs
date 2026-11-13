#!/usr/bin/env node
// The voice and its word timings, in one step.
//   node voice.mjs <project>                         free on-device voice (Kokoro), reads script.txt
//   node voice.mjs <project> --voice am_michael      pick a Kokoro voice (npx hyperframes tts --list)
//   node voice.mjs <project> --file take.m4a         your own recording (or a clone from ElevenLabs, Voicebox...)
// Writes <project>/assets/voice.wav and <project>/transcript.json.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [dirArg, ...rest] = process.argv.slice(2);
if (!dirArg) { console.error('usage: node voice.mjs <project> [--voice id] [--speed 1.0] [--file recording]'); process.exit(1); }
const dir = path.resolve(dirArg);
const flag = (n) => { const i = rest.indexOf(`--${n}`); return i < 0 ? null : rest[i + 1]; };
const win = process.platform === 'win32';
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: dir, stdio: 'inherit', shell: win });
  if (r.status !== 0) { console.error(`failed: ${cmd} ${args.join(' ')}`); process.exit(1); }
};
const hf = process.env.HYPERFRAMES_CMD ? process.env.HYPERFRAMES_CMD.split(' ') : ['npx', '-y', 'hyperframes'];
fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
const out = path.join('assets', 'voice.wav');

if (flag('file')) {
  // Any audio or video file: mono 48 kHz WAV, loudness left as recorded.
  run('ffmpeg', ['-v', 'error', '-y', '-i', `"${path.resolve(flag('file'))}"`, '-vn', '-ac', '1', '-ar', '48000', out]);
} else {
  if (!fs.existsSync(path.join(dir, 'script.txt'))) { console.error('no script.txt in the project'); process.exit(1); }
  run(hf[0], [...hf.slice(1), 'tts', 'script.txt', '-o', out, '--voice', flag('voice') || 'am_michael', '--speed', flag('speed') || '1.05']);
}
run(hf[0], [...hf.slice(1), 'transcribe', out, '--dir', '.']);
const tr = path.join(dir, 'transcript.json');
if (!fs.existsSync(tr)) { console.error('transcribe did not write transcript.json'); process.exit(1); }
const words = JSON.parse(fs.readFileSync(tr, 'utf8'));
const list = Array.isArray(words) ? words : words.words || [];
console.log(`voice: ${out}, ${list.length} words, ${(+list.at(-1)?.end || 0).toFixed(1)} s`);
