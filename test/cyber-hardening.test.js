const { expect } = require('chai');
const { concat, getBytes, hexlify, randomBytes, sha256, toUtf8Bytes, toUtf8String } = require('ethers');

function isWeakPin(pin) {
  if (!/^\d{6}$/.test(pin)) return true;
  if (/^(\d)\1{5}$/.test(pin)) return true;
  if ('01234567890'.includes(pin) || '09876543210'.includes(pin)) return true;
  if (new Set(pin.split('')).size <= 2) return true;
  return ['123456', '654321', '123123', '121212', '112233'].includes(pin);
}

function lockoutMs(fails) {
  if (fails < 5) return 0;
  if (fails < 8) return 30_000;
  if (fails < 12) return 5 * 60_000;
  return 30 * 60_000;
}

function hmacSha256(key, data) {
  const block = 64;
  let keyBytes = getBytes(key);
  if (keyBytes.length > block) keyBytes = getBytes(sha256(keyBytes));
  const keyBlock = new Uint8Array(block);
  keyBlock.set(keyBytes);
  const ipad = new Uint8Array(block);
  const opad = new Uint8Array(block);
  for (let i = 0; i < block; i += 1) {
    ipad[i] = keyBlock[i] ^ 0x36;
    opad[i] = keyBlock[i] ^ 0x5c;
  }
  const inner = getBytes(sha256(concat([ipad, getBytes(data)])));
  return getBytes(sha256(concat([opad, inner])));
}

function deriveWrapKey(secret, salt, rounds) {
  let digest = sha256(toUtf8Bytes(`quatrivium.wrap.v1:${salt}:${secret}`));
  for (let i = 1; i < rounds; i += 1) {
    digest = sha256(concat([getBytes(digest), toUtf8Bytes(`:${i}`)]));
  }
  return digest;
}

function keystream(key, iv, length) {
  const out = new Uint8Array(length);
  let offset = 0;
  let counter = 0;
  while (offset < length) {
    const ctr = new Uint8Array(4);
    ctr[0] = (counter >>> 24) & 0xff;
    ctr[1] = (counter >>> 16) & 0xff;
    ctr[2] = (counter >>> 8) & 0xff;
    ctr[3] = counter & 0xff;
    const block = getBytes(sha256(concat([key, iv, ctr])));
    const n = Math.min(32, length - offset);
    out.set(block.subarray(0, n), offset);
    offset += n;
    counter += 1;
  }
  return out;
}

function sealSecret(plaintext, wrapKeyHex) {
  const key = getBytes(wrapKeyHex);
  const macKey = hmacSha256(key, toUtf8Bytes('quatrivium.mac.v1'));
  const iv = randomBytes(16);
  const plain = toUtf8Bytes(plaintext);
  const ks = keystream(key, iv, plain.length);
  const ct = new Uint8Array(plain.length);
  for (let i = 0; i < plain.length; i += 1) ct[i] = plain[i] ^ ks[i];
  const mac = hmacSha256(macKey, getBytes(concat([iv, ct])));
  return JSON.stringify({ v: 1, iv: hexlify(iv), ct: hexlify(ct), mac: hexlify(mac) });
}

function openSecret(blob, wrapKeyHex) {
  const parsed = JSON.parse(blob);
  const key = getBytes(wrapKeyHex);
  const macKey = hmacSha256(key, toUtf8Bytes('quatrivium.mac.v1'));
  const iv = getBytes(parsed.iv);
  const ct = getBytes(parsed.ct);
  const mac = getBytes(parsed.mac);
  const expected = hmacSha256(macKey, getBytes(concat([iv, ct])));
  let diff = 0;
  for (let i = 0; i < mac.length; i += 1) diff |= mac[i] ^ expected[i];
  if (mac.length !== expected.length || diff !== 0) throw new Error('mac');
  const ks = keystream(key, iv, ct.length);
  const plain = new Uint8Array(ct.length);
  for (let i = 0; i < ct.length; i += 1) plain[i] = ct[i] ^ ks[i];
  return toUtf8String(plain);
}

function isPrivateKeyPassword(value) {
  return /^0x[0-9a-fA-F]{64}$/.test(String(value).trim());
}

function isValidMasterPassword(value) {
  if (isPrivateKeyPassword(value)) return false;
  if (value.length < 8 || value.length > 128) return false;
  if (!/^[\x21-\x7E]+$/.test(value)) return false;
  if (/^(.)\1+$/.test(value)) return false;
  if (new Set(value).size < 4) return false;
  return true;
}

function masterPasswordFromRandomBytes(bytes) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  const max = 256 - (256 % alphabet.length);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] >= max) continue;
    out += alphabet[bytes[i] % alphabet.length];
    if (out.length === 16) return out;
  }
  throw new Error('entropy');
}

describe('cyber hardening — PIN and secret box', function () {
  it('rejects weak and sequential PINs', function () {
    expect(isWeakPin('123456')).to.equal(true);
    expect(isWeakPin('000000')).to.equal(true);
    expect(isWeakPin('111222')).to.equal(true);
    expect(isWeakPin('012345')).to.equal(true);
    expect(isWeakPin('847291')).to.equal(false);
  });

  it('escalates lockout after repeated failures', function () {
    expect(lockoutMs(4)).to.equal(0);
    expect(lockoutMs(5)).to.equal(30_000);
    expect(lockoutMs(8)).to.equal(5 * 60_000);
    expect(lockoutMs(12)).to.equal(30 * 60_000);
  });

  it('round-trips a sealed wallet blob and rejects a bad key', function () {
    const wrap = deriveWrapKey('847291', 'salt-a', 32);
    const other = deriveWrapKey('847292', 'salt-a', 32);
    const sealed = sealSecret(JSON.stringify({ privateKey: '0xabc' }), wrap);
    expect(JSON.parse(openSecret(sealed, wrap)).privateKey).to.equal('0xabc');
    expect(() => openSecret(sealed, other)).to.throw();
  });

  it('accepts a user-chosen master password and rejects a private key', function () {
    const generated = masterPasswordFromRandomBytes(randomBytes(64));
    expect(generated).to.have.length(16);
    expect(isValidMasterPassword(generated)).to.equal(true);
    expect(isValidMasterPassword('MiClave#9')).to.equal(true);
    expect(isValidMasterPassword('a'.repeat(16))).to.equal(false);
    expect(isValidMasterPassword('0x' + 'ab'.repeat(32))).to.equal(false);
    expect(isValidMasterPassword('short')).to.equal(false);
  });

  it('seals an immutable KYC fingerprint and keeps it when local fields change', function () {
    const { keccak256, toUtf8Bytes } = require('ethers');
    const fingerprint = (wallet, snap) =>
      keccak256(
        toUtf8Bytes(
          ['quatrivium.kyc.fp.v1', wallet.toLowerCase(), snap.legalName, snap.country, snap.city, snap.docType].join('\n')
        )
      );
    const first = fingerprint('0xABC', {
      legalName: 'Ana Perez',
      country: 'Venezuela',
      city: 'Caracas',
      docType: 'nationalId',
    });
    const save = (prev, nextName) => ({
      boundLegalName: prev?.boundLegalName || nextName,
      legalName: nextName,
      identityFingerprint: prev?.identityFingerprint || fingerprint('0xABC', {
        legalName: prev?.boundLegalName || nextName,
        country: prev?.country || 'Venezuela',
        city: prev?.city || 'Caracas',
        docType: 'nationalId',
      }),
    });
    const original = save(null, 'Ana Perez');
    const edited = save({ ...original, country: 'Venezuela' }, 'Otra Persona');
    expect(original.identityFingerprint).to.equal(first);
    expect(edited.identityFingerprint).to.equal(first);
    expect(edited.boundLegalName).to.equal('Ana Perez');
    expect(edited.legalName).to.equal('Otra Persona');
    expect(edited.identityFingerprint).to.not.equal(
      fingerprint('0xABC', { legalName: 'Otra Persona', country: 'Venezuela', city: 'Caracas', docType: 'nationalId' })
    );
  });

  it('accepts a normal email and rejects junk', function () {
    const normalizeEmail = (value) => String(value || '').trim().toLowerCase().slice(0, 80);
    const isAllowed = (value) => {
      const email = normalizeEmail(value);
      const domain = email.split('@')[1] || '';
      return ['gmail.com', 'googlemail.com', 'proton.me', 'protonmail.com', 'protonmail.ch', 'pm.me'].includes(domain);
    };
    const isValidEmail = (value) => {
      const email = normalizeEmail(value);
      if (email.length < 6 || email.length > 80) return false;
      if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return false;
      return isAllowed(email);
    };
    expect(normalizeEmail('  Ada@Gmail.COM ')).to.equal('ada@gmail.com');
    expect(isValidEmail('ada@gmail.com')).to.equal(true);
    expect(isValidEmail('ada@proton.me')).to.equal(true);
    expect(isValidEmail('ada@hotmail.com')).to.equal(false);
    expect(isValidEmail('no')).to.equal(false);
  });

  it('accepts a unique username and rejects reserved names', function () {
    const normalizeUsername = (value) =>
      String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^@+/, '')
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20);
    const isValidUsername = (value) => {
      const username = normalizeUsername(value);
      if (!/^[a-z][a-z0-9_]{2,19}$/.test(username)) return false;
      return !['admin', 'owner', 'support', 'quatrivium'].includes(username);
    };
    expect(normalizeUsername('@Ada_01')).to.equal('ada_01');
    expect(isValidUsername('ada_01')).to.equal(true);
    expect(isValidUsername('admin')).to.equal(false);
    expect(isValidUsername('ab')).to.equal(false);
  });
});

describe('biometric availability', function () {
  const FINGERPRINT = 1;
  const FACIAL = 2;
  const WEAK = 2;

  function kindsFromTypes(types) {
    const kinds = [];
    if (types.includes(FINGERPRINT)) kinds.push('fingerprint');
    if (types.includes(FACIAL)) kinds.push('facial');
    if (types.includes(3)) kinds.push('iris');
    return kinds;
  }

  function resolveBiometricAvailability(probe) {
    const kinds = kindsFromTypes(Array.isArray(probe.types) ? probe.types : []);
    const hasHardware = Boolean(probe.hasHardware) || kinds.length > 0;
    const enrolled =
      Boolean(probe.enrolled) || (hasHardware && Number(probe.enrolledLevel || 0) >= WEAK);
    if (!hasHardware) {
      return { available: false, hasHardware: false, enrolled: false, kinds, reason: 'no-hardware' };
    }
    if (!enrolled) {
      return { available: false, hasHardware: true, enrolled: false, kinds, reason: 'not-enrolled' };
    }
    return { available: true, hasHardware: true, enrolled: true, kinds, reason: 'ok' };
  }

  it('does not treat a missing NativeModules name as no hardware', function () {
    const status = resolveBiometricAvailability({
      hasHardware: true,
      enrolled: true,
      enrolledLevel: 3,
      types: [FINGERPRINT],
    });
    expect(status.available).to.equal(true);
    expect(status.kinds).to.deep.equal(['fingerprint']);
  });

  it('asks the user to enroll when the sensor exists but nothing is saved', function () {
    const status = resolveBiometricAvailability({
      hasHardware: true,
      enrolled: false,
      enrolledLevel: 1,
      types: [FINGERPRINT],
    });
    expect(status.available).to.equal(false);
    expect(status.reason).to.equal('not-enrolled');
  });

  it('accepts Xiaomi-style probes that only report types or enrolledLevel', function () {
    const byType = resolveBiometricAvailability({
      hasHardware: false,
      enrolled: false,
      enrolledLevel: 0,
      types: [FINGERPRINT],
    });
    expect(byType.hasHardware).to.equal(true);
    expect(byType.reason).to.equal('not-enrolled');

    const byLevel = resolveBiometricAvailability({
      hasHardware: true,
      enrolled: false,
      enrolledLevel: WEAK,
      types: [],
    });
    expect(byLevel.available).to.equal(true);
  });
});

describe('loan cooldown from timestamp', function () {
  const PRESTAMO_COOLDOWN_SECS = 48 * 60 * 60;

  function cooldownRestanteDesdeTimestamp(ultimoPrestamoTimestamp, nowSec) {
    if (!Number.isFinite(ultimoPrestamoTimestamp) || ultimoPrestamoTimestamp <= 0) {
      return 0;
    }
    return Math.max(0, Math.floor(ultimoPrestamoTimestamp) + PRESTAMO_COOLDOWN_SECS - nowSec);
  }

  it('is zero when the user has never borrowed', function () {
    expect(cooldownRestanteDesdeTimestamp(0, 1_700_000_000)).to.equal(0);
  });

  it('counts remaining seconds until 48h after the last loan', function () {
    const last = 1_700_000_000;
    expect(cooldownRestanteDesdeTimestamp(last, last + 3_600)).to.equal(PRESTAMO_COOLDOWN_SECS - 3_600);
  });

  it('is zero once the 48h window has elapsed', function () {
    const last = 1_700_000_000;
    expect(cooldownRestanteDesdeTimestamp(last, last + PRESTAMO_COOLDOWN_SECS)).to.equal(0);
    expect(cooldownRestanteDesdeTimestamp(last, last + PRESTAMO_COOLDOWN_SECS + 10)).to.equal(0);
  });
});

describe('demo credit gates', function () {
  function creditNeedsKyc(demo, exigido, declarado) {
    if (demo) return false;
    return Boolean(exigido) && !declarado;
  }
  function creditNeedsPhone(demo, exigida, bound) {
    if (demo) return false;
    return Boolean(exigida) && !bound;
  }

  it('lets a demo account operate without KYC or phone', function () {
    expect(creditNeedsKyc(true, true, false)).to.equal(false);
    expect(creditNeedsPhone(true, true, false)).to.equal(false);
  });

  it('still requires KYC and phone in live when the contract asks for them', function () {
    expect(creditNeedsKyc(false, true, false)).to.equal(true);
    expect(creditNeedsPhone(false, true, false)).to.equal(true);
    expect(creditNeedsKyc(false, false, false)).to.equal(false);
  });

  it('does not let a live account reuse demo testnet credit', function () {
    function worlds(pref, mainnetConfigured, testnetConfigured) {
      const account = pref === 'demo' ? 'demo' : 'live';
      const runtime = account;
      const creditReady = account === 'live' ? mainnetConfigured : testnetConfigured;
      return { account, runtime, creditReady };
    }
    const liveBeforeMainnet = worlds('live', false, true);
    expect(liveBeforeMainnet.runtime).to.equal('live');
    expect(liveBeforeMainnet.creditReady).to.equal(false);

    const demo = worlds('demo', false, true);
    expect(demo.runtime).to.equal('demo');
    expect(demo.creditReady).to.equal(true);

    const liveOnMainnet = worlds('live', true, true);
    expect(liveOnMainnet.runtime).to.equal('live');
    expect(liveOnMainnet.creditReady).to.equal(true);
  });
});
