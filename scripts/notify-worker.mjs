/**
 * Avisos Quatrivium Credit: Telegram y WhatsApp Cloud API.
 * Uso: npm run notify          (demo / testnet, lee .env)
 *      npm run notify:prod     (real / mainnet, .env + .env.worker)
 *
 * 1. Cree un bot con @BotFather y ponga TELEGRAM_BOT_TOKEN.
 * 2. (Opcional) WhatsApp Cloud API: WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID.
 * 3. El usuario vincula su número o abre el bot desde la app.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';
import { Contract, JsonRpcProvider, Wallet, getAddress, verifyTypedData, keccak256, toUtf8Bytes, AbiCoder, getBytes, Signature, ZeroAddress } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();
const workerEnv = resolve(process.cwd(), '.env.worker');
const wantProd = process.argv.includes('--prod') || process.env.NOTIFY_PROFILE === 'prod';
if (wantProd) {
  if (!existsSync(workerEnv)) {
    console.error('Falta .env.worker. Copie .env.worker.example o corra npm run production:prepare');
    process.exit(1);
  }
  dotenv.config({ path: workerEnv, override: true });
}

const { BSC_MAINNET, BSC_TESTNET, isHexAddress, isZero } = createRequire(import.meta.url)('./bscNetworks.cjs');

const PORT = Number(process.env.NOTIFY_PORT || 8787);
const DATA_FILE = resolve(process.cwd(), '.notify-data.json');
const CHAIN_ID = Number(process.env.EXPO_PUBLIC_CHAIN_ID || 97);
const isMainnet = CHAIN_ID === BSC_MAINNET.chainId;
const CONTRACT = (() => {
  const chosen = isMainnet
    ? process.env.EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET
    : process.env.EXPO_PUBLIC_CONTRACT_ADDRESS_TESTNET;
  return isHexAddress(chosen) && !isZero(chosen) ? chosen : '';
})();
const RPC = isMainnet
  ? process.env.BSC_MAINNET_RPC_URL || process.env.EXPO_PUBLIC_BSC_RPC_URL_PRIMARY || BSC_MAINNET.rpc[0]
  : process.env.EXPO_PUBLIC_BSC_RPC_URL_PRIMARY || process.env.BSC_TESTNET_RPC_URL || BSC_TESTNET.rpc[0];
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_FROM || '';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '';
const ATTESTER_EXPLICIT = process.env.ATTESTER_PRIVATE_KEY || '';
const DEPLOY_KEY = process.env.PRIVATE_KEY || '';
const sameKey = (a, b) => {
  const n = (value) => String(value || '').replace(/^0x/i, '').toLowerCase();
  return Boolean(a) && Boolean(b) && n(a) === n(b) && n(a).length >= 64;
};
if (isMainnet && !ATTESTER_EXPLICIT) {
  console.error('Mainnet: ATTESTER_PRIVATE_KEY es obligatorio.');
  process.exit(1);
}
if (isMainnet && sameKey(ATTESTER_EXPLICIT, DEPLOY_KEY)) {
  console.error('Mainnet: ATTESTER_PRIVATE_KEY debe ser distinta de PRIVATE_KEY.');
  process.exit(1);
}
const ATTESTER_KEY = ATTESTER_EXPLICIT || (isMainnet ? '' : DEPLOY_KEY);
const START_BLOCK = Number(process.env.EXPO_PUBLIC_CONTRACT_START_BLOCK || 0);
const ADMIN_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID || '';
const CORS_ORIGINS = (process.env.NOTIFY_CORS_ORIGIN || '*')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const DATA_KEY_RAW = process.env.NOTIFY_DATA_KEY || '';
const hashPhone = (phone) => keccak256(toUtf8Bytes(`quatrivium.phone.v1:${DATA_KEY_RAW}:${phone}`));
const hashEmail = (email) => keccak256(toUtf8Bytes(`quatrivium.email.v1:${DATA_KEY_RAW}:${email}`));
const BIND = process.env.NOTIFY_BIND || '127.0.0.1';
const TRUST_PROXY = process.env.NOTIFY_TRUST_PROXY === '1';
const hasSms =
  Boolean(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) || Boolean(WHATSAPP_TOKEN && WHATSAPP_PHONE_ID);
const hasEmail = Boolean(RESEND_KEY && EMAIL_FROM);
if (DATA_KEY_RAW.length < 16) {
  console.error('NOTIFY_DATA_KEY de al menos 16 caracteres es obligatorio (cifra teléfonos y Telegram en disco).');
  process.exit(1);
}
if (isMainnet && CORS_ORIGINS.includes('*')) {
  console.error('NOTIFY_CORS_ORIGIN no puede ser * en mainnet.');
  process.exit(1);
}
if (isMainnet && !CONTRACT) {
  console.error('Mainnet: falta EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET.');
  process.exit(1);
}
if (isMainnet && !ATTESTER_KEY) {
  console.error('Mainnet: falta ATTESTER_PRIVATE_KEY distinta del owner.');
  process.exit(1);
}
if (isMainnet && !hasSms) {
  console.error('Mainnet: configure Twilio o WhatsApp Cloud API para el OTP.');
  process.exit(1);
}
if (isMainnet && !hasEmail) {
  console.error('Mainnet: configure RESEND_API_KEY y EMAIL_FROM para el correo.');
  process.exit(1);
}
if (isMainnet && BIND !== '127.0.0.1' && BIND !== '::1' && !TRUST_PROXY) {
  console.error('Mainnet: NOTIFY_BIND debe ser 127.0.0.1 detrás de Nginx/Caddy, o NOTIFY_TRUST_PROXY=1.');
  process.exit(1);
}
const AUTH_DOMAIN = {
  name: 'Quatrivium Credit',
  version: '2',
  chainId: CHAIN_ID,
  verifyingContract:
    CONTRACT && /^0x[0-9a-fA-F]{40}$/.test(CONTRACT) && !/0x0{40}/i.test(CONTRACT)
      ? CONTRACT
      : '0x0000000000000000000000000000000000000001',
};
const AUTH_TYPES = {
  Auth: [
    { name: 'wallet', type: 'address' },
    { name: 'purpose', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'deviceHash', type: 'bytes32' },
    { name: 'phone', type: 'string' },
  ],
};

const ABI = [
  'function usuarios(address) view returns (uint256 nivelActual, uint256 montoActivo, uint256 vencimiento, bool enMora, address monedaActivo, uint256 tasaAplicadaBP)',
  'function planPago(address) view returns (uint128 pagado, uint64 venceCuota, uint8 totales, uint8 pagadas, bool enPlazo)',
  'function obtenerProgresoUsuario(address usuario) view returns (uint256 nivelActual, uint256 solicitudesCompletadas, uint256 ultimoPrestamoTimestamp)',
  'function walletOfPhone(bytes32) view returns (address)',
  'function walletOfDevice(bytes32) view returns (address)',
  'event AfiliadoRegistrado(address indexed usuario, address indexed padre)',
  'event BonoActivacionPagado(address indexed padre, address indexed referido, uint256 monto, address indexed token)',
  'event ComisionGeneracional(address indexed beneficiario, address indexed deudor, uint8 generacion, uint256 monto, address indexed token)',
  'event AdminActionExecuted(uint256 indexed id, bytes4 selector)',
  'event Paused(address account)',
  'event Unpaused(address account)',
];

let requestOrigin = '';

const dataKey = () => {
  if (!DATA_KEY_RAW) return null;
  return createHash('sha256').update(DATA_KEY_RAW).digest();
};

const corsOrigin = () => {
  if (CORS_ORIGINS.includes('*')) return '*';
  if (requestOrigin && CORS_ORIGINS.includes(requestOrigin)) return requestOrigin;
  return 'null';
};

const originAllowed = () => {
  if (CORS_ORIGINS.includes('*')) return true;
  if (!requestOrigin) return true;
  return CORS_ORIGINS.includes(requestOrigin);
};

const clientIp = (req) => {
  if (TRUST_PROXY) {
    const forwarded = String(req.headers['x-forwarded-for'] || '')
      .split(',')[0]
      .trim();
    if (forwarded) return forwarded.slice(0, 64);
  }
  return req.socket.remoteAddress || 'ip';
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-DNS-Prefetch-Control': 'off',
};

const json = (res, status, body) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': corsOrigin(),
    Vary: 'Origin',
    ...SECURITY_HEADERS,
  };
  if (isMainnet) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
};

const emptyStore = () => ({
  profiles: {},
  telegramByWallet: {},
  walletByChat: {},
  lastBlock: 0,
  reminded: {},
  usedAuth: {},
  pendingBinds: {},
  otps: {},
  emailOtps: {},
  phoneClaims: {},
  emailClaims: {},
  usernameClaims: {},
  rateHits: {},
  recoveryWraps: {},
  recoverOtps: {},
});

const loadStore = () => {
  if (!existsSync(DATA_FILE)) return emptyStore();
  const raw = readFileSync(DATA_FILE);
  const key = dataKey();
  const encrypted = raw.length > 31 && raw.subarray(0, 3).toString() === 'ENC';
  if (encrypted) {
    if (!key) {
      console.error('NOTIFY_DATA_KEY es obligatorio para leer el almacén cifrado.');
      process.exit(1);
    }
    try {
      const iv = raw.subarray(3, 15);
      const tag = raw.subarray(15, 31);
      const data = raw.subarray(31);
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
      return { ...emptyStore(), ...JSON.parse(plain) };
    } catch {
      console.error('No se pudo descifrar .notify-data.json. Revise NOTIFY_DATA_KEY; no se sobrescribe el archivo.');
      process.exit(1);
    }
  }
  try {
    const parsed = { ...emptyStore(), ...JSON.parse(raw.toString('utf8')) };
    if (key) {
      try {
        saveStore(parsed);
      } catch {
        console.error('No se pudo cifrar el almacén al migrar de texto plano.');
      }
    }
    return parsed;
  } catch {
    console.error('El almacén de avisos existe pero no es JSON válido. Arranque abortado para no borrar datos.');
    process.exit(1);
  }
};

const saveStore = (next) => {
  const payload = JSON.stringify(next);
  const key = dataKey();
  if (!key) {
    writeFileSync(DATA_FILE, payload);
    return;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  writeFileSync(DATA_FILE, Buffer.concat([Buffer.from('ENC'), iv, cipher.getAuthTag(), enc]));
};

let persistChain = Promise.resolve();
const persist = () => {
  const snapshot = JSON.stringify(store);
  persistChain = persistChain
    .catch(() => {})
    .then(() => {
      saveStore(JSON.parse(snapshot));
    });
  return persistChain.catch((error) => {
    console.error('No se pudo guardar el almacén de avisos.');
    throw error;
  });
};

let store = loadStore();

const pruneRates = () => {
  const now = Date.now();
  store.rateHits = store.rateHits || {};
  for (const key of Object.keys(store.rateHits)) {
    const next = (store.rateHits[key] || []).filter((item) => now - item < 15 * 60 * 1000);
    if (next.length) store.rateHits[key] = next;
    else delete store.rateHits[key];
  }
  const leftover = Object.keys(store.rateHits);
  if (leftover.length > 8000) {
    leftover.slice(0, leftover.length - 4000).forEach((key) => delete store.rateHits[key]);
  }
};

const rateLimit = (key, max = 20, windowMs = 60_000) => {
  const now = Date.now();
  store.rateHits = store.rateHits || {};
  if (Object.keys(store.rateHits).length > 2000) pruneRates();
  const next = (store.rateHits[key] || []).filter((item) => now - item < windowMs);
  if (next.length >= max) {
    store.rateHits[key] = next;
    return false;
  }
  next.push(now);
  store.rateHits[key] = next;
  return true;
};

const stripUnsafe = (value, max = 64) =>
  String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>`"\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const parseAllowedEmail = (value) => {
  const email = String(value || '')
    .trim()
    .toLowerCase()
    .slice(0, 80);
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return { email: '', canonical: '' };
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { email, canonical: `${local.split('+')[0].replace(/\./g, '')}@gmail.com` };
  }
  if (domain === 'proton.me' || domain === 'protonmail.com' || domain === 'protonmail.ch' || domain === 'pm.me') {
    return { email, canonical: `${local.split('+')[0]}@proton.me` };
  }
  return { email: '', canonical: '' };
};

const normalizeUsername = (value) => {
  const username = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
  if (!/^[a-z][a-z0-9_]{2,19}$/.test(username)) return '';
  const reserved = new Set([
    'admin',
    'owner',
    'fundador',
    'founder',
    'support',
    'ayuda',
    'quatrivium',
    'official',
    'oficial',
    'root',
    'null',
    'undefined',
  ]);
  return reserved.has(username) ? '' : username;
};

const requireAuth = (body) => {
  const wallet = String(body.wallet || '').toLowerCase();
  const purpose = String(body.purpose || '');
  const timestamp = Number(body.timestamp);
  const signature = String(body.signature || '');
  const deviceHash = String(body.deviceHash || '').toLowerCase();
  const phone = String(body.phone || '');
  if (!wallet.startsWith('0x') || wallet.length !== 42) throw new Error('wallet');
  if (
    purpose !== 'vincular-avisos' &&
    purpose !== 'perfil' &&
    purpose !== 'otp' &&
    purpose !== 'email' &&
    purpose !== 'username'
  ) {
    throw new Error('purpose');
  }
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
    throw new Error('timestamp');
  }
  if (!signature.startsWith('0x') || signature.length < 130) throw new Error('signature');
  if (!/^0x[0-9a-f]{64}$/.test(deviceHash)) throw new Error('device');
  if (purpose === 'otp') {
    if (!normalizeE164(phone)) throw new Error('phone');
  } else if (purpose === 'email') {
    if (!parseAllowedEmail(phone).email) throw new Error('email');
  } else if (purpose === 'username') {
    if (!normalizeUsername(phone)) throw new Error('username');
  } else if (phone) {
    throw new Error('phone');
  }
  const signedPhone =
    purpose === 'otp'
      ? normalizeE164(phone)
      : purpose === 'email'
        ? parseAllowedEmail(phone).email
        : purpose === 'username'
          ? normalizeUsername(phone)
          : '';
  const replayKey = createHash('sha256').update(`${wallet}:${purpose}:${timestamp}:${deviceHash}:${signature}`).digest('hex');
  if (store.usedAuth[replayKey]) throw new Error('replay');
  const recovered = verifyTypedData(
    AUTH_DOMAIN,
    AUTH_TYPES,
    {
      wallet: getAddress(wallet),
      purpose,
      timestamp,
      deviceHash,
      phone: signedPhone,
    },
    signature
  ).toLowerCase();
  if (recovered !== wallet) throw new Error('signature');
  store.usedAuth[replayKey] = timestamp;
  const cutoff = Date.now() - 15 * 60 * 1000;
  const usedKeys = Object.keys(store.usedAuth);
  for (const key of usedKeys) {
    if (Number(store.usedAuth[key]) < cutoff) delete store.usedAuth[key];
  }
  if (usedKeys.length > 20_000) {
    for (const key of usedKeys.slice(0, usedKeys.length - 10_000)) delete store.usedAuth[key];
  }
  const parsedEmail = purpose === 'email' ? parseAllowedEmail(phone) : { email: '', canonical: '' };
  return {
    wallet,
    deviceHash,
    phone: purpose === 'otp' ? normalizeE164(phone) : '',
    email: parsedEmail.email,
    emailCanonical: parsedEmail.canonical,
    username: purpose === 'username' ? normalizeUsername(phone) : '',
  };
};

const alertAdmin = async (text) => {
  if (!ADMIN_CHAT) return;
  await sendTelegram(ADMIN_CHAT, text);
};

const readBody = (req) =>
  new Promise((resolveBody, rejectBody) => {
    const limit = 32_768;
    const timeout = setTimeout(() => {
      rejectBody(new Error('timeout'));
      req.destroy();
    }, 8_000);
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > limit) {
        clearTimeout(timeout);
        rejectBody(new Error('payload'));
        req.destroy();
      }
    });
    req.on('end', () => {
      clearTimeout(timeout);
      try {
        resolveBody(JSON.parse(raw || '{}'));
      } catch {
        resolveBody({});
      }
    });
    req.on('error', () => {
      clearTimeout(timeout);
      resolveBody({});
    });
  });

const sendTelegram = async (chatId, text) => {
  if (!TELEGRAM_TOKEN || !chatId) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const sendWhatsApp = async (phone, text) => {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID || !phone) return false;
  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: String(phone).replace(/\D/g, ''),
        type: 'text',
        text: { body: text },
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const sendSms = async (phone, text) => {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM || !phone) return false;
  try {
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
    const params = new URLSearchParams({ To: phone, From: TWILIO_FROM, Body: text });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      }
    );
    return response.ok;
  } catch {
    return false;
  }
};

const deliverOtp = async (phone, code) => {
  const text = `Quatrivium Credit: su código de autenticación es ${code}. Caduca en 10 minutos. No lo comparta.`;
  if (await sendSms(phone, text)) return 'sms';
  if (await sendWhatsApp(phone, text)) return 'whatsapp';
  return '';
};

const sendEmail = async (to, subject, text) => {
  if (!RESEND_KEY || !EMAIL_FROM || !to) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, text }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const deliverEmailOtp = async (email, code) => {
  const text = `Quatrivium Credit: su código es ${code}. Caduca en 10 minutos. No lo comparta.`;
  if (await sendEmail(email, 'Quatrivium Credit: código de verificación', text)) return 'email';
  return '';
};

const normalizeE164 = (value) => {
  const trimmed = String(value || '').replace(/[^\d+]/g, '');
  if (!trimmed) return '';
  const withPlus = trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
  return /^\+[1-9]\d{7,14}$/.test(withPlus) ? withPlus : '';
};

const hashOtp = (code, phoneHash, wallet) =>
  createHash('sha256').update(`${DATA_KEY_RAW}:${code}:${phoneHash}:${wallet}`).digest('hex');

const hashRecoverOtp = (code, emailHash) =>
  createHash('sha256').update(`${DATA_KEY_RAW}:pwrecover:${code}:${emailHash}`).digest('hex');

const sixDigitCode = () => {
  for (;;) {
    const n = randomBytes(4).readUInt32BE(0);
    if (n < 4_294_000_000) return String(n % 1_000_000).padStart(6, '0');
  }
};

const wrapOk = (value) => /^0x[0-9a-f]{64}$/.test(String(value || ''));

const identityProvider = RPC ? new JsonRpcProvider(RPC) : null;

const takenByOther = (owner, wallet) => {
  if (!owner || owner === ZeroAddress) return false;
  return String(owner).toLowerCase() !== String(wallet).toLowerCase();
};

const assertIdentityAvailable = async (phoneHash, deviceHash, wallet) => {
  if (!CONTRACT || !identityProvider) return;
  const contract = new Contract(
    CONTRACT,
    ['function walletOfPhone(bytes32) view returns (address)', 'function walletOfDevice(bytes32) view returns (address)'],
    identityProvider
  );
  const [phoneOwner, deviceOwner] = await Promise.all([
    contract.walletOfPhone(phoneHash),
    contract.walletOfDevice(deviceHash),
  ]);
  if (takenByOther(phoneOwner, wallet)) {
    const error = new Error('phone taken');
    error.status = 409;
    throw error;
  }
  if (takenByOther(deviceOwner, wallet)) {
    const error = new Error('device taken');
    error.status = 409;
    throw error;
  }
};

const attestIdentity = async (wallet, phoneHash, deviceHash) => {
  if (!ATTESTER_KEY || !CONTRACT || !/^0x[0-9a-fA-F]{40}$/.test(CONTRACT)) {
    throw new Error('attester');
  }
  const deadline = Math.floor(Date.now() / 1000) + 30 * 60;
  const packed = keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ['address', 'bytes32', 'bytes32', 'uint256', 'uint256', 'address'],
      [getAddress(wallet), phoneHash, deviceHash, deadline, CHAIN_ID, getAddress(CONTRACT)]
    )
  );
  const signer = new Wallet(ATTESTER_KEY);
  const signature = await signer.signMessage(getBytes(packed));
  const parsed = Signature.from(signature);
  return { phoneHash, deviceHash, deadline, v: parsed.v, r: parsed.r, s: parsed.s };
};

const notifyWallet = async (wallet, kind, text) => {
  const profile = store.profiles[wallet.toLowerCase()];
  const chatId = store.telegramByWallet[wallet.toLowerCase()];
  const pushChannels = kind === 'debt' || profile?.prefs?.[kind] === true;
  if (!pushChannels && !profile?.email) return;
  if (pushChannels) {
    await sendTelegram(chatId, text);
    if (profile) await sendWhatsApp(profile.whatsapp || profile.phone, text);
  }
  if (profile?.email) await sendEmail(profile.email, 'Quatrivium Credit', text);
};

const bindTelegram = (wallet, chatId) => {
  const key = String(wallet).toLowerCase();
  store.telegramByWallet[key] = String(chatId);
  store.walletByChat[String(chatId)] = key;
  saveStore(store);
};

const consumeBindCode = (payload) => {
  const code = String(payload || '').trim().toLowerCase();
  if (!/^[a-z0-9]{8,12}$/.test(code)) return null;
  const pending = store.pendingBinds?.[code];
  if (!pending) return null;
  delete store.pendingBinds[code];
  if (Number(pending.exp) < Date.now()) {
    saveStore(store);
    return null;
  }
  return String(pending.wallet || '').toLowerCase();
};

const pollTelegram = async () => {
  if (!TELEGRAM_TOKEN) return;
  let offset = 0;
  for (;;) {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?timeout=25&offset=${offset}`;
      const data = await (await fetch(url)).json();
      for (const update of data.result || []) {
        offset = update.update_id + 1;
        const message = update.message;
        const text = String(message?.text || '');
        const chatId = message?.chat?.id;
        if (!chatId || !text.startsWith('/start')) continue;
        const payload = text.replace('/start', '').trim();
        const wallet = consumeBindCode(payload);
        if (wallet) {
          bindTelegram(wallet, chatId);
          await sendTelegram(chatId, 'Quatrivium Credit: Telegram quedó vinculado. Recibirá los dos avisos de pago (mitad de plazo y antes del corte). El resto de avisos es opcional.');
        } else {
          await sendTelegram(chatId, 'Abra el vínculo desde Quatrivium Credit para vincular su billetera. No envíe una dirección a mano.');
        }
      }
    } catch {
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
};

const DAY = 86400;

const installmentWindows = (loanStart, loanDue, nextDue, installments) => {
  const startTs = Number(loanStart) || 0;
  const dueTs = Number(loanDue) || 0;
  const due = Number(nextDue) || dueTs;
  const n = Math.max(1, Number(installments) || 1);
  if (due <= 0) return null;
  const full = Math.max(0, dueTs - startTs);
  const duration =
    n <= 1
      ? full > 0
        ? full
        : Math.max(1, due - startTs)
      : full > 0
        ? Math.max(1, Math.floor(full / n))
        : Math.max(1, due - startTs);
  const start = n <= 1 ? startTs || due - duration : Math.max(startTs || 0, due - duration);
  const span = Math.max(1, due - start);
  const cutoffLead = span >= 3 * DAY ? DAY : Math.min(6 * 3600, Math.max(3600, Math.floor(span / 4)));
  return {
    mid: start + Math.floor(span / 2),
    due,
    cutoffAt: due - cutoffLead,
  };
};

const scanDebtReminders = async (contract) => {
  const wallets = new Set([
    ...Object.keys(store.profiles),
    ...Object.keys(store.telegramByWallet),
  ]);
  const now = Math.floor(Date.now() / 1000);
  let changed = false;
  for (const wallet of wallets) {
    try {
      const loan = await contract.usuarios(wallet);
      if (!Number(loan.montoActivo) && !loan.enMora) continue;
      const due = Number(loan.vencimiento);
      let nextDue = due;
      let totales = 1;
      try {
        const plan = await contract.planPago(wallet);
        nextDue = Number(plan.venceCuota) || due;
        totales = Number(plan.totales) || 1;
      } catch {
        // contrato anterior
      }
      let loanStart = 0;
      try {
        const progress = await contract.obtenerProgresoUsuario(wallet);
        loanStart = Number(progress.ultimoPrestamoTimestamp || progress[2] || 0);
      } catch {
        // ignore
      }
      const windows = installmentWindows(loanStart, due, nextDue, totales);
      if (!windows) continue;
      const midKey = `${wallet}:${windows.due}:mid`;
      const cutKey = `${wallet}:${windows.due}:cutoff`;
      if (windows.mid < windows.cutoffAt - 3600 && now >= windows.mid && now < windows.cutoffAt && !store.reminded[midKey]) {
        await notifyWallet(
          wallet,
          'debt',
          'Quatrivium Credit: va a la mitad del plazo. Puede pagar ahora y no dejarlo para el corte.'
        );
        store.reminded[midKey] = true;
        changed = true;
      }
      if (now >= windows.cutoffAt && now <= windows.due + 3600 && !store.reminded[cutKey]) {
        await notifyWallet(
          wallet,
          'debt',
          'Quatrivium Credit: el pago vence pronto. Regularice antes del corte para no entrar en mora.'
        );
        store.reminded[cutKey] = true;
        changed = true;
      }
    } catch {
      // ignore wallet
    }
  }
  if (changed) saveStore(store);
};

const watchChain = async () => {
  if (!CONTRACT || !RPC) {
    console.log('Avisos: falta contrato o RPC. El servidor de perfiles sigue activo.');
    return;
  }
  const provider = new JsonRpcProvider(RPC);
  const contract = new Contract(CONTRACT, ABI, provider);
  if (!store.lastBlock) {
    const latest = await provider.getBlockNumber();
    store.lastBlock = START_BLOCK > 0 ? START_BLOCK : latest;
    saveStore(store);
  }

  let lastDebtCheck = 0;
  for (;;) {
    try {
      const latest = await provider.getBlockNumber();
      const from = store.lastBlock + 1;
      if (from <= latest) {
        const to = Math.min(from + 4000, latest);
        const [signups, bonuses, commissions, pausedEv, unpausedEv, adminExec] = await Promise.all([
          contract.queryFilter(contract.filters.AfiliadoRegistrado(), from, to),
          contract.queryFilter(contract.filters.BonoActivacionPagado(), from, to),
          contract.queryFilter(contract.filters.ComisionGeneracional(), from, to),
          contract.queryFilter(contract.filters.Paused(), from, to),
          contract.queryFilter(contract.filters.Unpaused(), from, to),
          contract.queryFilter(contract.filters.AdminActionExecuted(), from, to),
        ]);
        for (const event of signups) {
          const padre = String(event.args?.padre || '');
          const usuario = String(event.args?.usuario || '');
          await notifyWallet(
            padre,
            'signup',
            `Quatrivium Credit: una persona se registró con su código.\nCuenta: ${usuario.slice(0, 6)}…${usuario.slice(-4)}`
          );
        }
        for (const event of bonuses) {
          const padre = String(event.args?.padre || '');
          await notifyWallet(padre, 'commission', 'Quatrivium Credit: recibió el bono de activación de un referido.');
        }
        for (const event of commissions) {
          const beneficiario = String(event.args?.beneficiario || '');
          await notifyWallet(beneficiario, 'commission', 'Quatrivium Credit: recibió una comisión de su red.');
        }
        if (pausedEv.length) {
          await alertAdmin('Quatrivium Credit ALERTA: el contrato fue PAUSADO. Préstamos y registros están detenidos.');
        }
        if (unpausedEv.length) {
          await alertAdmin('Quatrivium Credit: el contrato fue despausado.');
        }
        for (const event of adminExec) {
          await alertAdmin(`Quatrivium Credit: acción de admin ejecutada ${event.args?.selector || ''}`);
        }
        store.lastBlock = to;
        saveStore(store);
      }
      if (Date.now() - lastDebtCheck > 60_000) {
        lastDebtCheck = Date.now();
        await scanDebtReminders(contract);
      }
    } catch (error) {
      console.error('Avisos chain:', error.message || error);
    }
    await new Promise((r) => setTimeout(r, 20000));
  }
};

const sameHash = (left, right) => {
  try {
    const a = Buffer.from(String(left || ''), 'hex');
    const b = Buffer.from(String(right || ''), 'hex');
    if (a.length !== 32 || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

const isJsonRequest = (req) => {
  const type = String(req.headers['content-type'] || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  return type === 'application/json';
};

const requestPath = (req) => String(req.url || '/').split('?')[0];

const server = createServer(async (req, res) => {
  requestOrigin = String(req.headers.origin || '');
  if (!originAllowed()) {
    json(res, 403, { error: 'origin' });
    return;
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': corsOrigin(),
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
      ...SECURITY_HEADERS,
    });
    res.end();
    return;
  }
  const path = requestPath(req);
  const ip = clientIp(req);
  if (req.method === 'GET' && path === '/health') {
    json(res, 200, { ok: true });
    return;
  }
  if (req.method !== 'POST') {
    json(res, 405, { error: 'method' });
    return;
  }
  if (!isJsonRequest(req)) {
    json(res, 415, { error: 'type' });
    return;
  }
  if (path === '/profile') {
    if (!rateLimit(ip, 30)) {
      json(res, 429, { error: 'rate' });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 413, { error: 'payload' });
      return;
    }
    let wallet;
    try {
      wallet = requireAuth(body).wallet;
    } catch (error) {
      json(res, error.message === 'wallet' ? 400 : 401, { error: error.message || 'auth' });
      return;
    }
    const prev = store.profiles[wallet] || {};
    store.profiles[wallet] = {
      phone: stripUnsafe(body.contactPhone || prev.phone || '', 20),
      whatsapp: stripUnsafe(body.whatsapp || body.contactPhone || prev.whatsapp || '', 20),
      telegramUsername: stripUnsafe(String(body.telegramUsername || prev.telegramUsername || '').replace(/^@/, ''), 32),
      email: prev.email || '',
      prefs: {
        debt: true,
        commission: body.prefs?.commission === true,
        signup: body.prefs?.signup === true,
      },
      displayName: stripUnsafe(body.displayName || prev.displayName || '', 24),
      username: prev.username || '',
      avatarId: Number.isFinite(Number(body.avatarId)) ? Math.max(0, Math.min(7, Number(body.avatarId))) : prev.avatarId || 0,
    };
    persist();
    json(res, 200, { ok: true });
    return;
  }
  if (path === '/telegram/prepare') {
    if (!rateLimit(ip, 20)) {
      json(res, 429, { error: 'rate' });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 413, { error: 'payload' });
      return;
    }
    let wallet;
    try {
      wallet = requireAuth(body).wallet;
    } catch (error) {
      json(res, error.message === 'wallet' ? 400 : 401, { error: error.message || 'auth' });
      return;
    }
    if (String(body.purpose) !== 'vincular-avisos') {
      json(res, 401, { error: 'purpose' });
      return;
    }
    store.pendingBinds = store.pendingBinds || {};
    const now = Date.now();
    for (const [code, item] of Object.entries(store.pendingBinds)) {
      if (Number(item?.exp) < now) delete store.pendingBinds[code];
    }
    const pendingCount = Object.keys(store.pendingBinds).length;
    if (pendingCount > 2000) {
      json(res, 429, { error: 'rate' });
      return;
    }
    const code = randomBytes(5).toString('hex');
    store.pendingBinds[code] = { wallet, exp: now + 10 * 60 * 1000 };
    persist();
    json(res, 200, { code });
    return;
  }
  if (path === '/otp/request' || path === '/otp/verify') {
    if (!rateLimit(`otp:${ip}`, 12, 15 * 60 * 1000)) {
      json(res, 429, { error: 'rate' });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 413, { error: 'payload' });
      return;
    }
    let authn;
    try {
      authn = requireAuth(body);
    } catch (error) {
      json(res, error.message === 'wallet' ? 400 : 401, { error: error.message || 'auth' });
      return;
    }
    if (String(body.purpose) !== 'otp') {
      json(res, 401, { error: 'purpose' });
      return;
    }
    const wallet = authn.wallet;
    const phone = authn.phone;
    const deviceHash = authn.deviceHash;
    const phoneHash = hashPhone(phone);
    store.otps = store.otps || {};
    store.phoneClaims = store.phoneClaims || {};
    const now = Date.now();
    for (const [key, item] of Object.entries(store.otps)) {
      if (Number(item?.exp) < now) delete store.otps[key];
    }
    const claimed = store.phoneClaims[phoneHash];
    if (claimed && claimed.wallet && claimed.wallet !== wallet && Number(claimed.exp) > now) {
      json(res, 409, { error: 'phone taken' });
      return;
    }
    try {
      await assertIdentityAvailable(phoneHash, deviceHash, wallet);
    } catch (error) {
      json(res, Number(error.status) || 503, { error: error.message || 'identity' });
      return;
    }

    if (path === '/otp/request') {
      if (!rateLimit(`otp-phone:${phoneHash}`, 3, 15 * 60 * 1000)) {
        json(res, 429, { error: 'rate' });
        return;
      }
      if (Object.keys(store.otps).length > 2000) {
        json(res, 429, { error: 'rate' });
        return;
      }
      const code = (() => {
        for (;;) {
          const n = randomBytes(4).readUInt32BE(0);
          if (n < 4_294_000_000) return String(n % 1_000_000).padStart(6, '0');
        }
      })();
      store.otps[wallet] = {
        phoneHash,
        deviceHash,
        codeHash: hashOtp(code, phoneHash, wallet),
        exp: now + 10 * 60 * 1000,
        attempts: 0,
      };
      persist();
      const channel = await deliverOtp(phone, code);
      if (!channel) {
        delete store.otps[wallet];
        persist();
        json(res, 503, { error: 'delivery' });
        return;
      }
      json(res, 200, { ok: true, channel });
      return;
    }

    const pending = store.otps[wallet];
    const code = String(body.code || '').replace(/\D/g, '');
    if (!pending || pending.phoneHash !== phoneHash || pending.deviceHash !== deviceHash) {
      json(res, 400, { error: 'otp' });
      return;
    }
    if (Number(pending.exp) < now) {
      delete store.otps[wallet];
      persist();
      json(res, 400, { error: 'expired' });
      return;
    }
    pending.attempts = Number(pending.attempts || 0) + 1;
    if (pending.attempts > 5) {
      delete store.otps[wallet];
      persist();
      json(res, 429, { error: 'rate' });
      return;
    }
    if (!sameHash(pending.codeHash, hashOtp(code, phoneHash, wallet))) {
      persist();
      json(res, 401, { error: 'code' });
      return;
    }
    try {
      const attestation = await attestIdentity(wallet, phoneHash, deviceHash);
      store.phoneClaims[phoneHash] = { wallet, exp: now + 24 * 60 * 60 * 1000 };
      delete store.otps[wallet];
      persist();
      json(res, 200, attestation);
    } catch {
      json(res, 503, { error: 'attester' });
    }
    return;
  }
  if (path === '/email/request' || path === '/email/verify') {
    if (!rateLimit(`email:${ip}`, 12, 15 * 60 * 1000)) {
      json(res, 429, { error: 'rate' });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 413, { error: 'payload' });
      return;
    }
    let authn;
    try {
      authn = requireAuth(body);
    } catch (error) {
      json(res, error.message === 'wallet' || error.message === 'email' ? 400 : 401, { error: error.message || 'auth' });
      return;
    }
    if (String(body.purpose) !== 'email') {
      json(res, 401, { error: 'purpose' });
      return;
    }
    const wallet = authn.wallet;
    const email = authn.email;
    const emailHash = hashEmail(authn.emailCanonical || email);
    store.emailOtps = store.emailOtps || {};
    store.emailClaims = store.emailClaims || {};
    const now = Date.now();
    for (const [key, item] of Object.entries(store.emailOtps)) {
      if (Number(item?.exp) < now) delete store.emailOtps[key];
    }
    const claimed = store.emailClaims[emailHash];
    if (claimed && claimed.wallet && claimed.wallet !== wallet && Number(claimed.exp) > now) {
      json(res, 409, { error: 'taken' });
      return;
    }
    if (path === '/email/request') {
      if (!rateLimit(`email-addr:${emailHash}`, 3, 15 * 60 * 1000)) {
        json(res, 429, { error: 'rate' });
        return;
      }
      const code = (() => {
        for (;;) {
          const n = randomBytes(4).readUInt32BE(0);
          if (n < 4_294_000_000) return String(n % 1_000_000).padStart(6, '0');
        }
      })();
      store.emailOtps[wallet] = {
        emailHash,
        email,
        codeHash: hashOtp(code, emailHash, wallet),
        exp: now + 10 * 60 * 1000,
        attempts: 0,
      };
      persist();
      const channel = await deliverEmailOtp(email, code);
      if (!channel) {
        delete store.emailOtps[wallet];
        persist();
        json(res, 503, { error: 'delivery' });
        return;
      }
      json(res, 200, { ok: true, channel });
      return;
    }
    const pending = store.emailOtps[wallet];
    const code = String(body.code || '').replace(/\D/g, '');
    if (!pending || pending.emailHash !== emailHash) {
      json(res, 400, { error: 'otp' });
      return;
    }
    if (Number(pending.exp) < now) {
      delete store.emailOtps[wallet];
      persist();
      json(res, 400, { error: 'expired' });
      return;
    }
    pending.attempts = Number(pending.attempts || 0) + 1;
    if (pending.attempts > 5) {
      delete store.emailOtps[wallet];
      persist();
      json(res, 429, { error: 'rate' });
      return;
    }
    if (!sameHash(pending.codeHash, hashOtp(code, emailHash, wallet))) {
      persist();
      json(res, 401, { error: 'code' });
      return;
    }
    const prevEmail = store.profiles[wallet]?.email;
    if (prevEmail) {
      const oldHash = hashEmail(parseAllowedEmail(prevEmail).canonical || prevEmail);
      if (oldHash !== emailHash && store.emailClaims[oldHash]?.wallet === wallet) {
        delete store.emailClaims[oldHash];
      }
    }
    store.emailClaims[emailHash] = { wallet, exp: now + 365 * 24 * 60 * 60 * 1000 };
    const prev = store.profiles[wallet] || {};
    store.profiles[wallet] = { ...prev, email };
    store.recoveryWraps = store.recoveryWraps || {};
    if (prevEmail) {
      const oldHash = hashEmail(parseAllowedEmail(prevEmail).canonical || prevEmail);
      if (oldHash !== emailHash && store.recoveryWraps[oldHash]?.wallet === wallet) {
        store.recoveryWraps[emailHash] = store.recoveryWraps[oldHash];
        delete store.recoveryWraps[oldHash];
      }
    }
    delete store.emailOtps[wallet];
    persist();
    json(res, 200, { ok: true });
    return;
  }
  if (path === '/username/check' || path === '/username/claim') {
    if (!rateLimit(`username:${ip}`, 20, 15 * 60 * 1000)) {
      json(res, 429, { error: 'rate' });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 413, { error: 'payload' });
      return;
    }
    let authn;
    try {
      authn = requireAuth(body);
    } catch (error) {
      json(res, error.message === 'wallet' || error.message === 'username' ? 400 : 401, { error: error.message || 'auth' });
      return;
    }
    if (String(body.purpose) !== 'username') {
      json(res, 401, { error: 'purpose' });
      return;
    }
    const username = authn.username;
    store.usernameClaims = store.usernameClaims || {};
    const holder = store.usernameClaims[username];
    const taken = Boolean(holder && holder.wallet && holder.wallet !== authn.wallet);
    if (path === '/username/check') {
      json(res, taken ? 409 : 200, { available: !taken, error: taken ? 'taken' : undefined });
      return;
    }
    if (taken) {
      json(res, 409, { error: 'taken' });
      return;
    }
    const prevName = store.profiles[authn.wallet]?.username;
    if (prevName && prevName !== username && store.usernameClaims[prevName]?.wallet === authn.wallet) {
      delete store.usernameClaims[prevName];
    }
    store.usernameClaims[username] = { wallet: authn.wallet };
    const prev = store.profiles[authn.wallet] || {};
    store.profiles[authn.wallet] = { ...prev, username, displayName: username };
    persist();
    json(res, 200, { ok: true, username });
    return;
  }
  if (path === '/profiles') {
    if (!rateLimit(`profiles:${ip}`, 20)) {
      json(res, 429, { error: 'rate' });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 413, { error: 'payload' });
      return;
    }
    try {
      requireAuth(body);
    } catch (error) {
      json(res, error.message === 'wallet' ? 400 : 401, { error: error.message || 'auth' });
      return;
    }
    if (String(body.purpose) !== 'perfil') {
      json(res, 401, { error: 'purpose' });
      return;
    }
    const wallets = (Array.isArray(body.wallets) ? body.wallets : [])
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((item) => /^0x[0-9a-f]{40}$/.test(item))
      .slice(0, 20);
    const profiles = {};
    for (const wallet of wallets) {
      const item = store.profiles[wallet];
      if (!item?.displayName && !item?.username) continue;
      profiles[wallet] = {
        displayName: stripUnsafe(item.username || item.displayName, 24),
        avatarId: item.avatarId || 0,
      };
    }
    json(res, 200, { profiles });
    return;
  }
  if (path === '/password/recovery-store') {
    if (!rateLimit(`pwstore:${ip}`, 12, 15 * 60 * 1000)) {
      json(res, 429, { error: 'rate' });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 413, { error: 'payload' });
      return;
    }
    let authn;
    try {
      authn = requireAuth(body);
    } catch (error) {
      json(res, error.message === 'wallet' ? 400 : 401, { error: error.message || 'auth' });
      return;
    }
    if (String(body.purpose) !== 'perfil') {
      json(res, 401, { error: 'purpose' });
      return;
    }
    const wrap = String(body.wrap || '').toLowerCase();
    if (!wrapOk(wrap)) {
      json(res, 400, { error: 'wrap' });
      return;
    }
    const email = store.profiles[authn.wallet]?.email;
    const parsed = parseAllowedEmail(email);
    if (!parsed.canonical) {
      json(res, 400, { error: 'email' });
      return;
    }
    const emailHash = hashEmail(parsed.canonical);
    store.recoveryWraps = store.recoveryWraps || {};
    for (const [key, item] of Object.entries(store.recoveryWraps)) {
      if (item?.wallet === authn.wallet && key !== emailHash) delete store.recoveryWraps[key];
    }
    store.recoveryWraps[emailHash] = { wallet: authn.wallet, wrap };
    try {
      await persist();
    } catch {
      json(res, 500, { error: 'store' });
      return;
    }
    json(res, 200, { ok: true });
    return;
  }
  if (path === '/password/recover-request') {
    if (!rateLimit(`pwrecover:${ip}`, 8, 15 * 60 * 1000)) {
      json(res, 429, { error: 'rate' });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 413, { error: 'payload' });
      return;
    }
    const parsed = parseAllowedEmail(body.email || body.canonical);
    if (!parsed.canonical) {
      json(res, 400, { error: 'email' });
      return;
    }
    const emailHash = hashEmail(parsed.canonical);
    if (!rateLimit(`pwrecover-addr:${emailHash}`, 3, 15 * 60 * 1000)) {
      json(res, 429, { error: 'rate' });
      return;
    }
    store.emailClaims = store.emailClaims || {};
    store.recoveryWraps = store.recoveryWraps || {};
    store.recoverOtps = store.recoverOtps || {};
    const claimed = store.emailClaims[emailHash];
    const wrapRow = store.recoveryWraps[emailHash];
    const now = Date.now();
    for (const [key, item] of Object.entries(store.recoverOtps)) {
      if (Number(item?.exp) < now) delete store.recoverOtps[key];
    }
    if (claimed?.wallet && wrapRow?.wrap && wrapOk(wrapRow.wrap) && claimed.wallet === wrapRow.wallet) {
      const code = sixDigitCode();
      store.recoverOtps[emailHash] = {
        wallet: claimed.wallet,
        codeHash: hashRecoverOtp(code, emailHash),
        exp: now + 10 * 60 * 1000,
        attempts: 0,
      };
      try {
        await persist();
      } catch {
        delete store.recoverOtps[emailHash];
        json(res, 500, { error: 'store' });
        return;
      }
      const channel = await sendEmail(
        parsed.email,
        'Quatrivium Credit: restablecer contraseña',
        `Quatrivium Credit: su código para restablecer la contraseña es ${code}. Caduca en 10 minutos. No lo comparta.`
      );
      if (!channel) {
        delete store.recoverOtps[emailHash];
        persist();
        json(res, 200, { ok: true });
        return;
      }
    }
    json(res, 200, { ok: true });
    return;
  }
  if (path === '/password/recover-verify') {
    if (!rateLimit(`pwverify:${ip}`, 12, 15 * 60 * 1000)) {
      json(res, 429, { error: 'rate' });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 413, { error: 'payload' });
      return;
    }
    const parsed = parseAllowedEmail(body.email || body.canonical);
    const code = String(body.code || '').replace(/\D/g, '');
    if (!parsed.canonical || !/^\d{6}$/.test(code)) {
      json(res, 401, { error: 'code' });
      return;
    }
    const emailHash = hashEmail(parsed.canonical);
    store.recoverOtps = store.recoverOtps || {};
    store.recoveryWraps = store.recoveryWraps || {};
    const pending = store.recoverOtps[emailHash];
    const wrapRow = store.recoveryWraps[emailHash];
    const now = Date.now();
    if (!pending || Number(pending.exp) < now) {
      if (pending) delete store.recoverOtps[emailHash];
      persist();
      json(res, 401, { error: 'code' });
      return;
    }
    pending.attempts = Number(pending.attempts || 0) + 1;
    if (pending.attempts > 5) {
      delete store.recoverOtps[emailHash];
      persist();
      json(res, 429, { error: 'rate' });
      return;
    }
    if (!sameHash(pending.codeHash, hashRecoverOtp(code, emailHash)) || !wrapOk(wrapRow?.wrap)) {
      persist();
      json(res, 401, { error: 'code' });
      return;
    }
    const wrap = wrapRow.wrap;
    delete store.recoverOtps[emailHash];
    delete store.recoveryWraps[emailHash];
    try {
      await persist();
    } catch {
      store.recoverOtps[emailHash] = pending;
      store.recoveryWraps[emailHash] = wrapRow;
      json(res, 500, { error: 'store' });
      return;
    }
    json(res, 200, { wrap });
    return;
  }
  json(res, 404, { error: 'not found' });
});

server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.maxHeadersCount = 40;
server.listen(PORT, BIND, () => {
  console.log(`Avisos Quatrivium Credit en http://${BIND}:${PORT}`);
});

pollTelegram().catch((error) => console.error(error));
watchChain().catch((error) => console.error(error));
