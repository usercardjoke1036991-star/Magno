const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const { Interface } = require('ethers');

const ADMIN_SELECTORS = [
  'setFeeBP',
  'setNivel',
  'setTokenConfig',
  'setInterestModelParams',
  'setReputationParams',
  'setMorosidad',
  'banWallet',
  'despausarContrato',
  'setFeeCollector',
  'addAdmin',
  'removeAdmin',
  'setOwner',
  'setFundador',
  'setRequiredConfirmations',
  'setSecurityParams',
  'setAttester',
  'setKycExigido',
  'setIdentidadExigida',
  'retirarComisiones',
  'retirarComisionesToken',
];

function clientInterface() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'constants', 'contractConfig.ts'), 'utf8');
  const fragments = [...src.matchAll(/'(function [^']+|event [^']+)'/g)].map((row) => row[1]);
  return new Interface(fragments);
}

describe('CONTRACT_ABI', function () {
  it('encodes every timelocked admin selector the contract allows', function () {
    const iface = clientInterface();
    for (const name of ADMIN_SELECTORS) {
      expect(() => iface.getFunction(name), name).to.not.throw();
    }
    expect(() => iface.getFunction('cancelAdminAction')).to.not.throw();
    expect(() => iface.getFunction('proposeAdminAction')).to.not.throw();
    expect(iface.parseTransaction({ data: iface.encodeFunctionData('despausarContrato', []) }).name).to.equal(
      'despausarContrato'
    );
  });
});
