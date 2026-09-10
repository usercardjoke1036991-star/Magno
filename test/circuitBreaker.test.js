const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployProtocol, seedPool } = require('./helpers.cjs');

describe('QuatriviumCredit - Circuit Breaker', function () {
  it('rejects user pool withdrawals; pause remains the emergency brake', async () => {
    const { token, contract, owner, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '1000');

    await expect(
      contract.connect(owner).retirarLiquidez(tokenAddr, ethers.parseUnits('600', 18))
    ).to.be.reverted;

    await contract.connect(owner).pausarContrato();
    await expect(contract.connect(owner).solicitarPrestamo(tokenAddr, 0)).to.be.revertedWithCustomError(
      contract,
      'EnforcedPause'
    );
  });
});
