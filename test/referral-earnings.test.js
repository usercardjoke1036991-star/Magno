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

  it('creates the direct from the bonus event and asks for yesterday before the recent blocks', function () {
    const network = fs.readFileSync(path.join(__dirname, '..', 'services', 'referralNetwork.ts'), 'utf8');
    const earnings = fs.readFileSync(path.join(__dirname, '..', 'utils', 'referralEarnings.ts'), 'utf8');
    expect(earnings).to.include('export function creditDirectWei');
    expect(network).to.include('creditDirectWei');
    expect(network).to.include("addEarned(referido, amount, 'bonus', event.blockNumber || 0, true)");
    expect(network).to.include('const RECENT_SPAN = 50_000');
    expect(network).to.include('const SCAN_BUDGET_MS = 18_000');
    expect(network).to.include('const DIRECT_SCAN_BUDGET_MS = 28_000');
    expect(network).to.include('const YESTERDAY_TO_S = 36 * 60 * 60');
    expect(network).to.include('const PRIORITY_FROM_S = 24 * 60 * 60');
    expect(network).to.include('const DIRECT_CHUNK = 20_000');
    expect(network).to.include('pending.unshift([mid, end], [start, mid - 1])');
    const priority = network.indexOf('chunkRanges(priorityStart, priorityEnd, DIRECT_CHUNK)');
    const recent = network.indexOf('chunkRanges(recentFrom, toBlock, DIRECT_CHUNK)');
    expect(priority).to.be.greaterThan(0);
    expect(priority).to.be.lessThan(recent);
    expect(network).to.include('queryFilterRanges');
    expect(network.indexOf('queryFilterRanges')).to.be.lessThan(network.indexOf('const commissionPack'));
    expect(network).to.include('queryFilterReliable');
    expect(network).to.not.include('CHUNK_CONCURRENCY');
    expect(network).to.include('withTimeout(provider.getBlock(blockNumber), CHUNK_TIMEOUT_MS)');
    expect(network).to.include('withTimeout(provider.getBlockNumber(), CHUNK_TIMEOUT_MS)');
    expect(network).to.include('withTimeout(contract.obtenerProgresoUsuario(address), CHUNK_TIMEOUT_MS)');
  });
});
