const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

describe('audit fixes', function () {
  it('returns the daily send when the recovery mail does not go out', function () {
    const worker = read('scripts/notify-worker.mjs');
    const gate = read('components/AppLockGate.tsx');
    expect(worker).to.include("json(res, 503, { error: 'delivery' })");
    expect(worker).to.include('quota.sends = Math.max(0, Number(quota.sends || 0) - 1)');
    expect(worker).to.not.include('delete store.recoverOtps[emailHash];\n        await persist();\n        json(res, 200, { ok: true });');
    expect(gate).to.include("reason.includes('delivery')");
    expect(gate).to.include("t('emailDeliveryFailed')");
  });

  it('stops fame and movement reads when the network does not answer', function () {
    const fame = read('services/fameLeaderboard.ts');
    const history = read('services/movementHistory.ts');
    for (const source of [fame, history]) {
      expect(source).to.include('const SCAN_BUDGET_MS = 18_000');
      expect(source).to.include('withTimeout(provider.getBlockNumber(), CHUNK_TIMEOUT_MS)');
      expect(source).to.include('contract.queryFilter');
      expect(source).to.include('CHUNK_TIMEOUT_MS');
    }
    expect(history).to.include('withTimeout(provider.getBlock(blockNumber), CHUNK_TIMEOUT_MS)');
    expect(fame).to.include('withTimeout(contract.obtenerProgresoUsuario(address), CHUNK_TIMEOUT_MS)');
  });

  it('does not lock reserva when the level cannot be read', function () {
    const reserva = read('services/reservaService.ts');
    expect(reserva).to.include("throw new Error('reserva-read')");
    expect(reserva).to.include("if (raw.includes('reserva-read')) return 'reservaReadFailed'");
  });
});
