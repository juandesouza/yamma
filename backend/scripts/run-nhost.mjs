#!/usr/bin/env node
/** Run nhost CLI: use backend/bin/nhost if present, else nhost from PATH */
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localBin = path.join(__dirname, '..', 'bin', 'nhost');
const cmd = fs.existsSync(localBin) ? localBin : 'nhost';
const r = spawnSync(cmd, process.argv.slice(2), { stdio: 'inherit', shell: false });
if (r.status !== null) process.exit(r.status);
if (r.signal) process.exit(1);
