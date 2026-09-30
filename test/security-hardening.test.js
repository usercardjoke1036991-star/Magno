const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('defensive security hardening', function () {
  const root = path.join(__dirname, '..');

  it('never stores or returns a wallet wrap from the notify worker', function () {
    const worker = fs.readFileSync(path.join(root, 'scripts', 'notify-worker.mjs'), 'utf8');
    const recovery = fs.readFileSync(path.join(root, 'services', 'passwordRecovery.ts'), 'utf8');
    expect(worker).to.include('sanitizeLoadedStore');
    expect(worker).to.include('next.recoveryWraps = {}');
    expect(worker).to.not.include('json(res, 200, { wrap })');
    expect(worker).to.not.match(/recoveryWraps\[emailHash\] = \{ wallet: authn\.wallet, wrap \}/);
    expect(recovery).to.not.include('wrap,');
    expect(recovery).to.include("throw new Error('device')");
    expect(recovery).to.include('loadLocalRecoveryWrap');
    expect(recovery).to.include('persistLocalRecoveryWrap');
    expect(recovery).to.include("if (body.wrap)");
  });

  it('requires a signed wallet for testnet auto-fund and drops the owner key on a public bind', function () {
    const worker = fs.readFileSync(path.join(root, 'scripts', 'notify-worker.mjs'), 'utf8');
    const auth = fs.readFileSync(path.join(root, 'services', 'walletAuth.ts'), 'utf8');
    const home = fs.readFileSync(path.join(root, 'hooks', 'useHomeHandlers.ts'), 'utf8');
    const charge = fs.readFileSync(path.join(root, 'services', 'founderUsdtCharge.ts'), 'utf8');
    expect(worker).to.include("purpose !== 'autofund'");
    expect(worker).to.include("String(body.purpose) !== 'autofund'");
    expect(worker).to.include('ATTESTER_EXPLICIT || (!isMainnet && !publicAttesterHost ? DEPLOY_KEY : \'\')');
    expect(auth).to.include("| 'autofund'");
    expect(home).to.include("signedAuthBody(signer, address, 'autofund')");
    expect(charge).to.include("signedAuthBody(signer, address, 'autofund')");
  });

  it('approves remaining loan debt instead of MaxUint256 and clears phone claims on release', function () {
    const service = fs.readFileSync(path.join(root, 'services', 'quatriviumCreditService.ts'), 'utf8');
    const worker = fs.readFileSync(path.join(root, 'scripts', 'notify-worker.mjs'), 'utf8');
    const reserva = fs.readFileSync(path.join(root, 'contracts', 'QuatriviumReserva.sol'), 'utf8');
    expect(service).to.not.include('MaxUint256');
    expect(service).to.include('obtenerDeuda(userAddress)');
    expect(service).to.include('remaining.toString()');
    expect(worker).to.include('delete store.phoneClaims[oldPhoneHash]');
    expect(reserva).to.include('if (!_esAttesterCredit()) revert NoAutorizado()');
    expect(reserva).to.include('CAMBIO_ESPERA = 72 hours');
    expect(reserva).to.include('function acceptOwner()');
    expect(reserva).to.include('function applyCredit()');
  });

  it('leaves Sumsub ready behind Render env and does not put secrets in the admin panel', function () {
    const worker = fs.readFileSync(path.join(root, 'scripts', 'notify-worker.mjs'), 'utf8');
    const panel = fs.readFileSync(path.join(root, 'components', 'AdminPanel.tsx'), 'utf8');
    const kyc = fs.readFileSync(path.join(root, 'components', 'KycSection.tsx'), 'utf8');
    expect(worker).to.include('kycProvider: hasKycProvider');
    expect(worker).to.include("path === '/kyc/provider-token'");
    expect(worker).to.include('attesterKms: false');
    expect(panel).to.not.include('SUMSUB_');
    expect(kyc).to.include('openKycProvider');
  });
});
