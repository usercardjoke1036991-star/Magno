const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  deployProtocol,
  seedPool,
  registerAndFund,
  assertNavInvariant,
  expectAmt,
  drainToken,
} = require('./helpers.cjs');

describe('QuatriviumFamaCaja - fama de caja y canje', function () {
  it('exposes the agreed fame and redeem rates', async () => {
    const { contract, fama } = await deployProtocol();
    expect(await contract.BONO_ACTIVACION()).to.equal(ethers.parseUnits('1', 18));
    expect(await fama.FAMA_POR_USDT()).to.equal(100n);
    expect(await fama.FAMA_POR_REFERIDO_L1()).to.equal(100n);
    expect(await fama.FAMA_CANJE_POR_USDT()).to.equal(250n);
    expect(await contract.famaHermano()).to.equal(await fama.getAddress());
  });

  it('does not walk fame up the line on signup', async () => {
    const { contract, fama, owner, extra: a, signers } = await deployProtocol();
    const b = signers[3];
    await contract.connect(a).registrarHumanoConPadre(ethers.ZeroAddress);
    await contract.connect(b).registrarHumanoConPadre(a.address);
    expect(await contract.reputacion(a.address)).to.equal(100n);
    expect(await contract.reputacion(b.address)).to.equal(100n);
    expect(await contract.reputacion(owner.address)).to.equal(100n);
    expect(await fama.famaCaja(a.address)).to.equal(0n);
    expect(await fama.famaCaja(b.address)).to.equal(0n);
  });

  it('credits 100 caja fame only to the direct padrino on the first paid L1', async () => {
    const { token, contract, fama, owner, extra: padre, tokenAddr, contractAddr, signers } =
      await deployProtocol();
    const hijo = signers[3];
    const abuelo = signers[4];
    await seedPool(token, contract, owner, '500');
    await contract.connect(abuelo).registrarHumanoConPadre(ethers.ZeroAddress);
    await contract.connect(padre).registrarHumanoConPadre(abuelo.address);
    await registerAndFund(token, contract, hijo, '20', padre.address);

    expect(await fama.famaCaja(padre.address)).to.equal(0n);
    await contract.connect(hijo).solicitarPrestamo(tokenAddr, 0);
    const debt = await contract.obtenerDeuda(hijo.address);
    await contract.connect(hijo).pagarPrestamo(tokenAddr, debt.total);

    expect(await fama.famaCaja(padre.address)).to.equal(100n);
    expect(await fama.famaCanjeada(padre.address)).to.equal(0n);
    expect(await fama.famaCaja(abuelo.address)).to.equal(0n);
    expect(await contract.reputacion(padre.address)).to.equal(200n);
    await assertNavInvariant(token, contract, tokenAddr, contractAddr);
  });

  it('lets any level redeem 250 available fame for 1 USDT from the pool', async () => {
    const { token, contract, fama, owner, user, tokenAddr, contractAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user, '20');

    const gift = ethers.parseUnits('3', 18);
    await contract.connect(user).donar(tokenAddr, gift);
    expect(await fama.famaCaja(user.address)).to.equal(300n);
    expect(await fama.famaCanjeada(user.address)).to.equal(0n);

    const beforeBal = await token.balanceOf(user.address);
    const liqBefore = await contract.totalLiquidity(tokenAddr);
    await expect(fama.connect(user).canjearFama(250n))
      .to.emit(fama, 'FamaCanjeada')
      .withArgs(user.address, 250n, ethers.parseUnits('1', 18), tokenAddr);

    expect(await fama.famaCaja(user.address)).to.equal(300n);
    expect(await fama.famaCanjeada(user.address)).to.equal(250n);
    expect(await fama.famaDisponible(user.address)).to.equal(50n);
    expectAmt((await token.balanceOf(user.address)) - beforeBal, ethers.parseUnits('1', 18));
    expectAmt(liqBefore - (await contract.totalLiquidity(tokenAddr)), ethers.parseUnits('1', 18));
    await assertNavInvariant(token, contract, tokenAddr, contractAddr);
  });

  it('rejects a redeem that is not a multiple of 250 or bigger than available fame', async () => {
    const { token, contract, fama, owner, user, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user, '20');
    await contract.connect(user).donar(tokenAddr, ethers.parseUnits('3', 18));
    await expect(fama.connect(user).canjearFama(100n)).to.be.reverted;
    await expect(fama.connect(user).canjearFama(500n)).to.be.reverted;
  });

  it('keeps the 20% cash floor on fame redeem', async () => {
    const { token, contract, fama, owner, user, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '1');
    await registerAndFund(token, contract, user, '20');
    await contract.connect(user).donar(tokenAddr, ethers.parseUnits('3', 18));
    await expect(fama.connect(user).canjearFama(250n)).to.be.reverted;
  });

  it('rejects founder self-donate so fame cannot be printed against the pool', async () => {
    const { token, contract, owner, tokenAddr, contractAddr } = await deployProtocol();
    await token.mint(owner.address, ethers.parseUnits('5', 18));
    await token.connect(owner).approve(contractAddr, ethers.MaxUint256);
    await expect(contract.connect(owner).donar(tokenAddr, ethers.parseUnits('5', 18))).to.be.reverted;
  });

  it('rejects pagarCanje from anyone but the fame sibling', async () => {
    const { contract, user, tokenAddr } = await deployProtocol();
    await expect(
      contract.connect(user).pagarCanje(tokenAddr, user.address, ethers.parseUnits('1', 18))
    ).to.be.reverted;
  });

  it('blocks redeem while the loan is overdue or in mora', async () => {
    const { token, contract, fama, owner, extra, user, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user, '20');
    await contract.connect(user).donar(tokenAddr, ethers.parseUnits('3', 18));
    await contract.connect(user).solicitarPrestamo(tokenAddr, 0);
    const info = await contract.usuarios(user.address);
    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(info.vencimiento) + 10]);
    await ethers.provider.send('evm_mine');
    await expect(fama.connect(user).canjearFama(250n)).to.be.reverted;

    await drainToken(token, user, extra);
    await contract.marcarMorosoSiVencido(user.address);
    expect(await contract.esMoroso(user.address)).to.equal(true);
    await expect(fama.connect(user).canjearFama(250n)).to.be.reverted;
  });
});
