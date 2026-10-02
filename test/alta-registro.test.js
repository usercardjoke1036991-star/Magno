const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployProtocol, seedPool, registerAndFund } = require('./helpers.cjs');

async function deployAltaStack() {
  const { token, contract, fama, owner, user, extra, tokenAddr, contractAddr } = await deployProtocol();
  const Mock = await ethers.getContractFactory('CreditViewMock');
  const Reserva = await ethers.getContractFactory('QuatriviumReserva');
  const Alta = await ethers.getContractFactory('QuatriviumAlta');
  const vista = await Mock.deploy();
  const reserva = await Reserva.deploy(tokenAddr, owner.address, contractAddr, await fama.getAddress());
  const alta = await Alta.deploy(tokenAddr, contractAddr, await reserva.getAddress());
  await reserva.setAltaFuente(await alta.getAddress());
  await fama.connect(owner).setAlta(await alta.getAddress());
  await token.mint(user.address, ethers.parseUnits('20', 18));
  await token.connect(user).approve(await alta.getAddress(), ethers.MaxUint256);
  await token.connect(user).approve(contractAddr, ethers.MaxUint256);
  return { token, contract, fama, reserva, alta, owner, user, extra, tokenAddr, contractAddr };
}

describe('Alta 4 USDT', function () {
  it('parte 1 fundador, 1 Reserva, 1 sello y aparta 1 al padrino', async () => {
    const { token, contract, reserva, alta, owner, user, tokenAddr } = await deployAltaStack();
    await registerAndFund(token, contract, user, '20');
    const founderBefore = await token.balanceOf(owner.address);
    const boteBefore = await reserva.bote();
    await alta.connect(user).pagarRegistro();
    await contract.connect(user).pagarVerificacion(tokenAddr, ethers.parseUnits('1', 18));
    expect((await token.balanceOf(owner.address)) - founderBefore).to.equal(ethers.parseUnits('1', 18));
    expect((await reserva.bote()) - boteBefore).to.equal(ethers.parseUnits('1', 18));
    expect(await alta.padrinoApartado(user.address)).to.equal(ethers.parseUnits('1', 18));
    expect(await contract.reservaPrimera(user.address)).to.equal(ethers.parseUnits('1', 18));
  });

  it('al pagar el primer L1 suelta el 1 del padrino y no saca otro de la caja', async () => {
    const { token, contract, alta, owner, user, extra, tokenAddr } = await deployAltaStack();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, extra, '20');
    await registerAndFund(token, contract, user, '20', extra.address);
    await alta.connect(user).pagarRegistro();
    await contract.connect(user).pagarVerificacion(tokenAddr, ethers.parseUnits('1', 18));
    const liqBefore = await contract.totalLiquidity(tokenAddr);
    const padreBefore = await token.balanceOf(extra.address);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 0);
    const deuda = await contract.obtenerDeuda(user.address);
    await contract.connect(user).pagarPrestamo(tokenAddr, deuda[2]);
    expect(await alta.padrinoApartado(user.address)).to.equal(0n);
    expect((await token.balanceOf(extra.address)) - padreBefore).to.equal(ethers.parseUnits('1', 18));
    expect(await contract.totalLiquidity(tokenAddr)).to.be.gte(liqBefore - ethers.parseUnits('1', 18));
  });
});
