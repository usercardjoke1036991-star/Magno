const { expect } = require('chai');
const { ethers } = require('hardhat');

function requiredCountPlanned(id) {
  if (id < 1 || id > 100) return 0;
  if (id <= 5) return 3;
  if (id < 10) return 5;
  return 5 * (id - 9);
}

describe('QuatriviumLeveling - hermano de solicitudes', function () {
  it('matches 3 until level 5, 5 until $100, then +5 per level', async () => {
    const Factory = await ethers.getContractFactory('QuatriviumLeveling');
    const leveling = await Factory.deploy();
    expect(await leveling.requiredCount(1)).to.equal(3n);
    expect(await leveling.requiredCount(5)).to.equal(3n);
    expect(await leveling.requiredCount(6)).to.equal(5n);
    expect(await leveling.requiredCount(9)).to.equal(5n);
    expect(await leveling.requiredCount(10)).to.equal(5n);
    expect(await leveling.requiredCount(11)).to.equal(10n);
    expect(await leveling.requiredCount(50)).to.equal(205n);
    expect(await leveling.requiredCount(100)).to.equal(455n);
    expect(await leveling.BONO_NIVEL_MAXIMO()).to.equal(ethers.parseUnits('2000', 18));
    for (let id = 1; id <= 100; id += 1) {
      expect(await leveling.requiredCount(id)).to.equal(BigInt(requiredCountPlanned(id)));
    }
  });

  it('only pays the max bonus when the pool has free cash above the floor', async () => {
    const Factory = await ethers.getContractFactory('QuatriviumLeveling');
    const leveling = await Factory.deploy();
    const twoThousand = ethers.parseUnits('2000', 18);
    expect(await leveling.canPayMaxBonus(twoThousand, twoThousand)).to.equal(false);
    expect(await leveling.canPayMaxBonus(ethers.parseUnits('5000', 18), ethers.parseUnits('5000', 18))).to.equal(true);
  });
});
