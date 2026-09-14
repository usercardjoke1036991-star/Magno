const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployProtocol, seedPool, attestIdentity, registerAndFund, proposeAndExecute } = require('./helpers.cjs');

describe('QuatriviumCredit - identity binding', function () {
  async function signAttest(contract, attester, wallet, phoneHash, deviceHash, deadline) {
    const contractAddr = await contract.getAddress();
    const network = await ethers.provider.getNetwork();
    const packed = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'bytes32', 'bytes32', 'uint256', 'uint256', 'address'],
        [wallet, phoneHash, deviceHash, deadline, network.chainId, contractAddr]
      )
    );
    const sig = await attester.signMessage(ethers.getBytes(packed));
    return ethers.Signature.from(sig);
  }

  it('blocks borrowing until phone and device are attested', async () => {
    const { token, contract, owner, user, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await contract.connect(user).registrarHumanoConPadre(ethers.ZeroAddress);
    await contract.connect(user).declararKyc();
    await token.mint(user.address, ethers.parseUnits('50', 18));
    await token.connect(user).approve(await contract.getAddress(), ethers.MaxUint256);

    await expect(contract.connect(user).solicitarPrestamo(tokenAddr, 0)).to.be.reverted;
    await attestIdentity(contract, user);
    await expect(contract.connect(user).solicitarPrestamo(tokenAddr, 0)).to.not.be.reverted;
  });

  it('rejects a second wallet that reuses the same phone or device hash', async () => {
    const { token, contract, owner, user, extra, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user);

    const phoneHash = await contract.phoneHashOf(user.address);
    const deviceHash = await contract.deviceHashOf(user.address);
    const latest = await ethers.provider.getBlock('latest');
    const deadline = BigInt((latest?.timestamp || 0) + 3600);
    const sig = await signAttest(contract, owner, extra.address, phoneHash, deviceHash, deadline);

    await contract.connect(extra).registrarHumanoConPadre(ethers.ZeroAddress);
    await contract.connect(extra).declararKyc();
    await expect(
      contract.connect(extra).vincularIdentidad(phoneHash, deviceHash, deadline, sig.v, sig.r, sig.s)
    ).to.be.reverted;
    expect(await contract.walletOfPhone(phoneHash)).to.equal(user.address);

    const otherPhone = ethers.keccak256(ethers.toUtf8Bytes(`${extra.address}:other-phone`));
    const deviceSig = await signAttest(contract, owner, extra.address, otherPhone, deviceHash, deadline);
    await expect(
      contract
        .connect(extra)
        .vincularIdentidad(otherPhone, deviceHash, deadline, deviceSig.v, deviceSig.r, deviceSig.s)
    ).to.be.reverted;
    expect(await contract.walletOfDevice(deviceHash)).to.equal(user.address);

    await expect(contract.connect(extra).solicitarPrestamo(tokenAddr, 0)).to.be.reverted;
  });

  it('rejects a signature meant for another wallet', async () => {
    const { contract, owner, user, extra } = await deployProtocol();
    await contract.connect(user).registrarHumanoConPadre(ethers.ZeroAddress);
    const phoneHash = ethers.keccak256(ethers.toUtf8Bytes('phone-a'));
    const deviceHash = ethers.keccak256(ethers.toUtf8Bytes('device-a'));
    const latest = await ethers.provider.getBlock('latest');
    const deadline = BigInt((latest?.timestamp || 0) + 3600);
    const sig = await signAttest(contract, owner, extra.address, phoneHash, deviceHash, deadline);
    await expect(
      contract.connect(user).vincularIdentidad(phoneHash, deviceHash, deadline, sig.v, sig.r, sig.s)
    ).to.be.reverted;
    expect(await contract.phoneHashOf(user.address)).to.equal(ethers.ZeroHash);
  });

  it('requires the founder to bind a phone before borrowing', async () => {
    const { token, contract, owner, extra, tokenAddr } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await expect(contract.connect(owner).solicitarPrestamo(tokenAddr, 0)).to.be.reverted;
    await contract.connect(owner).declararKyc();
    await attestIdentity(contract, owner, 'founder-phone', 'founder-device');
    await expect(contract.connect(owner).solicitarPrestamo(tokenAddr, 0)).to.not.be.reverted;

    await contract.connect(extra).registrarHumanoConPadre(ethers.ZeroAddress);
    await contract.connect(extra).declararKyc();
    await token.mint(extra.address, ethers.parseUnits('50', 18));
    await token.connect(extra).approve(await contract.getAddress(), ethers.MaxUint256);
    await expect(contract.connect(extra).solicitarPrestamo(tokenAddr, 0)).to.be.reverted;
  });

  it('rejects an instant attester change and requires the 72h timelock', async () => {
    const { contract, owner, extra } = await deployProtocol();
    await expect(contract.connect(owner).setAttester(extra.address)).to.be.reverted;
    await proposeAndExecute(contract, owner, 'setAttester', [extra.address]);
    expect(await contract.attester()).to.equal(extra.address);
  });

  it('lets the same wallet replace its phone and frees the old hash', async () => {
    const { contract, user, extra } = await deployProtocol();
    await contract.connect(user).registrarHumanoConPadre(ethers.ZeroAddress);
    await attestIdentity(contract, user, 'phone-one', 'device-one');
    const oldPhone = await contract.phoneHashOf(user.address);
    const oldDevice = await contract.deviceHashOf(user.address);
    await attestIdentity(contract, user, 'phone-two', 'device-one');
    const nextPhone = await contract.phoneHashOf(user.address);
    expect(nextPhone).to.not.equal(oldPhone);
    expect(await contract.walletOfPhone(oldPhone)).to.equal(ethers.ZeroAddress);
    expect(await contract.walletOfPhone(nextPhone)).to.equal(user.address);
    expect(await contract.walletOfDevice(oldDevice)).to.equal(user.address);

    await contract.connect(extra).registrarHumanoConPadre(ethers.ZeroAddress);
    const latest = await ethers.provider.getBlock('latest');
    const deadline = BigInt((latest?.timestamp || 0) + 3600);
    const [attester] = await ethers.getSigners();
    const extraDevice = ethers.keccak256(ethers.toUtf8Bytes(`${extra.address}:dev`));
    const packed = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'bytes32', 'bytes32', 'uint256', 'uint256', 'address'],
        [extra.address, oldPhone, extraDevice, deadline, (await ethers.provider.getNetwork()).chainId, await contract.getAddress()]
      )
    );
    const raw = await attester.signMessage(ethers.getBytes(packed));
    const sig = ethers.Signature.from(raw);
    await expect(contract.connect(extra).vincularIdentidad(oldPhone, extraDevice, deadline, sig.v, sig.r, sig.s)).to.not
      .be.reverted;
  });

  it('lets the same wallet move to a new device and frees the old hash', async () => {
    const { contract, user, extra } = await deployProtocol();
    await contract.connect(user).registrarHumanoConPadre(ethers.ZeroAddress);
    await attestIdentity(contract, user, 'phone-keep', 'device-old');
    const oldDevice = await contract.deviceHashOf(user.address);
    const phone = await contract.phoneHashOf(user.address);
    await attestIdentity(contract, user, 'phone-keep', 'device-new');
    const nextDevice = await contract.deviceHashOf(user.address);
    expect(nextDevice).to.not.equal(oldDevice);
    expect(await contract.walletOfDevice(oldDevice)).to.equal(ethers.ZeroAddress);
    expect(await contract.walletOfDevice(nextDevice)).to.equal(user.address);
    expect(await contract.walletOfPhone(phone)).to.equal(user.address);

    await contract.connect(extra).registrarHumanoConPadre(ethers.ZeroAddress);
    const latest = await ethers.provider.getBlock('latest');
    const deadline = BigInt((latest?.timestamp || 0) + 3600);
    const extraPhone = ethers.keccak256(ethers.toUtf8Bytes(`${extra.address}:phone`));
    const [attester] = await ethers.getSigners();
    const packed = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'bytes32', 'bytes32', 'uint256', 'uint256', 'address'],
        [
          extra.address,
          extraPhone,
          oldDevice,
          deadline,
          (await ethers.provider.getNetwork()).chainId,
          await contract.getAddress(),
        ]
      )
    );
    const raw = await attester.signMessage(ethers.getBytes(packed));
    const sig = ethers.Signature.from(raw);
    await expect(
      contract.connect(extra).vincularIdentidad(extraPhone, oldDevice, deadline, sig.v, sig.r, sig.s)
    ).to.not.be.reverted;
  });
});
