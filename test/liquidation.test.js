const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Magnocredi - Liquidation', function () {
  let Token, Aggregator, Magnocredi, token, feed, contract, owner, user, liquidator;

  beforeEach(async () => {
    [owner, user, liquidator] = await ethers.getSigners();
    Token = await ethers.getContractFactory('ERC20Mock');
    Aggregator = await ethers.getContractFactory('MockV3Aggregator');
    Magnocredi = await ethers.getContractFactory('Magnocredi');

    token = await Token.deploy();
    await token.deployed();

    feed = await Aggregator.deploy(8, 100000000); // 1.00
    await feed.deployed();

    // deploy contract
    contract = await Magnocredi.deploy(token.address, owner.address, 500);
    await contract.deployed();

    // register feed
    await contract.connect(owner).setPriceFeed(token.address, feed.address);

    // mint and deposit liquidity (provider = owner)
    await token.mint(owner.address, ethers.utils.parseUnits('1000', 18));
    await token.connect(owner).approve(contract.address, ethers.utils.parseUnits('1000', 18));
    await contract.connect(owner).depositarLiquidez(token.address, ethers.utils.parseUnits('500', 18));

    // register user and request loan
    await contract.connect(user).registrarHumanoZK(user.address);
    await contract.connect(user).solicitarPrestamo(token.address);
  });

  it('allows third-party liquidation after default and rewards liquidator', async () => {
    // get user's loan amount
    const userInfo = await contract.usuarios(user.address);
    const principal = userInfo.montoActivo;

    // increase time beyond vencimiento
    const venc = userInfo.vencimiento.toNumber();
    await ethers.provider.send('evm_setNextBlockTimestamp', [venc + 10]);
    await ethers.provider.send('evm_mine');

    // mint to liquidator and approve
    await token.mint(liquidator.address, principal.mul(2));
    await token.connect(liquidator).approve(contract.address, principal.mul(2));

    // perform liquidation
    await expect(contract.connect(liquidator).liquidate(user.address, token.address)).to.not.be.reverted;

    const postInfo = await contract.usuarios(user.address);
    expect(postInfo.montoActivo).to.equal(0);
  });
});
