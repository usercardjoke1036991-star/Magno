const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployProtocol } = require('./helpers.cjs');

describe('QuatriviumCredit - 100 loan levels', function () {
  it('seeds 100 tiers: amount up, rate down, interest $ up, top is $10,000', async () => {
    const { contract } = await deployProtocol();
    let prevMonto = 0n;
    let prevTasa = 10_001n;
    let prevInteres = 0n;

    for (let id = 1; id <= 100; id += 1) {
      const [monto, plazo, tasa] = await contract.niveles(id);
      expect(monto, `tier ${id} amount`).to.be.gt(prevMonto);
      expect(tasa, `tier ${id} rate`).to.be.lt(prevTasa);
      const interes = (monto * tasa) / 10000n;
      expect(interes, `tier ${id} interest`).to.be.gt(prevInteres);
      expect(plazo).to.be.gte(1n * 24n * 60n * 60n);
      prevMonto = monto;
      prevTasa = tasa;
      prevInteres = interes;
    }

    expect(prevMonto).to.equal(ethers.parseUnits('10000', 18));
    const first = await contract.niveles(1);
    expect(first[0]).to.equal(ethers.parseUnits('1', 18));
    expect(first[2]).to.equal(10000n);
  });

  it('rejects a level above 100', async () => {
    const { contract, user, tokenAddr } = await deployProtocol();
    await expect(contract.connect(user).solicitarPrestamo(tokenAddr, 101)).to.be.reverted;
  });
});
