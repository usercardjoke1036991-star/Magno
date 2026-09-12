/**
 * QuatriviumFamaLib se despliega aparte y se enlaza por delegatecall.
 * El bytecode de la lib no cuenta para el tope EIP-170 del núcleo.
 */
async function getLinkedCreditFactory(ethers, name = 'QuatriviumCredit') {
  const FamaLib = await ethers.getContractFactory('QuatriviumFamaLib');
  const famaLib = await FamaLib.deploy();
  await famaLib.waitForDeployment();
  const famaLibAddress = await famaLib.getAddress();
  const factory = await ethers.getContractFactory(name, {
    libraries: {
      QuatriviumFamaLib: famaLibAddress,
    },
  });
  factory.famaLibAddress = famaLibAddress;
  return factory;
}

module.exports = { getLinkedCreditFactory };
