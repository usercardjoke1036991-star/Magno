/**
 * Guarda Twilio en .env.worker y .env sin imprimir secretos.
 * Uso:
 *   node scripts/set-sms-keys.mjs --sid ACxxx --token xxxx --from +15551234567
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

function upsert(filePath, key, value) {
  if (!existsSync(filePath)) {
    writeFileSync(filePath, `${key}=${value}\n`, 'utf8');
    return;
  }
  const original = readFileSync(filePath, 'utf8');
  const lines = original.split(/\r?\n/);
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    if (next.length && next[next.length - 1] === '') next[next.length - 1] = `${key}=${value}`;
    else next.push(`${key}=${value}`);
    if (next[next.length - 1] !== '') next.push('');
  }
  writeFileSync(filePath, next.join('\n'), 'utf8');
}

const sid = arg('sid') || process.env.TWILIO_ACCOUNT_SID || '';
const token = arg('token') || process.env.TWILIO_AUTH_TOKEN || '';
const from = arg('from') || process.env.TWILIO_FROM || '';

if (!/^AC[0-9a-fA-F]{32}$/.test(sid)) {
  console.error('Falta --sid ACxxxxxxxx (Account SID de Twilio).');
  process.exit(1);
}
if (token.length < 16) {
  console.error('Falta --token (Auth Token de Twilio).');
  process.exit(1);
}
if (!/^\+[1-9]\d{7,14}$/.test(from)) {
  console.error('Falta --from en formato internacional, ej. +15551234567');
  process.exit(1);
}

const root = resolve(process.cwd());
for (const file of [resolve(root, '.env.worker'), resolve(root, '.env')]) {
  upsert(file, 'TWILIO_ACCOUNT_SID', sid);
  upsert(file, 'TWILIO_AUTH_TOKEN', token);
  upsert(file, 'TWILIO_FROM', from);
}

console.log('Twilio guardado en .env.worker y .env (archivos ignorados por git).');
console.log('FROM listo. SID y token no se imprimen.');
console.log('Siguiente: npm run notify:deploy');
