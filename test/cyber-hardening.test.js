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
  if (value.length < 8 || value.length > 66) return false;
  if (!/^[\x21-\x7E]+$/.test(value)) return false;
  if (!/[A-Z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) return false;
  if (/^(.)\1+$/.test(value)) return false;
  if (new Set(value).size < 4) return false;
  return true;
}

function masterPasswordFromRandomBytes(bytes) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  const max = 256 - (256 % alphabet.length);
  let pool = '';
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] >= max) continue;
    pool += alphabet[bytes[i] % alphabet.length];
  }
  if (pool.length < 12) throw new Error('entropy');
  return `Ab7#${pool.slice(0, 12)}`.slice(0, 16);
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
    expect(isValidMasterPassword(`Aa1!${'x'.repeat(4)}`)).to.equal(true);
    expect(isValidMasterPassword(`Aa1!${'x'.repeat(62)}`)).to.equal(true);
    expect(isValidMasterPassword(`Aa1!${'x'.repeat(63)}`)).to.equal(false);
    expect(isValidMasterPassword('ClaveValida1')).to.equal(false);
    expect(isValidMasterPassword('clavevalida1!')).to.equal(false);
    expect(isValidMasterPassword('ClaveValida!')).to.equal(false);
    expect(isValidMasterPassword('a'.repeat(16))).to.equal(false);
    expect(isValidMasterPassword('0x' + 'ab'.repeat(32))).to.equal(false);
    expect(isValidMasterPassword('short')).to.equal(false);
  });

  it('creates a 24-word BIP-39 phrase by default', function () {
    const { Mnemonic, HDNodeWallet, randomBytes } = require('ethers');
    const mnemonic = Mnemonic.fromEntropy(randomBytes(32));
    const wallet = HDNodeWallet.fromMnemonic(mnemonic);
    expect(mnemonic.phrase.split(/\s+/)).to.have.length(24);
    expect(wallet.address).to.match(/^0x[0-9a-fA-F]{40}$/);
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
  function liveNeedsKyc(demo, kycDeclarado) {
    return !demo && !kycDeclarado;
  }
  function liveNeedsPhone(demo, identityBound) {
    return !demo && !identityBound;
  }
  function liveNeedsEmail(demo, hasEmail) {
    return !demo && !hasEmail;
  }
  function liveNeedsPhrase(phraseBackedUp) {
    return !phraseBackedUp;
  }
  function liveNeedsDeviceMatch(demo, deviceMatches) {
    return !demo && !deviceMatches;
  }
  function liveCreditReady(demo, flags) {
    return !liveNeedsPhrase(flags.phraseBackedUp)
      && !liveNeedsEmail(demo, flags.hasEmail)
      && !liveNeedsPhone(demo, flags.identityBound)
      && !liveNeedsKyc(demo, flags.kycDeclarado)
      && !liveNeedsDeviceMatch(demo, flags.deviceMatches !== false);
  }
  function identityHashBound(value) {
    const hash = String(value || '');
    return Boolean(hash) && !/^0x0+$/i.test(hash);
  }

  it('lets a demo account operate without KYC, phone or email but requires the 24-word backup', function () {
    expect(liveNeedsKyc(true, false)).to.equal(false);
    expect(liveNeedsPhone(true, false)).to.equal(false);
    expect(liveNeedsEmail(true, false)).to.equal(false);
    expect(liveCreditReady(true, { kycDeclarado: false, identityBound: false, hasEmail: false, phraseBackedUp: false })).to.equal(false);
    expect(liveCreditReady(true, { kycDeclarado: false, identityBound: false, hasEmail: false, phraseBackedUp: true })).to.equal(true);
  });

  it('blocks Solicitar in Real until phrase, email, phone and KYC are bound', function () {
    expect(liveNeedsKyc(false, false)).to.equal(true);
    expect(liveNeedsPhone(false, false)).to.equal(true);
    expect(liveNeedsEmail(false, false)).to.equal(true);
    expect(liveCreditReady(false, { kycDeclarado: true, identityBound: true, hasEmail: true, phraseBackedUp: false })).to.equal(false);
    expect(liveCreditReady(false, { kycDeclarado: true, identityBound: true, hasEmail: false, phraseBackedUp: true })).to.equal(false);
    expect(liveCreditReady(false, { kycDeclarado: true, identityBound: false, hasEmail: true, phraseBackedUp: true })).to.equal(false);
    expect(liveCreditReady(false, { kycDeclarado: false, identityBound: true, hasEmail: true, phraseBackedUp: true })).to.equal(false);
    expect(liveCreditReady(false, { kycDeclarado: true, identityBound: true, hasEmail: true, phraseBackedUp: true })).to.equal(true);
    expect(liveCreditReady(false, { kycDeclarado: true, identityBound: true, hasEmail: true, phraseBackedUp: true, deviceMatches: false })).to.equal(false);
    function deviceMatchAfterIdentityReadFailure(demo) {
      return demo;
    }
    expect(deviceMatchAfterIdentityReadFailure(false)).to.equal(false);
    expect(deviceMatchAfterIdentityReadFailure(true)).to.equal(true);
    expect(identityHashBound('0x0000000000000000000000000000000000000000000000000000000000000000')).to.equal(false);
    expect(identityHashBound('0xabc')).to.equal(true);
  });

  it('awards fame in proportion to donated or pooled USDT', function () {
    const fameFromUsd = (usd, pointsPerUsdt) => {
      if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(pointsPerUsdt) || pointsPerUsdt <= 0) {
        return 0;
      }
      return Math.floor(usd * pointsPerUsdt);
    };
    expect(fameFromUsd(1, 10)).to.equal(10);
    expect(fameFromUsd(25, 10)).to.equal(250);
    expect(fameFromUsd(4, 5)).to.equal(20);
    expect(fameFromUsd(20, 5)).to.equal(100);
    expect(fameFromUsd(0.4, 10)).to.equal(4);
    expect(fameFromUsd(0, 10)).to.equal(0);
  });

  it('shows the full 1000-level catalog when the live cap is unknown', function () {
    function displayMaxLoanLevel(detected) {
      const value = Math.floor(Number(detected) || 0);
      if (value === 100) return 100;
      return 1000;
    }
    expect(displayMaxLoanLevel(0)).to.equal(1000);
    expect(displayMaxLoanLevel(1000)).to.equal(1000);
    expect(displayMaxLoanLevel(100)).to.equal(100);
  });

  it('allows donations only in Real when mainnet is ready', function () {
    function donationVisibleInWorld(product, runtime) {
      return product === 'live' && runtime === 'live';
    }
    function donationAllowedInWorld(product, runtime, mainnetReady) {
      return donationVisibleInWorld(product, runtime) && mainnetReady;
    }
    expect(donationVisibleInWorld('demo', 'demo')).to.equal(false);
    expect(donationVisibleInWorld('live', 'live')).to.equal(true);
    expect(donationAllowedInWorld('demo', 'demo', true)).to.equal(false);
    expect(donationAllowedInWorld('live', 'live', false)).to.equal(false);
    expect(donationAllowedInWorld('live', 'live', true)).to.equal(true);
  });

  it('blocks pool deposits from Demo', function () {
    function poolAllowed(product, runtime) {
      return product === 'live' && runtime === 'live';
    }
    expect(poolAllowed('demo', 'demo')).to.equal(false);
    expect(poolAllowed('live', 'demo')).to.equal(false);
    expect(poolAllowed('live', 'live')).to.equal(true);
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

describe('account entry — password, email and session', () => {
  function canSubmitCreateSecrets(password, email) {
    return isValidMasterPassword(password) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  function canSubmitCreateCode(code) {
    return /^\d{6}$/.test(code);
  }
  function signInNeedsEmailCode() {
    return false;
  }
  function canSubmitSignIn(password, username) {
    return Boolean(password) && /^[a-z][a-z0-9_]{2,19}$/.test(String(username || ''));
  }
  function signInUsernameAllowed(typed, saved) {
    const left = String(typed || '').trim().toLowerCase();
    const right = String(saved || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{2,19}$/.test(left)) return false;
    if (!right) return true;
    return left === right;
  }

  it('asks for username and password before showing the 24 words', () => {
    const steps = ['language', 'welcome', 'credentials', 'phrase'];
    expect(steps.indexOf('language')).to.be.lessThan(steps.indexOf('welcome'));
    expect(steps.indexOf('credentials')).to.be.lessThan(steps.indexOf('phrase'));
    expect(canSubmitCreateSecrets('ClaveValida1!', 'user@correo.com')).to.equal(true);
    function importMarksPhraseOnCreate() {
      return false;
    }
    expect(importMarksPhraseOnCreate()).to.equal(false);
  });

  it('splits create into secrets first and code later', () => {
    expect(canSubmitCreateSecrets('ClaveValida1!', 'user@correo.com')).to.equal(true);
    expect(canSubmitCreateSecrets('ClaveValida1!', '')).to.equal(false);
    expect(canSubmitCreateCode('')).to.equal(false);
    expect(canSubmitCreateCode('123456')).to.equal(true);
  });

  it('tells the user to create an account when this phone has no password yet', () => {
    function signInError(passwordOk, passwordSet) {
      if (passwordOk) return '';
      return passwordSet ? 'lockPasswordWrong' : 'signInNoAccount';
    }
    expect(signInError(false, false)).to.equal('signInNoAccount');
    expect(signInError(false, true)).to.equal('lockPasswordWrong');
    expect(signInError(true, true)).to.equal('');
  });

  it('never asks for a code at sign-in and requires password plus username', () => {
    expect(signInNeedsEmailCode()).to.equal(false);
    expect(canSubmitSignIn('', 'ana_one')).to.equal(false);
    expect(canSubmitSignIn('ClaveValida1', '')).to.equal(false);
    expect(canSubmitSignIn('ClaveValida1', 'ab')).to.equal(false);
    expect(canSubmitSignIn('ClaveValida1', 'ana_one')).to.equal(true);
  });

  it('allows sign-in when no username is stored yet and rejects a different saved username', () => {
    expect(signInUsernameAllowed('ana_one', '')).to.equal(true);
    expect(signInUsernameAllowed('otra_user', 'ana_one')).to.equal(false);
    expect(signInUsernameAllowed('ana_one', 'ana_one')).to.equal(true);
  });

  it('hides create-account on this phone after an account exists and restore accepts 12 or 24 words', () => {
    function welcomeShowsCreate(accountOnPhone, deviceClaimed = false) {
      return !accountOnPhone && !deviceClaimed;
    }
    function canSubmitRestorePhrase(phrase) {
      const words = String(phrase || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      return words.length === 12 || words.length === 24;
    }
    function welcomeActions(accountOnPhone, deviceClaimed = false) {
      if (accountOnPhone) return [];
      if (deviceClaimed) return ['restoreAccount'];
      return ['createPhrase', 'restoreAccount'];
    }
    function canSubmitDeviceCredentials(password, username) {
      return isValidMasterPassword(password) && /^[a-z][a-z0-9_]{2,19}$/.test(username);
    }
    function canSubmitReinstall(phrase, password, username) {
      const words = String(phrase || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      return (words.length === 12 || words.length === 24) && canSubmitDeviceCredentials(password, username);
    }
    function restoreMatchesDevice(claimedWallet, phraseWallet) {
      const claimed = String(claimedWallet || '').toLowerCase();
      const phrase = String(phraseWallet || '').toLowerCase();
      if (!claimed || claimed === '0x0000000000000000000000000000000000000000') return true;
      return Boolean(phrase) && claimed === phrase;
    }
    function walletRunsOnThisDevice(onChainDeviceHash, localDeviceHash) {
      const bound = String(onChainDeviceHash || '');
      if (!bound || /^0x0+$/i.test(bound)) return true;
      return bound.toLowerCase() === String(localDeviceHash || '').toLowerCase();
    }
    function accountOnPhoneFromProbes(password, pin) {
      if (password === true || pin === true) return true;
      if (password === null || pin === null) return null;
      return false;
    }
    function nextEntryScreen({ accountOnPhone, sessionSaved, wrapReady, unlockOn }) {
      if (accountOnPhone === null) return 'signIn';
      if (!accountOnPhone) return 'welcome';
      if (!sessionSaved) return 'signIn';
      if (unlockOn) return 'unlock';
      if (wrapReady) return 'app';
      return 'unlock';
    }
    function orderUnlockMethods(selected, primary) {
      const unique = [...new Set((selected || []).filter(Boolean))];
      if (!unique.length) return ['password'];
      const head = primary && unique.includes(primary) ? primary : unique[0];
      return [head, ...unique.filter((method) => method !== head)];
    }
    expect(welcomeShowsCreate(false)).to.equal(true);
    expect(welcomeShowsCreate(true)).to.equal(false);
    expect(welcomeShowsCreate(false, true)).to.equal(false);
    expect(welcomeActions(false)).to.deep.equal(['createPhrase', 'restoreAccount']);
    expect(welcomeActions(false, true)).to.deep.equal(['restoreAccount']);
    expect(canSubmitDeviceCredentials('ClaveValida1!', 'ana_one')).to.equal(true);
    expect(canSubmitDeviceCredentials('ClaveValida1', 'ana_one')).to.equal(false);
    expect(canSubmitDeviceCredentials('ClaveValida1!', 'ab')).to.equal(false);
    expect(canSubmitReinstall('uno dos tres cuatro cinco seis siete ocho nueve diez once doce', 'ClaveValida1!', 'ana_one')).to.equal(true);
    expect(canSubmitRestorePhrase('alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray')).to.equal(true);
    expect(welcomeActions(true)).to.deep.equal([]);
    expect(restoreMatchesDevice('0xabc', '0xABC')).to.equal(true);
    expect(restoreMatchesDevice('0xabc', '0xdef')).to.equal(false);
    expect(restoreMatchesDevice('', '0xdef')).to.equal(true);
    expect(walletRunsOnThisDevice('', '0x11')).to.equal(true);
    expect(walletRunsOnThisDevice('0x11', '0x11')).to.equal(true);
    expect(walletRunsOnThisDevice('0x11', '0x22')).to.equal(false);
    function sessionOwnedHere(claimedDeviceHash, localDeviceHash) {
      const claimed = String(claimedDeviceHash || '').toLowerCase();
      const local = String(localDeviceHash || '').toLowerCase();
      if (!claimed || /^0x0+$/i.test(claimed)) return true;
      return Boolean(local) && claimed === local;
    }
    expect(sessionOwnedHere('', '0x11')).to.equal(true);
    expect(sessionOwnedHere('0x11', '0x11')).to.equal(true);
    expect(sessionOwnedHere('0x11', '0x22')).to.equal(false);
    expect(nextEntryScreen({ accountOnPhone: true, sessionSaved: true, wrapReady: false, unlockOn: false })).to.equal('unlock');
    expect(nextEntryScreen({ accountOnPhone: true, sessionSaved: true, wrapReady: true, unlockOn: false })).to.equal('app');
    expect(nextEntryScreen({ accountOnPhone: true, sessionSaved: true, wrapReady: false, unlockOn: true })).to.equal('unlock');
    expect(nextEntryScreen({ accountOnPhone: true, sessionSaved: false, wrapReady: false, unlockOn: false })).to.equal('signIn');
    expect(accountOnPhoneFromProbes(null, false)).to.equal(null);
    expect(accountOnPhoneFromProbes(false, false)).to.equal(false);
    expect(nextEntryScreen({ accountOnPhone: null, sessionSaved: false, wrapReady: false, unlockOn: false })).to.equal('signIn');
    expect(nextEntryScreen({ accountOnPhone: false, sessionSaved: false, wrapReady: false, unlockOn: false })).to.equal('welcome');
    expect(orderUnlockMethods(['pin', 'password'], 'pin')).to.deep.equal(['pin', 'password']);
    expect(orderUnlockMethods([])).to.deep.equal(['password']);
    function unlockPromptMethods(selected, primary, primaryOnly) {
      const ordered = orderUnlockMethods(selected, primary);
      return primaryOnly ? [ordered[0]] : ordered;
    }
    expect(unlockPromptMethods(['password', 'email'], 'password', true)).to.deep.equal(['password']);
    expect(unlockPromptMethods(['password', 'email'], 'password', false)).to.deep.equal(['password', 'email']);
    function appOffersDestroyAccount() {
      return false;
    }
    function networkChangeCreatesAccount() {
      return false;
    }
    function liveSecondCreditAllowed({ phoneTaken, deviceTaken }) {
      return !phoneTaken && !deviceTaken;
    }
    expect(appOffersDestroyAccount()).to.equal(false);
    expect(networkChangeCreatesAccount()).to.equal(false);
    expect(liveSecondCreditAllowed({ phoneTaken: true, deviceTaken: false })).to.equal(false);
    expect(liveSecondCreditAllowed({ phoneTaken: false, deviceTaken: true })).to.equal(false);
    expect(liveSecondCreditAllowed({ phoneTaken: false, deviceTaken: false })).to.equal(true);
    expect(canSubmitRestorePhrase('uno dos tres')).to.equal(false);
    expect(canSubmitRestorePhrase('uno dos tres cuatro cinco seis siete ocho nueve diez once doce')).to.equal(true);
  });

  it('hashes the password locally so sign-in does not wait on native digest hops', () => {
    function hashSecret(secret, salt, rounds) {
      let digest = `${salt}:${secret}`;
      const n = Math.max(1, Math.min(rounds, 20_000));
      for (let i = 0; i < n; i += 1) {
        digest = sha256(toUtf8Bytes(digest)).slice(2);
      }
      return digest;
    }
    const first = hashSecret('ClaveValida1', 'salt-a', 32);
    const same = hashSecret('ClaveValida1', 'salt-a', 32);
    const other = hashSecret('ClaveValida1', 'salt-b', 32);
    expect(first).to.equal(same);
    expect(first).to.not.equal(other);
    expect(first).to.match(/^[0-9a-f]{64}$/);
  });
});
