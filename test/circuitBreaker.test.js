const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Magnocredi - Circuit Breaker', function () {
  let Token, Magnocredi, token, contract, owner;

  beforeEach(async () => {
    [owner] = await ethers.getSigners();
    Token = await ethers.getContractFactory('ERC20Mock');
    Magnocredi = await ethers.getContractFactory('Magnocredi');

    token = await Token.deploy();
    await token.deployed();

    contract = await Magnocredi.deploy(token.address, owner.address, 500);
    await contract.deployed();

    // deposit liquidity
    await token.mint(owner.address, ethers.utils.parseUnits('1000', 18));
    await token.connect(owner).approve(contract.address, ethers.utils.parseUnits('1000', 18));
    await contract.connect(owner).depositarLiquidez(token.address, ethers.utils.parseUnits('1000', 18));
  });

  it('activates circuit breaker on large withdrawals', async () => {
    // withdraw more than 50% in one window
    await contract.connect(owner).retirarLiquidez(token.address, ethers.utils.parseUnits('600', 18));

    // subsequent operations should be paused
    await expect(contract.connect(owner).solicitarPrestamo(token.address)).to.be.revertedWith('Pausable: paused');
  });
});
