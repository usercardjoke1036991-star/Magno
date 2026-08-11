const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Magnocredi - Peg protection', function () {
  let Token, Aggregator, Magnocredi, token, feed, contract, owner, user;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    Token = await ethers.getContractFactory('ERC20Mock');
    Aggregator = await ethers.getContractFactory('MockV3Aggregator');
    Magnocredi = await ethers.getContractFactory('Magnocredi');

    token = await Token.deploy();
    await token.deployed();

    // price with 8 decimals: 0.97 USD -> 0.97 * 1e8
    feed = await Aggregator.deploy(8, 97000000);
    await feed.deployed();

    // mint some liquidity to owner so they can deposit
    await token.mint(owner.address, ethers.utils.parseUnits('1000', 18));
    await token.connect(owner).approve(Magnocredi.address, ethers.utils.parseUnits('1000', 18));

    // deploy Magnocredi with token as supported and feeCollector = owner
    contract = await Magnocredi.deploy(token.address, owner.address, 500);
    await contract.deployed();

    // register price feed
    await contract.connect(owner).setPriceFeed(token.address, feed.address);

    // deposit liquidity into pool
    await token.connect(owner).approve(contract.address, ethers.utils.parseUnits('1000', 18));
    await contract.connect(owner).depositarLiquidez(token.address, ethers.utils.parseUnits('500', 18));
  });

  it('reverts loan request when peg is below threshold', async () => {
    // ensure user is registered as human (must call self)
    await contract.connect(user).registrarHumanoZK(user.address);

    await expect(contract.connect(user).solicitarPrestamo(token.address)).to.be.revertedWith('peg lost');
  });
});
