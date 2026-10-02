const { expect } = require('chai');
const { ethers } = require('hardhat');
const { seedPool, registerAndFund, proposeAndExecute, deployFamaAndCredit } = require('./helpers.cjs');

async function deployHarness() {
  const signers = await ethers.getSigners();
  const owner = signers[0];
  const user = signers[1];
  const extra = signers[2];
  const third = signers[3];
  const Token = await ethers.getContractFactory('ERC20Mock');
  const Aggregator = await ethers.getContractFactory('MockV3Aggregator');
  const { getLinkedCreditFactory } = require('../scripts/linkCredit.cjs');
  const Harness = await getLinkedCreditFactory(ethers, 'QuatriviumCreditHarness');
  const token = await Token.deploy();
  const feed = await Aggregator.deploy(8, 100000000);
  const tokenAddr = await token.getAddress();
  const { contract } = await deployFamaAndCredit(
    Harness,
    tokenAddr,
    await feed.getAddress(),
    owner,
    500,
    [owner.address],
    1
  );
  return { token, contract, owner, user, extra, third, tokenAddr, signers };
}

describe('QuatriviumCredit - cupo de originacion diario', function () {
  it('defaults the count brake to 10000 and counts L1 on the small lane', async () => {
    const { token, contract, owner, user, tokenAddr } = await deployHarness();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user);
    expect(await contract.maxOriginationsPerWindow()).to.equal(10000n);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 0);
    expect(await contract.originationsInWindow()).to.equal(1n);
    expect(await contract.originatedChicoInWindow()).to.equal(ethers.parseUnits('1', 18));
    expect(await contract.originatedPrincipalInWindow()).to.equal(0n);
  });

  it('blocks a second large loan that exceeds 10% of free caja', async () => {
    const { token, contract, owner, user, extra, tokenAddr } = await deployHarness();
    await seedPool(token, contract, owner, '1000');
    await registerAndFund(token, contract, user, '200');
    await registerAndFund(token, contract, extra, '200');
    await proposeAndExecute(contract, owner, 'setNivel', [
      1,
      ethers.parseUnits('80', 18),
      7 * 24 * 60 * 60,
      10000,
    ]);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 0);
    expect(await contract.originatedPrincipalInWindow()).to.equal(ethers.parseUnits('80', 18));
    await expect(contract.connect(extra).solicitarPrestamo(tokenAddr, 0)).to.be.reverted;
  });

  it('lets small loans through after a whale fills the large 10%', async () => {
    const { token, contract, owner, user, extra, third, tokenAddr } = await deployHarness();
    await seedPool(token, contract, owner, '1000');
    await registerAndFund(token, contract, user, '200');
    await registerAndFund(token, contract, extra, '80');
    await registerAndFund(token, contract, third, '200');
    await contract.forceNivel(user.address, 8);
    await contract.forceNivel(third.address, 8);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 8);
    expect(await contract.originatedPrincipalInWindow()).to.equal(ethers.parseUnits('60', 18));
    await expect(contract.connect(extra).solicitarPrestamo(tokenAddr, 0)).to.not.be.reverted;
    expect(await contract.originatedChicoInWindow()).to.equal(ethers.parseUnits('1', 18));
    expect(await contract.originatedPrincipalInWindow()).to.equal(ethers.parseUnits('60', 18));
    await expect(contract.connect(third).solicitarPrestamo(tokenAddr, 8)).to.be.reverted;
  });

  it('caps the small lane at max(50, 10% of caja)', async () => {
    const { token, contract, owner, user, extra, third, tokenAddr } = await deployHarness();
    await seedPool(token, contract, owner, '1200');
    await registerAndFund(token, contract, user, '80');
    await registerAndFund(token, contract, extra, '80');
    await registerAndFund(token, contract, third, '80');
    await contract.forceNivel(user.address, 7);
    await contract.forceNivel(extra.address, 7);
    await contract.forceNivel(third.address, 7);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 7);
    await expect(contract.connect(extra).solicitarPrestamo(tokenAddr, 7)).to.not.be.reverted;
    expect(await contract.originatedChicoInWindow()).to.equal(ethers.parseUnits('100', 18));
    expect(await contract.originatedPrincipalInWindow()).to.equal(0n);
    await expect(contract.connect(third).solicitarPrestamo(tokenAddr, 7)).to.be.reverted;
  });

  it('treats 80 USDT as small when 0.5% of caja is 100', async () => {
    const { token, contract, owner, user, extra, tokenAddr } = await deployHarness();
    await token.mint(owner.address, ethers.parseUnits('20000', 18));
    await seedPool(token, contract, owner, '20000');
    await registerAndFund(token, contract, user, '200');
    await registerAndFund(token, contract, extra, '200');
    await proposeAndExecute(contract, owner, 'setNivel', [
      1,
      ethers.parseUnits('80', 18),
      7 * 24 * 60 * 60,
      10000,
    ]);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 0);
    await expect(contract.connect(extra).solicitarPrestamo(tokenAddr, 0)).to.not.be.reverted;
    expect(await contract.originatedChicoInWindow()).to.equal(ethers.parseUnits('160', 18));
    expect(await contract.originatedPrincipalInWindow()).to.equal(0n);
  });

  it('rejects a large loan when 10% of a small pool is not enough', async () => {
    const { token, contract, owner, user, extra, tokenAddr } = await deployHarness();
    await seedPool(token, contract, owner, '200');
    await registerAndFund(token, contract, user, '80');
    await registerAndFund(token, contract, extra, '80');
    await contract.forceNivel(user.address, 8);
    await expect(contract.connect(user).solicitarPrestamo(tokenAddr, 8)).to.be.reverted;
    await expect(contract.connect(extra).solicitarPrestamo(tokenAddr, 0)).to.not.be.reverted;
  });

  it('resets both lanes after one day', async () => {
    const { token, contract, owner, user, extra, tokenAddr } = await deployHarness();
    await seedPool(token, contract, owner, '1000');
    await registerAndFund(token, contract, user, '200');
    await registerAndFund(token, contract, extra, '200');
    await contract.forceNivel(user.address, 8);
    await contract.forceNivel(extra.address, 8);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 8);
    await expect(contract.connect(extra).solicitarPrestamo(tokenAddr, 8)).to.be.reverted;
    await ethers.provider.send('evm_increaseTime', [24 * 60 * 60 + 1]);
    await ethers.provider.send('evm_mine');
    await expect(contract.connect(extra).solicitarPrestamo(tokenAddr, 8)).to.not.be.reverted;
    expect(await contract.originatedPrincipalInWindow()).to.equal(ethers.parseUnits('60', 18));
    expect(await contract.originationsInWindow()).to.equal(1n);
  });

  it('honours the count brake when set to 1', async () => {
    const { token, contract, owner, user, extra, tokenAddr } = await deployHarness();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user);
    await registerAndFund(token, contract, extra);
    await proposeAndExecute(contract, owner, 'setSecurityParams', [1, 8000]);
    expect(await contract.maxOriginationsPerWindow()).to.equal(1n);
    expect(await contract.humanosVerificados(extra.address)).to.equal(true);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 0);
    await expect(contract.connect(extra).solicitarPrestamo(tokenAddr, 0)).to.be.reverted;
    expect(await contract.originationsInWindow()).to.equal(1n);
    await ethers.provider.send('evm_increaseTime', [24 * 60 * 60 + 1]);
    await ethers.provider.send('evm_mine');
    await expect(contract.connect(extra).solicitarPrestamo(tokenAddr, 0)).to.not.be.reverted;
  });
});
