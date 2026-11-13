#!/usr/bin/env node
// A new, empty reel project that the HyperFrames CLI can check, preview and render.
//   node new.mjs <folder> [--script script.txt]

import fs from 'node:fs';
import path from 'node:path';

const [dirArg, ...rest] = process.argv.slice(2);
if (!dirArg) { console.error('usage: node new.mjs <folder> [--script file]'); process.exit(1); }
const dir = path.resolve(dirArg);
const name = path.basename(dir).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
const write = (f, body) => { const p = path.join(dir, f); if (!fs.existsSync(p)) fs.writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body, null, 2) + '\n'); };
write('package.json', {
  name, private: true, type: 'module',
  scripts: { dev: 'npx --yes hyperframes preview', check: 'npx --yes hyperframes check', render: 'npx --yes hyperframes render --fps 30 --quality delivery -o out/reel.mp4' },
});
write('meta.json', { id: name, name });
write('hyperframes.json', { $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json', paths: { blocks: 'compositions', components: 'compositions/components', assets: 'assets' }, media: { autoProxy: true } });
const i = rest.indexOf('--script');
if (i >= 0 && rest[i + 1]) fs.copyFileSync(path.resolve(rest[i + 1]), path.join(dir, 'script.txt'));
console.log(`made ${dir}`);
