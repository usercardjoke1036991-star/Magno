/**
 * Enlaza QuatriviumFamaLib. El bytecode de la librería no cuenta para EIP-170.
 */
async function getLinkedCreditFactory(ethers, name = 'QuatriviumCredit') {
  const FamaLib = await ethers.getContractFactory('QuatriviumFamaLib');
  const famaLib = await FamaLib.deploy();
  await famaLib.waitForDeployment();
  const famaLibAddress = await famaLib.getAddress();
  const factory = await ethers.getContractFactory(name, {
    libraries: { QuatriviumFamaLib: famaLibAddress },
  });
  factory.famaLibAddress = famaLibAddress;
  return factory;
}

module.exports = { getLinkedCreditFactory };
