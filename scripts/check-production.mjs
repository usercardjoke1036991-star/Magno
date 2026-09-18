/**
 * Lista lo que falta para mainnet. No imprime secretos.
 * Uso: npm run production:check
 *      npm run production:check -- --strict   (sale 1 si mainnet no está completo)
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const { isHexAddress, isZero } = createRequire(import.meta.url)('./bscNetworks.cjs');
const { isTextbeltConfigured } = createRequire(import.meta.url)('./textbeltSms.cjs');

const root = resolve(process.cwd());
const strict = process.argv.includes('--strict');

function loadEnv(filePath) {
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

const local = loadEnv(resolve(root, '.env'));
const worker = loadEnv(resolve(root, '.env.worker'));
const WORKER_KEYS = [
  'EXPO_PUBLIC_NOTIFY_API',
  'NOTIFY_CORS_ORIGIN',
  'NOTIFY_DATA_KEY',
  'TEXTBELT_API_KEY',
  'TEXTBELT_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_FROM',
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'ATTESTER_PRIVATE_KEY',
  'RESEND_API_KEY',
  'EMAIL_FROM',
];
const env = { ...local };
for (const key of WORKER_KEYS) {
  if (worker[key]) env[key] = worker[key];
}

const get = (key) => String(env[key] || '').trim();
const set = (key) => {
  const value = get(key);
  return Boolean(value) && !/^your_/i.test(value) && !value.includes('_here');
};
const https = (key) => /^https:\/\//i.test(get(key));

const STALE_MAINNET = '0xa6aac9ce4923789a4095fbc0504db9a697f8a46d';
const LIVE_TESTNET = '0xD2d2A9eF0D1e4f253abc90Dd4ACb0E6C50B2de9f';
const STALE_TESTNET = '0x1E5118B378c7BCB3F3c5de7ec046B93E60f417a3';

const admins = get('ADMINS')
  .split(',')
  .map((item) => item.trim())
  .filter((item) => isHexAddress(item) && !isZero(item));

const checks = [
  {
    id: 'walletconnect',
    who: 'code',
    ok: set('EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID') && get('EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID').length >= 16,
    need: 'Project ID de Reown (ya puede estar en .env local; también en eas.json)',
  },
  {
    id: 'contract',
    who: 'you',
    ok:
      isHexAddress(get('EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET')) &&
      !isZero(get('EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET')) &&
      get('EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET').toLowerCase() !== STALE_MAINNET,
    need:
      get('EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET').toLowerCase() === STALE_MAINNET
        ? 'El contrato mainnet guardado es de una versión vieja. Hay que desplegar QuatriviumCredit de nuevo (CONFIRM_MAINNET=yes)'
        : 'Desplegar QuatriviumCredit en BSC mainnet (CONFIRM_MAINNET=yes)',
  },
  {
    id: 'demo-contract',
    who: 'code',
    ok:
      !get('EXPO_PUBLIC_CONTRACT_ADDRESS_TESTNET') ||
      (get('EXPO_PUBLIC_CONTRACT_ADDRESS_TESTNET').toLowerCase() === LIVE_TESTNET.toLowerCase() &&
        get('EXPO_PUBLIC_CONTRACT_ADDRESS_TESTNET').toLowerCase() !== STALE_TESTNET),
    need: 'EXPO_PUBLIC_CONTRACT_ADDRESS_TESTNET debe ser Demo live 0xD2d2… (no el retirado 0x1E5118)',
  },
  {
    id: 'admins',
    who: 'you',
    ok: admins.length >= 1,
    need: 'ADMINS=0xFundador (la primera es la fundadora). Las otras dos se listan ahora o se agregan después desde la app',
  },
  {
    id: 'confirms',
    who: 'code',
    ok: Number(get('REQUIRED_CONFIRMATIONS') || '0') >= 1 && (admins.length < 2 || Number(get('REQUIRED_CONFIRMATIONS') || '0') >= 2),
    need: 'REQUIRED_CONFIRMATIONS=1 con una fundadora. Con 3, el contrato exige 2 firmas aunque aquí ponga 1',
  },
  {
    id: 'treasury',
    who: 'you',
    ok: isHexAddress(get('FEE_COLLECTOR')) && !isZero(get('FEE_COLLECTOR')),
    need: 'FEE_COLLECTOR = wallet de tesorería (explícita, no se asume el deployer)',
  },
  {
    id: 'rpc',
    who: 'code',
    ok: https('BSC_MAINNET_RPC_URL') || https('EXPO_PUBLIC_BSC_RPC_URL_PRIMARY'),
    need: 'RPC de pago (QuickNode / Ankr / Alchemy) en BSC_MAINNET_RPC_URL',
  },
  {
    id: 'notify',
    who: 'you',
    ok: https('EXPO_PUBLIC_NOTIFY_API'),
    need: 'EXPO_PUBLIC_NOTIFY_API = HTTPS público del worker (VPS o túnel)',
  },
  {
    id: 'cors',
    who: 'code',
    ok: set('NOTIFY_CORS_ORIGIN') && get('NOTIFY_CORS_ORIGIN') !== '*',
    need: 'NOTIFY_CORS_ORIGIN = https://quatriviumcredit.app en .env.worker (no *)',
  },
  {
    id: 'data-key',
    who: 'code',
    ok: get('NOTIFY_DATA_KEY').length >= 16,
    need: 'NOTIFY_DATA_KEY ≥ 16 caracteres (npm run production:prepare)',
  },
  {
    id: 'sms',
    who: 'you',
    ok:
      isTextbeltConfigured(get('TEXTBELT_API_KEY') || get('TEXTBELT_KEY')) ||
      (set('TWILIO_ACCOUNT_SID') && set('TWILIO_AUTH_TOKEN') && set('TWILIO_FROM')) ||
      (set('WHATSAPP_TOKEN') && set('WHATSAPP_PHONE_NUMBER_ID')),
    need: 'TEXTBELT_API_KEY (pago) en .env.worker, o Twilio, o WhatsApp Cloud API',
  },
  {
    id: 'email',
    who: 'you',
    ok: set('RESEND_API_KEY') && /@/.test(get('EMAIL_FROM')),
    need: 'RESEND_API_KEY y EMAIL_FROM en .env.worker (avisos y código de alta)',
  },
  {
    id: 'attester',
    who: 'you',
    ok:
      set('ATTESTER_PRIVATE_KEY') &&
      get('ATTESTER_PRIVATE_KEY').replace(/^0x/i, '').toLowerCase() !==
        get('PRIVATE_KEY').replace(/^0x/i, '').toLowerCase(),
    need: 'ATTESTER_PRIVATE_KEY distinta de PRIVATE_KEY (no use la del deployer)',
  },
  {
    id: 'invite',
    who: 'code',
    ok: https('EXPO_PUBLIC_INVITE_WEB_BASE') || https('EXPO_PUBLIC_PLAY_STORE_URL'),
    need: 'Dominio de invitaciones o URL de Play Store',
  },
  {
    id: 'eas-store',
    who: 'code',
    ok: (() => {
      const easPath = resolve(root, 'eas.json');
      if (!existsSync(easPath)) return false;
      try {
        const prod = JSON.parse(readFileSync(easPath, 'utf8'))?.build?.production?.env || {};
        return (
          String(prod.EXPO_PUBLIC_APP_ENV) === 'production' &&
          String(prod.EXPO_PUBLIC_CHAIN_ID) === '56' &&
          !prod.EXPO_PUBLIC_CONTRACT_ADDRESS_TESTNET
        );
      } catch {
        return false;
      }
    })(),
    need: 'eas.json production: APP_ENV=production, chain 56, sin contrato de testnet',
  },
];

const deployDay = {
  id: 'confirm',
  ok: get('CONFIRM_MAINNET') === 'yes',
  need: 'CONFIRM_MAINNET=yes solo el minuto del deploy, luego quitarlo',
};

const missing = checks.filter((item) => !item.ok);
const youDo = checks.filter((item) => item.who === 'you' && !item.ok);
const chainId = Number(local.EXPO_PUBLIC_CHAIN_ID || '97');
const appEnv = local.EXPO_PUBLIC_APP_ENV || 'development';

console.log('Quatrivium Finance — listo para lo real');
console.log(`App local ahora: APP_ENV=${appEnv || '(vacío)'}  chainId=${chainId}`);
console.log(`.env.worker: ${existsSync(resolve(root, '.env.worker')) ? 'sí' : 'no (npm run production:prepare)'}`);
console.log('');
for (const item of checks) {
  const tag = item.who === 'you' ? 'TÚ  ' : 'repo';
  console.log(`${item.ok ? 'OK   ' : 'FALTA'}  ${tag}  ${item.id.padEnd(14)}  ${item.ok ? '' : item.need}`);
}
console.log(`${deployDay.ok ? 'OK   ' : 'LUEGO'}  TÚ    ${deployDay.id.padEnd(14)}  ${deployDay.ok ? '' : deployDay.need}`);
console.log('');
if (chainId !== 56) {
  console.log('La app del teléfono sigue en testnet. Eso es correcto.');
  console.log('No ponga EXPO_PUBLIC_CHAIN_ID=56 en .env local.');
  console.log('El APK de tienda usa el perfil EAS production (chain 56).');
}
console.log(`Config: ${checks.length - missing.length}/${checks.length} listos.`);

if (youDo.length) {
  console.log('\nLo que solo puede hacer usted:');
  for (const item of youDo) console.log('  - ' + item.need);
  console.log('  - BNB de gas en la wallet deployer, luego CONFIRM_MAINNET=yes y npm run deploy:bsc');
  console.log('  - Depositar USDT real al pool desde la app en modo Real');
  console.log('  - eas build --platform android --profile production');
}

if (strict && (missing.length || !deployDay.ok)) {
  process.exit(1);
}
if (!missing.length) {
  console.log('\nConfig lista. Día del deploy: CONFIRM_MAINNET=yes && npm run deploy:bsc');
}
