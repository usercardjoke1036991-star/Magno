const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployProtocol, seedPool, registerAndFund } = require('./helpers.cjs');

describe('QuatriviumCredit - Morosity', function () {
  it('does not stack reputation penalties if marcarMorosoSiVencido is called twice', async () => {
    const { token, contract, owner, user, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 0);

    const info = await contract.usuarios(user.address);
    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(info.vencimiento) + 10]);
    await ethers.provider.send('evm_mine');

    await contract.marcarMorosoSiVencido(user.address);
    expect(await contract.prestamosMorosos(user.address)).to.equal(1n);
    expect(await contract.esMoroso(user.address)).to.equal(true);

    await contract.marcarMorosoSiVencido(user.address);
    expect(await contract.prestamosMorosos(user.address)).to.equal(1n);
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
