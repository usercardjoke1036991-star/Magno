const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployProtocol, seedPool, registerAndFund, drainToken } = require('./helpers.cjs');

describe('QuatriviumCredit - Morosity', function () {
  it('does not stack reputation penalties if marcarMorosoSiVencido is called twice', async () => {
    const { token, contract, owner, user, extra, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 0);
    await drainToken(token, user, extra);

    const info = await contract.usuarios(user.address);
    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(info.vencimiento) + 10]);
    await ethers.provider.send('evm_mine');

    await contract.marcarMorosoSiVencido(user.address);
    expect(await contract.prestamosMorosos(user.address)).to.equal(1n);
    expect(await contract.esMoroso(user.address)).to.equal(true);
    expect(await contract.reputacion(user.address)).to.equal(100n);

    await contract.marcarMorosoSiVencido(user.address);
    expect(await contract.prestamosMorosos(user.address)).to.equal(1n);
  });

  it('debits the linked wallet on due date when it has allowance and cash', async () => {
    const { token, contract, owner, user, tokenAddr, contractAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 0);
    const before = await token.balanceOf(user.address);
    const info = await contract.usuarios(user.address);
    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(info.vencimiento) + 10]);
    await ethers.provider.send('evm_mine');

    await contract.marcarMorosoSiVencido(user.address);
    expect(await contract.usuarios(user.address).then((u) => u.montoActivo)).to.equal(0n);
    expect(await contract.esMoroso(user.address)).to.equal(false);
    expect(before - (await token.balanceOf(user.address))).to.equal(ethers.parseUnits('2', 18));
    const cash = await token.balanceOf(contractAddr);
    const outstanding = await contract.outstandingLoans(tokenAddr);
    const liquidity = await contract.totalLiquidity(tokenAddr);
    const fees = await contract.collectedFees(tokenAddr);
    expect(cash + outstanding).to.equal(liquidity + fees);
  });

  it('keeps earnings during the grace month then freezes them and burns 10 reputation per level per day', async () => {
    const { token, contract, owner, user, extra, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 0);
    await drainToken(token, user, extra);

    const info = await contract.usuarios(user.address);
    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(info.vencimiento) + 10]);
    await ethers.provider.send('evm_mine');
    await contract.marcarMorosoSiVencido(user.address);
    expect(await contract.dispersionCongelada(user.address)).to.equal(false);
    expect(await contract.reputacion(user.address)).to.equal(100n);

    await ethers.provider.send('evm_increaseTime', [30 * 24 * 3600 + 3 * 24 * 3600]);
    await ethers.provider.send('evm_mine');
    await contract.marcarMorosoSiVencido(user.address);
    expect(await contract.reputacion(user.address)).to.equal(70n);
    expect(await contract.esMoroso(user.address)).to.equal(true);
    expect(await contract.dispersionCongelada(user.address)).to.equal(true);
  });

  it('sends the delinquent referral cut to the pool after the grace month', async () => {
    const { token, contract, owner, user, extra: padre, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '2000');
    await registerAndFund(token, contract, padre);
    await registerAndFund(token, contract, user, '20', padre.address);
    await contract.connect(padre).solicitarPrestamo(tokenAddr, 0);
    await drainToken(token, padre, owner);

    const info = await contract.usuarios(padre.address);
    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(info.vencimiento) + 10]);
    await ethers.provider.send('evm_mine');
    await contract.marcarMorosoSiVencido(padre.address);
    await ethers.provider.send('evm_increaseTime', [31 * 24 * 3600]);
    await ethers.provider.send('evm_mine');
    await contract.marcarMorosoSiVencido(padre.address);
    expect(await contract.dispersionCongelada(padre.address)).to.equal(true);

    const padreBefore = await token.balanceOf(padre.address);
    const liqBefore = await contract.totalLiquidity(tokenAddr);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 0);
    const debt = await contract.obtenerDeuda(user.address);
    await contract.connect(user).pagarPrestamo(tokenAddr, debt.total);

    expect((await token.balanceOf(padre.address)) - padreBefore).to.equal(0n);
    expect((await contract.totalLiquidity(tokenAddr)) - liqBefore).to.be.gt(0n);
  });

  it('records delinquency when a late repayment is made without a prior keeper call', async () => {
    const { token, contract, owner, user, tokenAddr, contractAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 0);

    const info = await contract.usuarios(user.address);
    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(info.vencimiento) + 10]);
    await ethers.provider.send('evm_mine');

    const lateDebt = await contract.obtenerDeuda(user.address);
    await token.mint(user.address, lateDebt.total);
    await token.connect(user).approve(contractAddr, ethers.MaxUint256);
    await contract.connect(user).pagarPrestamo(tokenAddr, lateDebt.total);

    expect(await contract.prestamosMorosos(user.address)).to.equal(1n);
    expect((await contract.obtenerProgresoUsuario(user.address)).solicitudesCompletadas).to.equal(0n);
  });
});
