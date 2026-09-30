const { expect } = require('chai');
const { ethers } = require('hardhat');

const LOCK = 30 * 24 * 60 * 60;

async function deployReserva() {
  const [owner, user, extra, founder] = await ethers.getSigners();
  const Token = await ethers.getContractFactory('ERC20Mock');
  const Mock = await ethers.getContractFactory('CreditViewMock');
  const Reserva = await ethers.getContractFactory('QuatriviumReserva');
  const token = await Token.deploy();
  const credit = await Mock.deploy();
  const reserva = await Reserva.deploy(await token.getAddress(), founder.address, await credit.getAddress());
  await token.mint(user.address, ethers.parseUnits('1000', 18));
  await token.mint(founder.address, ethers.parseUnits('1000', 18));
  await token.connect(user).approve(await reserva.getAddress(), ethers.MaxUint256);
  await token.connect(founder).approve(await reserva.getAddress(), ethers.MaxUint256);
  await credit.setNivel(user.address, 10);
  await credit.setAdmin(founder.address, true);
  return { token, credit, reserva, owner, user, extra, founder };
}

describe('QuatriviumReserva', function () {
  it('returns principal after 30 days even if the reward pot is empty', async () => {
    const { token, reserva, user } = await deployReserva();
    const amount = ethers.parseUnits('100', 18);
    await reserva.connect(user).bloquear(amount);
    await expect(reserva.connect(user).desbloquear()).to.be.reverted;
    await ethers.provider.send('evm_increaseTime', [LOCK]);
    await ethers.provider.send('evm_mine');
    await reserva.connect(user).desbloquear();
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseUnits('1000', 18));
    const pos = await reserva.posiciones(user.address);
    expect(pos.activa).to.equal(false);
  });

  it('caps yield at 12% APY for the lock and pays the founder from that yield', async () => {
    const { token, reserva, user, founder } = await deployReserva();
    const amount = ethers.parseUnits('100', 18);
    await reserva.connect(founder).aportarBote(ethers.parseUnits('50', 18));
    await reserva.connect(user).bloquear(amount);
    await ethers.provider.send('evm_increaseTime', [LOCK]);
    await ethers.provider.send('evm_mine');
    const techo = await reserva.techoRendimiento(amount, LOCK);
    const t = await reserva.tramo(amount);
    const founderBp = await reserva.corteFundadorBp(t);
    const founderBefore = await token.balanceOf(founder.address);
    await reserva.connect(user).desbloquear();
    const founderCut = (techo * founderBp) / 10000n;
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseUnits('1000', 18) + techo - founderCut);
    expect((await token.balanceOf(founder.address)) - founderBefore).to.equal(founderCut);
    expect(techo).to.be.lt(ethers.parseUnits('1.1', 18));
  });

  it('pays a network boost from the same pot when the user has an upline', async () => {
    const { token, reserva, credit, user, extra, founder } = await deployReserva();
    await credit.setPadre(user.address, extra.address);
    await reserva.connect(founder).aportarBote(ethers.parseUnits('50', 18));
    const amount = ethers.parseUnits('100', 18);
    await reserva.connect(user).bloquear(amount);
    const pos = await reserva.posiciones(user.address);
    expect(pos.enRed).to.equal(true);
    await ethers.provider.send('evm_increaseTime', [LOCK]);
    await ethers.provider.send('evm_mine');
    const techo = await reserva.techoRendimiento(amount, LOCK);
    await reserva.connect(user).desbloquear();
    expect(await token.balanceOf(user.address)).to.be.lte(ethers.parseUnits('1000', 18) + techo);
    expect(await token.balanceOf(user.address)).to.be.gt(ethers.parseUnits('1000', 18));
  });

  it('rejects a second lock and a delinquent wallet', async () => {
    const { reserva, credit, user } = await deployReserva();
    const amount = ethers.parseUnits('10', 18);
    await reserva.connect(user).bloquear(amount);
    await expect(reserva.connect(user).bloquear(amount)).to.be.revertedWithCustomError(reserva, 'PeriodoActivo');
    await ethers.provider.send('evm_increaseTime', [LOCK]);
    await ethers.provider.send('evm_mine');
    await reserva.connect(user).desbloquear();
    await credit.setMora(user.address, true);
    await expect(reserva.connect(user).bloquear(amount)).to.be.revertedWithCustomError(reserva, 'EnMora');
  });

  it('lets a delinquent wallet unlock but not renew', async () => {
    const { token, reserva, credit, user } = await deployReserva();
    const amount = ethers.parseUnits('10', 18);
    await reserva.connect(user).bloquear(amount);
    await credit.setMora(user.address, true);
    await ethers.provider.send('evm_increaseTime', [LOCK]);
    await ethers.provider.send('evm_mine');
    await expect(reserva.connect(user).renovar()).to.be.revertedWithCustomError(reserva, 'EnMora');
    await reserva.connect(user).desbloquear();
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseUnits('1000', 18));
  });

  it('rejects a new lock while Credit is paused', async () => {
    const { reserva, credit, user } = await deployReserva();
    await credit.setPaused(true);
    await expect(reserva.connect(user).bloquear(ethers.parseUnits('10', 18))).to.be.revertedWithCustomError(
      reserva,
      'CreditoPausado'
    );
  });

  it('lets a user unlock after Reserva is paused', async () => {
    const { token, reserva, user, owner } = await deployReserva();
    const amount = ethers.parseUnits('10', 18);
    await reserva.connect(user).bloquear(amount);
    await reserva.connect(owner).pausar();
    await ethers.provider.send('evm_increaseTime', [LOCK]);
    await ethers.provider.send('evm_mine');
    await reserva.connect(user).desbloquear();
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseUnits('1000', 18));
    await expect(reserva.connect(user).bloquear(amount)).to.be.reverted;
  });

  it('rejects setCredit(0) and syncs pause from Credit', async () => {
    const { reserva, credit, owner, extra } = await deployReserva();
    await expect(reserva.connect(owner).setCredit(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      reserva,
      'DestinoCero'
    );
    await expect(reserva.connect(extra).syncPauseFromCredit()).to.be.revertedWithCustomError(
      reserva,
      'CreditNoPausado'
    );
    await credit.setPaused(true);
    await reserva.connect(extra).syncPauseFromCredit();
    expect(await reserva.paused()).to.equal(true);
  });

  it('keeps contract cash equal to locked principal plus the pot', async () => {
    const { token, reserva, user, founder } = await deployReserva();
    const locked = ethers.parseUnits('40', 18);
    const pot = ethers.parseUnits('15', 18);
    await reserva.connect(founder).aportarBote(pot);
    await reserva.connect(user).bloquear(locked);
    expect(await token.balanceOf(await reserva.getAddress())).to.equal(locked + pot);
  });

  it('pays a commission extra from the pot and the founder takes their cut', async () => {
    const { token, credit, reserva, user, founder } = await deployReserva();
    const [, , , , attester] = await ethers.getSigners();
    await credit.setAttester(attester.address);
    const locked = ethers.parseUnits('100', 18);
    await reserva.connect(founder).aportarBote(ethers.parseUnits('20', 18));
    await reserva.connect(user).bloquear(locked);
    const commission = ethers.parseUnits('5', 18);
    const id = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [1n]));
    const [extra, founderCut] = await reserva.extraComisionDe(user.address, commission);
    expect(extra).to.equal(ethers.parseUnits('0.5', 18));
    const userBefore = await token.balanceOf(user.address);
    const founderBefore = await token.balanceOf(founder.address);
    await expect(reserva.connect(attester).pagarBoostComision(user.address, commission, id))
      .to.emit(reserva, 'BoostComision')
      .withArgs(user.address, commission, extra, founderCut);
    expect((await token.balanceOf(user.address)) - userBefore).to.equal(extra - founderCut);
    expect((await token.balanceOf(founder.address)) - founderBefore).to.equal(founderCut);
    await expect(reserva.connect(attester).pagarBoostComision(user.address, commission, id)).to.be.revertedWithCustomError(
      reserva,
      'YaPagado'
    );
  });

  it('rejects commission boosts below the 50 USDT tier and from a stranger', async () => {
    const { reserva, credit, user, extra, founder } = await deployReserva();
    const [, , , , attester] = await ethers.getSigners();
    await credit.setAttester(attester.address);
    await reserva.connect(founder).aportarBote(ethers.parseUnits('10', 18));
    await reserva.connect(user).bloquear(ethers.parseUnits('10', 18));
    const id = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [2n]));
    await expect(
      reserva.connect(attester).pagarBoostComision(user.address, ethers.parseUnits('5', 18), id)
    ).to.be.revertedWithCustomError(reserva, 'NadaQueMover');
    const locked = ethers.parseUnits('50', 18);
    await ethers.provider.send('evm_increaseTime', [LOCK]);
    await ethers.provider.send('evm_mine');
    await reserva.connect(user).desbloquear();
    await reserva.connect(user).bloquear(locked);
    const okId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [3n]));
    await expect(
      reserva.connect(extra).pagarBoostComision(user.address, ethers.parseUnits('5', 18), okId)
    ).to.be.revertedWithCustomError(reserva, 'NoAutorizado');
    const huge = ethers.parseUnits('1000000', 18);
    const [capped] = await reserva.extraComisionDe(user.address, huge);
    expect(capped).to.equal(ethers.parseUnits('5', 18));
  });

  it('rejects a lock below level 10 and a pot fill from a stranger', async () => {
    const { reserva, credit, user, extra, founder } = await deployReserva();
    await credit.setNivel(user.address, 9);
    await expect(reserva.connect(user).bloquear(ethers.parseUnits('50', 18))).to.be.revertedWithCustomError(
      reserva,
      'NivelInsuficiente'
    );
    await expect(reserva.connect(extra).aportarBote(ethers.parseUnits('1', 18))).to.be.revertedWithCustomError(
      reserva,
      'SoloAdmin'
    );
    await reserva.connect(founder).aportarBote(ethers.parseUnits('1', 18));
    expect(await reserva.bote()).to.equal(ethers.parseUnits('1', 18));
  });

  it('rejects a commission boost from the owner and delays owner or credit changes 72h', async () => {
    const { reserva, credit, user, owner, extra, founder } = await deployReserva();
    await reserva.connect(founder).aportarBote(ethers.parseUnits('20', 18));
    await reserva.connect(user).bloquear(ethers.parseUnits('100', 18));
    const id = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [9n]));
    await expect(
      reserva.connect(owner).pagarBoostComision(user.address, ethers.parseUnits('5', 18), id)
    ).to.be.revertedWithCustomError(reserva, 'NoAutorizado');
    await reserva.connect(owner).setOwner(extra.address);
    await expect(reserva.connect(extra).acceptOwner()).to.be.revertedWithCustomError(reserva, 'EsperaTimelock');
    await ethers.provider.send('evm_increaseTime', [72 * 60 * 60]);
    await ethers.provider.send('evm_mine');
    await reserva.connect(extra).acceptOwner();
    expect(await reserva.owner()).to.equal(extra.address);
    const Mock = await ethers.getContractFactory('CreditViewMock');
    const nextCredit = await Mock.deploy();
    await reserva.connect(extra).setCredit(await nextCredit.getAddress());
    await expect(reserva.connect(extra).applyCredit()).to.be.revertedWithCustomError(reserva, 'EsperaTimelock');
    expect(await reserva.credit()).to.equal(await credit.getAddress());
    await reserva.connect(extra).setFundador(user.address);
    await expect(reserva.connect(extra).applyFundador()).to.be.revertedWithCustomError(reserva, 'EsperaTimelock');
    expect(await reserva.fundador()).to.equal(founder.address);
  });

  it('accepts a 1 USDT lock and applies 20 percent extra from 500 USDT', async () => {
    const { reserva, user, founder } = await deployReserva();
    await reserva.connect(founder).aportarBote(ethers.parseUnits('20', 18));
    await reserva.connect(user).bloquear(ethers.parseUnits('1', 18));
    const pos = await reserva.posiciones(user.address);
    expect(pos.activa).to.equal(true);
    expect(pos.principal).to.equal(ethers.parseUnits('1', 18));
    await expect(reserva.connect(user).bloquear(ethers.parseUnits('1', 18))).to.be.revertedWithCustomError(
      reserva,
      'PeriodoActivo'
    );
    await ethers.provider.send('evm_increaseTime', [LOCK]);
    await ethers.provider.send('evm_mine');
    await reserva.connect(user).desbloquear();
    await reserva.connect(user).bloquear(ethers.parseUnits('500', 18));
    const [extra] = await reserva.extraComisionDe(user.address, ethers.parseUnits('5', 18));
    expect(extra).to.equal(ethers.parseUnits('1', 18));
  });
});
