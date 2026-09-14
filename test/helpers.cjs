const { ethers } = require('hardhat');
const { getLinkedCreditFactory } = require('../scripts/linkCredit.cjs');

async function deployProtocol(opts = {}) {
  const pegAnswer = opts.pegAnswer ?? 100000000;
  const feeBp = opts.feeBp ?? 500;
  const signers = await ethers.getSigners();
  const owner = signers[0];
  const user = signers[1];
  const extra = signers[2];

  const Token = await ethers.getContractFactory('ERC20Mock');
  const Aggregator = await ethers.getContractFactory('MockV3Aggregator');
  const QuatriviumCredit = await getLinkedCreditFactory(ethers);

  const token = await Token.deploy();
  const feed = await Aggregator.deploy(8, pegAnswer);
  const tokenAddr = await token.getAddress();
  const feedAddr = await feed.getAddress();
  const admins = opts.admins || [owner.address];
  const confirms = opts.confirms ?? 1;

  const contract = await QuatriviumCredit.deploy(
    tokenAddr,
    feedAddr,
    owner.address,
    feeBp,
    admins,
    confirms
  );

  const contractAddr = await contract.getAddress();
  return { token, feed, contract, owner, user, extra, tokenAddr, feedAddr, contractAddr, signers };
}

async function seedPool(token, contract, owner, amount = '500') {
  const contractAddr = await contract.getAddress();
  const tokenAddr = await token.getAddress();
  await token.mint(owner.address, ethers.parseUnits('10000', 18));
  await token.connect(owner).approve(contractAddr, ethers.MaxUint256);
  await contract.connect(owner).depositarLiquidez(tokenAddr, ethers.parseUnits(amount, 18));
}

async function attestIdentity(contract, user, phoneSalt = 'phone', deviceSalt = 'device') {
  const [attester] = await ethers.getSigners();
  const phoneHash = ethers.keccak256(ethers.toUtf8Bytes(`${user.address}:${phoneSalt}`));
  const deviceHash = ethers.keccak256(ethers.toUtf8Bytes(`${user.address}:${deviceSalt}`));
  const latest = await ethers.provider.getBlock('latest');
  const deadline = BigInt((latest?.timestamp || 0) + 3600);
  const contractAddr = await contract.getAddress();
  const network = await ethers.provider.getNetwork();
  const packed = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'bytes32', 'bytes32', 'uint256', 'uint256', 'address'],
      [user.address, phoneHash, deviceHash, deadline, network.chainId, contractAddr]
    )
  );
  const sig = await attester.signMessage(ethers.getBytes(packed));
  const { v, r, s } = ethers.Signature.from(sig);
  await contract.connect(user).vincularIdentidad(phoneHash, deviceHash, deadline, v, r, s);
}

async function registerAndFund(token, contract, user, amount = '50', padre = ethers.ZeroAddress) {
  const contractAddr = await contract.getAddress();
  const tokenAddr = await token.getAddress();
  await contract.connect(user).registrarHumanoConPadre(padre);
  await contract.connect(user).declararKyc();
  await attestIdentity(contract, user);
  await token.mint(user.address, ethers.parseUnits(amount, 18));
  await token.connect(user).approve(contractAddr, ethers.MaxUint256);
}

async function proposeAndExecute(contract, signer, fragment, args = [], extraConfirmers = []) {
  const data = contract.interface.encodeFunctionData(fragment, args);
  const tx = await contract.connect(signer).proposeAdminAction(data);
  const receipt = await tx.wait();
  const parsed = receipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e) => e && e.name === 'AdminActionProposed');
  const id = parsed.args.id;
  for (const extra of extraConfirmers) {
    await contract.connect(extra).confirmAdminAction(id);
  }
  await ethers.provider.send('evm_increaseTime', [72 * 60 * 60]);
  await ethers.provider.send('evm_mine');
  await contract.connect(signer).executeAdminAction(id);
  return id;
}

async function drainToken(token, from, to) {
  const bal = await token.balanceOf(from.address);
  if (bal > 0n) {
    await token.connect(from).transfer(to.address, bal);
  }
}

async function assertNavInvariant(token, contract, tokenAddr, contractAddr) {
  const { expect } = require('chai');
  const cash = await token.balanceOf(contractAddr);
  const outstanding = await contract.outstandingLoans(tokenAddr);
  const liquidity = await contract.totalLiquidity(tokenAddr);
  const fees = await contract.collectedFees(tokenAddr);
  expect(cash + outstanding).to.equal(liquidity + fees);
}

module.exports = {
  deployProtocol,
  seedPool,
  attestIdentity,
  registerAndFund,
  proposeAndExecute,
  drainToken,
  assertNavInvariant,
};
