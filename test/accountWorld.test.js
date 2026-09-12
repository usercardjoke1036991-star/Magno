const { expect } = require('chai');

const DEMO_USDT = '0x2d4AE5E6984D98777a24473F196326ff2604F5A6'.toLowerCase();
const LIVE_USDT = '0x55d398326f99059ff775485246999027b3197955'.toLowerCase();

function resolvePersistedMode(saved) {
  return saved === 'demo' ? 'demo' : 'live';
}

function isOfficialWorldToken(mode, address) {
  const needle = String(address || '').trim().toLowerCase();
  if (!needle.startsWith('0x') || needle.length !== 42) return false;
  return mode === 'demo' ? needle === DEMO_USDT : needle === LIVE_USDT;
}

describe('mundos Demo y Real', function () {
  it('primera instalacion entra en Real', function () {
    expect(resolvePersistedMode(null)).to.equal('live');
    expect(resolvePersistedMode('')).to.equal('live');
    expect(resolvePersistedMode('live')).to.equal('live');
  });

  it('recuerda Demo si el usuario la eligio', function () {
    expect(resolvePersistedMode('demo')).to.equal('demo');
  });

  it('no trata el USDT oficial de Demo como token apagado', function () {
    expect(isOfficialWorldToken('demo', DEMO_USDT)).to.equal(true);
    expect(isOfficialWorldToken('demo', LIVE_USDT)).to.equal(false);
  });

  it('no mezcla el USDT de Real con el de Demo', function () {
    expect(isOfficialWorldToken('live', LIVE_USDT)).to.equal(true);
    expect(isOfficialWorldToken('live', DEMO_USDT)).to.equal(false);
  });
});
