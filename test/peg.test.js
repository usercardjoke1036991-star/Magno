const { expect } = require('chai');
const { deployProtocol, seedPool, registerAndFund } = require('./helpers.cjs');

describe('QuatriviumCredit - Peg protection', function () {
  it('reverts loan request when peg is below threshold', async () => {
    const { token, contract, owner, user, tokenAddr, feed } = await deployProtocol();
    await seedPool(token, contract, owner, '500');
    await registerAndFund(token, contract, user);
    await feed.updateAnswer(97_000_000);
    await expect(contract.connect(user).solicitarPrestamo(tokenAddr, 0)).to.be.reverted;
  });
});
