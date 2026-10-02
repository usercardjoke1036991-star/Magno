/** One-shot: print addresses only, never keys. */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

function loadEnv(filePath) {
  const map = {};
  if (!fs.existsSync(filePath)) return map;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[line.slice(0, i).trim()] = value;
  }
  return map;
}

function addrFromKey(raw) {
  const hex = String(raw || '').replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return '';
  return new ethers.Wallet('0x' + hex).address;
}

async function main() {
  const root = path.join(__dirname, '..');
  const local = loadEnv(path.join(root, '.env'));
  const worker = loadEnv(path.join(root, '.env.worker'));
  const founder = '0x5023bf46dB7458B9bb9152a7ffE64f195CD1a047';
  const wanted = '0x55D3fA9F946d251423293c455Ec82a7D129d387E';
  const owner = addrFromKey(local.PRIVATE_KEY);
  const attester = addrFromKey(worker.ATTESTER_PRIVATE_KEY || local.ATTESTER_PRIVATE_KEY);
  console.log('local owner', owner || '(no key)');
  console.log('local attester', attester || '(no key)');
  console.log('owner==founder', Boolean(owner) && owner.toLowerCase() === founder.toLowerCase());
  console.log('attester==0x55D3', Boolean(attester) && attester.toLowerCase() === wanted.toLowerCase());
  console.log('attester!=owner', Boolean(attester && owner) && attester.toLowerCase() !== owner.toLowerCase());

  const demo = process.env.EXPO_PUBLIC_CONTRACT_ADDRESS_TESTNET || '0xD2d2A9eF0D1e4f253abc90Dd4ACb0E6C50B2de9f';
  const rpc = process.env.BSC_TESTNET_RPC_URL || process.env.EXPO_PUBLIC_BSC_RPC_URL_PRIMARY;
  const provider = new ethers.JsonRpcProvider(rpc);
  const credit = new ethers.Contract(
    demo,
    ['function owner() view returns (address)', 'function attester() view returns (address)'],
    provider
  );
  const [liveOwner, liveAttester] = await Promise.all([credit.owner(), credit.attester()]);
  console.log('live Demo', demo);
  console.log('live owner', liveOwner);
  console.log('live attester', liveAttester);
  console.log('live attester==owner', String(liveOwner).toLowerCase() === String(liveAttester).toLowerCase());
  console.log('live attester==0x55D3', String(liveAttester).toLowerCase() === wanted.toLowerCase());
}

main().catch((err) => {
  console.log('live read fail', err.shortMessage || err.message);
  process.exitCode = 1;
});
