const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployProtocol, seedPool, registerAndFund, drainToken } = require('./helpers.cjs');

describe('QuatriviumCredit - destroy account', function () {
  it('blocks destroy while a loan is active and lets the founder keep the root', async () => {
    const { token, contract, owner, user, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 0);
    await expect(contract.connect(user).destruirCuenta(tokenAddr)).to.be.reverted;
    await expect(contract.connect(owner).destruirCuenta(tokenAddr)).to.be.reverted;
  });

  it('blocks destroy while the user is in mora (delinquent)', async () => {
    const { token, contract, owner, user, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user);
    await contract.connect(user).solicitarPrestamo(tokenAddr, 0);
    await drainToken(token, user, owner);
    // Avanzar tiempo hasta vencimiento para poder marcar mora
    await ethers.provider.send('evm_increaseTime', [8 * 24 * 3600]);
    await ethers.provider.send('evm_mine', []);
    await contract.marcarMorosoSiVencido(user.address);
    expect(await contract.esMoroso(user.address)).to.equal(true);
    // Con préstamo activo Y mora → ambas protecciones aplican
    await expect(contract.connect(user).destruirCuenta(tokenAddr)).to.be.reverted;
  });

  it('sends leftover tokens and LP to the pool, frees phone/device, and wipes progress', async () => {
    const { token, contract, owner, user, extra, tokenAddr, contractAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user);
    await token.mint(user.address, ethers.parseUnits('7', 18));
    await token.connect(user).approve(contractAddr, ethers.MaxUint256);

    const phoneHash = await contract.phoneHashOf(user.address);
    const deviceHash = await contract.deviceHashOf(user.address);
    const liqBefore = await contract.totalLiquidity(tokenAddr);

    await expect(contract.connect(user).destruirCuenta(tokenAddr)).to.not.be.reverted;

    expect(await contract.humanosVerificados(user.address)).to.equal(false);
    expect(await contract.cuentaDestruida(user.address)).to.equal(true);
    expect(await contract.phoneHashOf(user.address)).to.equal(ethers.ZeroHash);
    expect(await contract.walletOfPhone(phoneHash)).to.equal(ethers.ZeroAddress);
    expect(await contract.walletOfDevice(deviceHash)).to.equal(ethers.ZeroAddress);
    expect(await contract.totalLiquidity(tokenAddr)).to.be.gt(liqBefore);
    await expect(contract.connect(user).registrarHumanoConPadre(ethers.ZeroAddress)).to.be.reverted;

    await contract.connect(extra).registrarHumanoConPadre(ethers.ZeroAddress);
    await contract.connect(extra).declararKyc();
    const latest = await ethers.provider.getBlock('latest');
    const deadline = BigInt((latest?.timestamp || 0) + 3600);
    const network = await ethers.provider.getNetwork();
    const packed = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'bytes32', 'bytes32', 'uint256', 'uint256', 'address'],
        [extra.address, phoneHash, deviceHash, deadline, network.chainId, contractAddr]
      )
    );
    const sig = await owner.signMessage(ethers.getBytes(packed));
    const parsed = ethers.Signature.from(sig);
    await contract
      .connect(extra)
      .vincularIdentidad(phoneHash, deviceHash, deadline, parsed.v, parsed.r, parsed.s);
    expect(await contract.walletOfPhone(phoneHash)).to.equal(extra.address);
    expect(await contract.walletOfDevice(deviceHash)).to.equal(extra.address);
  });
});
