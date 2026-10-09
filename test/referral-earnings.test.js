const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

function asWei(value) {
  try {
    if (typeof value === 'bigint') return value;
    if (!value) return 0n;
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function creditDirectWei(earnedWei, bonusWei, commissionWei, amount, kind) {
  const earned = asWei(earnedWei) + amount;
  const bonus = asWei(bonusWei) + (kind === 'bonus' ? amount : 0n);
  const commission = asWei(commissionWei) + (kind === 'commission' ? amount : 0n);
  return {
    earnedWei: earned.toString(),
    bonusWei: bonus.toString(),
    commissionWei: commission.toString(),
  };
}

describe('referral earnings', function () {
  const one = 10n ** 18n;

  it('adds the activation USDT when the signup log is missing', function () {
    const first = creditDirectWei('0', '0', '0', one, 'bonus');
    expect(first.bonusWei).to.equal(one.toString());
    expect(first.earnedWei).to.equal(one.toString());
    expect(first.commissionWei).to.equal('0');
    const second = creditDirectWei(first.earnedWei, first.bonusWei, first.commissionWei, one, 'bonus');
    expect(second.bonusWei).to.equal((one * 2n).toString());
    expect(second.earnedWei).to.equal((one * 2n).toString());
  });

  it('keeps a commission off the activation bonus', function () {
    const next = creditDirectWei('0', '0', '0', one, 'commission');
    expect(next.commissionWei).to.equal(one.toString());
    expect(next.bonusWei).to.equal('0');
    expect(next.earnedWei).to.equal(one.toString());
  });

  it('creates the direct from the bonus event and scans recent blocks first', function () {
    const network = fs.readFileSync(path.join(__dirname, '..', 'services', 'referralNetwork.ts'), 'utf8');
    const earnings = fs.readFileSync(path.join(__dirname, '..', 'utils', 'referralEarnings.ts'), 'utf8');
    expect(earnings).to.include('export function creditDirectWei');
    expect(network).to.include('creditDirectWei');
    expect(network).to.include("addEarned(referido, amount, 'bonus', event.blockNumber || 0, true)");
    expect(network).to.include('const RECENT_SPAN = 30_000');
    expect(network).to.include('queryFilterReliable');
    expect(network).to.not.include('CHUNK_CONCURRENCY');
  });
});
