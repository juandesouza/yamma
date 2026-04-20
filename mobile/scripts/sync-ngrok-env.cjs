/**
 * Reads ngrok's local API (http://127.0.0.1:4040) and sets EXPO_PUBLIC_PAYMENT_RETURN_BASE_URL
 * in mobile/.env to the https tunnel that forwards to port 3001.
 * Run after `ngrok http 3001` when the public URL changes, then restart Expo.
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

async function main() {
  const res = await fetch('http://127.0.0.1:4040/api/tunnels');
  if (!res.ok) {
    throw new Error(`ngrok local API returned ${res.status}. Start ngrok: ngrok http 3001`);
  }
  const { tunnels } = await res.json();
  const tunnel = (tunnels ?? []).find(
    (t) =>
      t.proto === 'https' &&
      t.config?.addr &&
      /(^|\/\/)(localhost|127\.0\.0\.1):3001\b/.test(String(t.config.addr)),
  );
  if (!tunnel?.public_url) {
    throw new Error('No https tunnel to localhost:3001. Run: ngrok http 3001');
  }
  const origin = tunnel.public_url.replace(/\/$/, '');
  const line = `EXPO_PUBLIC_PAYMENT_RETURN_BASE_URL=${origin}`;
  let text = fs.readFileSync(envPath, 'utf8');
  if (/^EXPO_PUBLIC_PAYMENT_RETURN_BASE_URL=/m.test(text)) {
    text = text.replace(/^EXPO_PUBLIC_PAYMENT_RETURN_BASE_URL=.*$/m, line);
  } else {
    text = text.trimEnd() + `\n\n${line}\n`;
  }
  fs.writeFileSync(envPath, text);
  console.log(`Updated mobile/.env: ${line}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
