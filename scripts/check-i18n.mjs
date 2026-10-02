import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'i18n', 'locales');
const langs = ['es', 'en', 'zh', 'hi', 'ar', 'bn', 'pt', 'ru', 'ur', 'id', 'fr', 'ja', 'de', 'ko', 'tr', 'vi', 'it'];
const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'));
const keys = Object.keys(en).sort((a, b) => a.localeCompare(b));
const placeholders = /\{[a-zA-Z]+\}/g;
let failed = false;

for (const lang of langs) {
  const file = path.join(dir, `${lang}.json`);
  if (!fs.existsSync(file)) {
    console.error(`MISSING ${lang}.json`);
    failed = true;
    continue;
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const got = Object.keys(data).sort((a, b) => a.localeCompare(b));
  if (got.join() !== keys.join()) {
    const missing = keys.filter((k) => !got.includes(k));
    const extra = got.filter((k) => !keys.includes(k));
    console.error(`${lang} key mismatch missing=${missing.length} extra=${extra.length}`);
    if (missing[0]) console.error('  missing sample', missing.slice(0, 8));
    failed = true;
  }
  let empty = 0;
  let copied = 0;
  for (const key of keys) {
    const value = data[key];
    if (typeof value !== 'string' || !value.trim()) empty += 1;
    const enVal = en[key];
    const enPh = (enVal.match(placeholders) || []).sort().join();
    const ph = String(value || '').match(placeholders) || [];
    if (ph.sort().join() !== enPh) {
      console.error(`${lang}.${key} placeholder mismatch`);
      failed = true;
    }
    if (lang !== 'en' && value === enVal && enVal.length > 24) copied += 1;
    if (/EXPO_PUBLIC_|CONFIRM_MAINNET|PRIVATE_KEY|TEXTBELT/.test(String(value || ''))) {
      console.error(`${lang}.${key} leaks internal token`);
      failed = true;
    }
  }
  if (empty) {
    console.error(`${lang} empty=${empty}`);
    failed = true;
  }
  if (copied) {
    console.error(`${lang} leftover English sentences=${copied}`);
    failed = true;
  }
  if (/fundador|founder|Gründer|fondateur|основател/i.test(String(data.reservaFounderNote || ''))) {
    console.error(`${lang} reservaFounderNote still names the founder`);
    failed = true;
  }
  if (data.appWalletDestroyType && !String(data.appWalletDestroyType).includes('DESTRUIR')) {
    console.error(`${lang} missing DESTRUIR`);
    failed = true;
  }
  console.log(`${lang} keys=${got.length} copiedLongEn=${copied}`);
}

if (failed) process.exit(1);
console.log('ok');
