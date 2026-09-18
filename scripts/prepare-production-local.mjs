/**
 * Rellena lo que se puede sin VPS y sin deploy de mainnet.
 * No pone CHAIN_ID=56 ni CONFIRM_MAINNET=yes en el .env del teléfono.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const envPath = resolve(root, '.env');
const workerPath = resolve(root, '.env.worker');
const STALE_MAINNET = '0xa6aac9ce4923789a4095fbc0504db9a697f8a46d';
const STALE_TESTNET = '0x1E5118B378c7BCB3F3c5de7ec046B93E60f417a3';
const ZERO = '0x0000000000000000000000000000000000000000';
const DEPLOYER = '0xdb135e9cd9be9bE262b3222eaD737c84d72Ef870';
const TESTNET_CONTRACT = '0xD2d2A9eF0D1e4f253abc90Dd4ACb0E6C50B2de9f';
const INVITE = 'https://quatriviumcredit.app';
const PLAY = 'https://play.google.com/store/apps/details?id=com.quatrivium.credit';

function loadMap(filePath) {
  const map = {};
  if (!existsSync(filePath)) return map;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[line.slice(0, i).trim()] = value;
  }
  return map;
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
    if (next.length === 0 || next[next.length - 1] !== '') next.push(`${key}=${value}`);
    else {
      next[next.length - 1] = `${key}=${value}`;
      next.push('');
    }
  }
  writeFileSync(filePath, next.join('\n'), 'utf8');
}

const env = loadMap(envPath);
const done = [];

if (env.EXPO_PUBLIC_CHAIN_ID && env.EXPO_PUBLIC_CHAIN_ID !== '97') {
  console.error('Abortado: EXPO_PUBLIC_CHAIN_ID local no es 97. No se toca el .env.');
  process.exit(1);
}

const mainnet = (env.EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET || '').toLowerCase();
if (!mainnet || mainnet === STALE_MAINNET) {
  upsert(envPath, 'EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET', ZERO);
  done.push('Contrato mainnet viejo anulado (0x000… hasta el deploy nuevo)');
}

const testnetNow = (env.EXPO_PUBLIC_CONTRACT_ADDRESS_TESTNET || '').toLowerCase();
if (testnetNow === STALE_TESTNET.toLowerCase() || testnetNow !== TESTNET_CONTRACT.toLowerCase()) {
  upsert(envPath, 'EXPO_PUBLIC_CONTRACT_ADDRESS_TESTNET', TESTNET_CONTRACT);
  done.push(
    testnetNow === STALE_TESTNET.toLowerCase()
      ? 'Contrato testnet retirado 0x1E5118 sustituido por Demo live 0xD2d2'
      : 'Contrato testnet actual escrito en .env'
  );
}

if (!env.ADMINS) {
  upsert(envPath, 'ADMINS', DEPLOYER);
  done.push('ADMINS = deployer (fundadora 1). Cámbielo si la fundadora es otra wallet');
}

if (!env.REQUIRED_CONFIRMATIONS) {
  upsert(envPath, 'REQUIRED_CONFIRMATIONS', '1');
  done.push('REQUIRED_CONFIRMATIONS=1 (con 3 fundadoras el contrato fuerza 2)');
}

if (!env.FEE_COLLECTOR && env.EXPO_PUBLIC_FEE_COLLECTOR) {
  upsert(envPath, 'FEE_COLLECTOR', env.EXPO_PUBLIC_FEE_COLLECTOR);
  done.push('FEE_COLLECTOR copiado de EXPO_PUBLIC_FEE_COLLECTOR. Cámbielo si la tesorería es otra');
}

if (!env.EXPO_PUBLIC_INVITE_WEB_BASE) {
  upsert(envPath, 'EXPO_PUBLIC_INVITE_WEB_BASE', INVITE);
  done.push('Dominio de invitaciones');
}

if (!env.EXPO_PUBLIC_PLAY_STORE_URL) {
  upsert(envPath, 'EXPO_PUBLIC_PLAY_STORE_URL', PLAY);
  done.push('URL de Play Store');
}

let dataKey = env.NOTIFY_DATA_KEY || '';
if (dataKey.length < 16) {
  dataKey = randomBytes(24).toString('hex');
  upsert(envPath, 'NOTIFY_DATA_KEY', dataKey);
  done.push('NOTIFY_DATA_KEY generado (no se imprime)');
}

const workerLines = [
  '# Generado por npm run production:prepare. No subir a git.',
  '# Arranque: npm run notify:prod',
  '',
  'EXPO_PUBLIC_CHAIN_ID=56',
  `EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET=${ZERO}`,
  `BSC_MAINNET_RPC_URL=${env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed.binance.org/'}`,
  '',
  'NOTIFY_BIND=127.0.0.1',
  'NOTIFY_PORT=8787',
  'NOTIFY_CORS_ORIGIN=https://quatriviumcredit.app',
  `NOTIFY_DATA_KEY=${dataKey}`,
  '',
  '# Ponga aquí la URL HTTPS pública cuando tenga el VPS o el túnel.',
  'EXPO_PUBLIC_NOTIFY_API=',
  '',
  'TEXTBELT_API_KEY=',
  'TEXTBELT_SENDER=Quatrivium',
  'TWILIO_ACCOUNT_SID=',
  'TWILIO_AUTH_TOKEN=',
  'TWILIO_FROM=',
  'WHATSAPP_TOKEN=',
  'WHATSAPP_PHONE_NUMBER_ID=',
  '',
  'ATTESTER_PRIVATE_KEY=',
  '',
];

if (!existsSync(workerPath)) {
  writeFileSync(workerPath, workerLines.join('\n'), 'utf8');
  done.push('Creado .env.worker (mainnet, gitignored)');
} else {
  const worker = loadMap(workerPath);
  if ((worker.NOTIFY_DATA_KEY || '').length < 16) {
    upsert(workerPath, 'NOTIFY_DATA_KEY', dataKey);
    done.push('NOTIFY_DATA_KEY copiado a .env.worker');
  }
  if ((worker.NOTIFY_CORS_ORIGIN || '') === '*' || !worker.NOTIFY_CORS_ORIGIN) {
    upsert(workerPath, 'NOTIFY_CORS_ORIGIN', 'https://quatriviumcredit.app');
    done.push('CORS de worker limitado al dominio');
  }
  if (!worker.EXPO_PUBLIC_CHAIN_ID) {
    upsert(workerPath, 'EXPO_PUBLIC_CHAIN_ID', '56');
  }
}

const wc = env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID || '';
if (wc && wc.length >= 16 && !/^your_/i.test(wc)) {
  const easPath = resolve(root, 'eas.json');
  const eas = JSON.parse(readFileSync(easPath, 'utf8'));
  let easChanged = false;
  for (const profile of Object.keys(eas.build || {})) {
    eas.build[profile].env = eas.build[profile].env || {};
    if (eas.build[profile].env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID !== wc) {
      eas.build[profile].env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID = wc;
      easChanged = true;
    }
  }
  if (easChanged) {
    writeFileSync(easPath, JSON.stringify(eas, null, 2) + '\n');
    done.push('WalletConnect escrito en eas.json (va en el APK, no es la clave de deploy)');
  }
}

console.log('production:prepare');
for (const line of done) console.log('- ' + line);
if (!done.length) console.log('- Nada que cambiar');
console.log('\nNo se desplegó mainnet. No se tocó EXPO_PUBLIC_CHAIN_ID local.');
