const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployProtocol, seedPool, registerAndFund, signAttest } = require('./helpers.cjs');

describe('QuatriviumCredit - no destroy account', function () {
  it('does not expose destruirCuenta so phone and device stay bound', async () => {
    const { token, contract, owner, user, extra, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user);
    expect(contract.interface.hasFunction('destruirCuenta')).to.equal(false);
    expect(contract.interface.hasFunction('cuentaDestruida')).to.equal(false);

    const phoneHash = await contract.phoneHashOf(user.address);
    const deviceHash = await contract.deviceHashOf(user.address);
    expect(phoneHash).to.not.equal(ethers.ZeroHash);

    await contract.connect(extra).registrarHumanoConPadre(ethers.ZeroAddress);
    const latest = await ethers.provider.getBlock('latest');
    const deadline = BigInt((latest?.timestamp || 0) + 3600);
    const parsed = await signAttest(contract, owner, extra.address, phoneHash, deviceHash, deadline);
    await expect(
      contract.connect(extra).vincularIdentidad(phoneHash, deviceHash, deadline, parsed.v, parsed.r, parsed.s)
    ).to.be.reverted;
    expect(await contract.walletOfPhone(phoneHash)).to.equal(user.address);
    expect(await token.balanceOf(user.address)).to.be.gt(0n);
    expect(tokenAddr).to.be.a('string');
  });
});
