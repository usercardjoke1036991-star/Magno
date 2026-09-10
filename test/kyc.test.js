const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployProtocol, seedPool, attestIdentity } = require('./helpers.cjs');

describe('QuatriviumCredit - KYC declaration', function () {
  it('blocks borrowing until the user declares KYC and binds a phone', async () => {
    const { token, contract, user, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, (await ethers.getSigners())[0], '500');
    await contract.connect(user).registrarHumanoConPadre(ethers.ZeroAddress);
    await token.mint(user.address, ethers.parseUnits('50', 18));
    await token.connect(user).approve(await contract.getAddress(), ethers.MaxUint256);

    await expect(contract.connect(user).solicitarPrestamo(tokenAddr, 0)).to.be.reverted;
    await contract.connect(user).declararKyc();
    expect(await contract.kycDeclarado(user.address)).to.equal(true);
    await expect(contract.connect(user).solicitarPrestamo(tokenAddr, 0)).to.be.reverted;
    await attestIdentity(contract, user);
    await expect(contract.connect(user).solicitarPrestamo(tokenAddr, 0)).to.not.be.reverted;
  });

  it('requires the founder to declare KYC and bind a phone like everyone else', async () => {
    const { token, contract, owner, extra, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await expect(contract.connect(owner).solicitarPrestamo(tokenAddr, 0)).to.be.reverted;
    await contract.connect(owner).declararKyc();
    await attestIdentity(contract, owner, 'founder-phone', 'founder-device');
    await expect(contract.connect(owner).solicitarPrestamo(tokenAddr, 0)).to.not.be.reverted;

    await contract.connect(extra).registrarHumanoConPadre(ethers.ZeroAddress);
    await token.mint(extra.address, ethers.parseUnits('50', 18));
    await token.connect(extra).approve(await contract.getAddress(), ethers.MaxUint256);
    await expect(contract.connect(extra).solicitarPrestamo(tokenAddr, 0)).to.be.reverted;
  });

  it('still requires registration before declaring KYC', async () => {
    const { contract, user } = await deployProtocol();
    await expect(contract.connect(user).declararKyc()).to.be.reverted;
  });
});
