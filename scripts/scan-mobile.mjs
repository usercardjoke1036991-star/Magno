/**
 * Sube un APK a MobSF (POST multipart/form-data /api/v1/upload), lanza /api/v1/scan
 * y guarda el JSON de /api/v1/report_json en mobsf-report.json.
 * Uso:
 *   npm run security:mobsf -- ./android/app/build/outputs/apk/release/app-release.apk
 *   node scripts/scan-mobile.mjs ./android/app/build/outputs/apk/debug/app-debug.apk
 *
 * Clave: MOBSF_API_KEY (entorno o .env). Servidor: MOBSF_URL (por defecto http://localhost:8000).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
loadDotEnv(resolve(root, '.env'));

const apiKey = String(process.env.MOBSF_API_KEY || '').trim();
const baseUrl = String(process.env.MOBSF_URL || 'http://localhost:8000').replace(/\/+$/, '');
const reportPath = resolve(root, 'mobsf-report.json');
const apkPath = resolveApkPath(process.argv.slice(2));

if (!apiKey) {
  console.error(`Falta MOBSF_API_KEY.
Póngala en el entorno o en .env (está en Ajustes de MobSF → API Key).
Ejemplo:
  $env:MOBSF_API_KEY="su-clave"
  npm run security:mobsf -- "${apkPath || './android/app/build/outputs/apk/debug/app-debug.apk'}"`);
  process.exit(1);
}

if (!apkPath || !existsSync(apkPath)) {
  console.error(`No se encontró el APK.
Uso: node scripts/scan-mobile.mjs <ruta.apk>
Ejemplo: node scripts/scan-mobile.mjs ./android/app/build/outputs/apk/release/app-release.apk`);
  process.exit(1);
}

const auth = { Authorization: apiKey };

try {
  console.log(`MobSF ${baseUrl}`);
  console.log(`APK    ${apkPath}`);

  const uploaded = await uploadApk(apkPath);
  const hash = String(uploaded.hash || '').trim();
  const fileName = String(uploaded.file_name || basename(apkPath));
  const scanType = String(uploaded.scan_type || guessScanType(fileName));
  if (!hash) {
    throw new Error(`MobSF no devolvió hash al subir. Respuesta: ${brief(uploaded)}`);
  }
  console.log(`Hash   ${hash}`);

  const scanned = await postForm(`${baseUrl}/api/v1/scan`, {
    hash,
    file_name: fileName,
    scan_type: scanType,
    re_scan: '0',
  });
  if (scanned && scanned.error) {
    throw new Error(String(scanned.error));
  }
  console.log('Scan   listo');

  const report = await postForm(`${baseUrl}/api/v1/report_json`, { hash });
  if (!report || typeof report !== 'object' || report.error) {
    throw new Error(report?.error ? String(report.error) : 'MobSF no devolvió JSON del informe');
  }
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Informe ${reportPath}`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`MobSF falló: ${message}
¿Está corriendo http://localhost:8000? ¿La API Key es la de esa instancia?`);
  process.exit(1);
}

function resolveApkPath(args) {
  const fromCli = args.find((arg) => arg && !arg.startsWith('-'));
  const candidates = [
    fromCli,
    process.env.MOBSF_APK,
    'android/app/build/outputs/apk/release/app-release.apk',
    'android/app/build/outputs/apk/debug/app-debug.apk',
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const full = resolve(root, candidate);
    if (existsSync(full)) return full;
  }
  return fromCli ? resolve(root, fromCli) : '';
}

function guessScanType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.aab')) return 'aab';
  if (lower.endsWith('.ipa')) return 'ipa';
  if (lower.endsWith('.zip') || lower.endsWith('.apk')) return 'apk';
  return 'apk';
}

async function uploadApk(filePath) {
  const bytes = new Uint8Array(readFileSync(filePath));
  const form = new FormData();
  form.append(
    'file',
    new Blob([bytes], { type: 'application/vnd.android.package-archive' }),
    basename(filePath)
  );
  const res = await fetch(`${baseUrl}/api/v1/upload`, {
    method: 'POST',
    headers: auth,
    body: form,
  });
  return readJson(res, 'upload');
}

async function postForm(url, fields) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    body.set(key, String(value));
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...auth,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  return readJson(res, url.replace(baseUrl, ''));
}

async function readJson(res, label) {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const detail = data?.error || data?.message || text.slice(0, 300) || res.statusText;
    throw new Error(`${label} HTTP ${res.status}: ${detail}`);
  }
  if (data === null) {
    throw new Error(`${label} no devolvió JSON`);
  }
  return data;
}

function brief(value) {
  try {
    return JSON.stringify(value).slice(0, 400);
  } catch {
    return String(value);
  }
}

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    if (!key || process.env[key]) continue;
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
