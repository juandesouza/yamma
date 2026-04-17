#!/usr/bin/env node
/**
 * Install nHost CLI binary into backend/bin/.
 * Uses GitHub releases; run from backend/: npm run nhost:install
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = '1.31.3';
const REPO = 'nhost/cli';

const platform = process.platform === 'darwin' ? 'darwin' : 'linux';
const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
const tarball = `cli-v${VERSION}-${platform}-${arch}.tar.gz`;
const url = `https://github.com/${REPO}/releases/download/v${VERSION}/${tarball}`;
const binDir = path.join(__dirname, '..', 'bin');
const destPath = path.join(binDir, 'nhost');

function download(url) {
  return new Promise((resolve, reject) => {
    const file = path.join(binDir, tarball);
    fs.mkdirSync(binDir, { recursive: true });
    const out = fs.createWriteStream(file);
    const follow = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(out);
        out.on('finish', () => { out.close(); resolve(file); });
      }).on('error', reject);
    };
    follow(url);
  });
}

async function main() {
  console.log('Downloading nHost CLI', VERSION, `(${platform}-${arch})...`);
  try {
    const file = await download(url);
    execSync(`tar -xzf "${file}" -C "${binDir}"`, { stdio: 'inherit' });
    const cliPath = path.join(binDir, 'cli');
    if (fs.existsSync(cliPath)) {
      fs.renameSync(cliPath, destPath);
      fs.chmodSync(destPath, 0o755);
    }
    fs.unlinkSync(file);
    console.log('nHost CLI installed at', destPath);
    console.log('Run from backend: ./bin/nhost info  or  npm run nhost:info (if nhost is on PATH)');
  } catch (err) {
    console.error('Install failed:', err.message);
    console.error('Install manually: curl -sL https://raw.githubusercontent.com/nhost/cli/main/get.sh | bash');
    process.exit(1);
  }
}

main();
