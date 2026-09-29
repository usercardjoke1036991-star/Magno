const fs = require('fs');
const crypto = require('crypto');
const { JsonRpcProvider } = require('ethers');

const ADDR = '0xD2d2A9eF0D1e4f253abc90Dd4ACb0E6C50B2de9f';
const PLACEHOLDER = '__$0737fa2facc6361908c92d3a9cd60dc46f$__';
const rpc =
  process.env.BSC_TESTNET_RPC_URL ||
  process.env.EXPO_PUBLIC_BSC_RPC_URL_PRIMARY ||
  'https://bsc-testnet.publicnode.com';

function sha256hex(hex) {
  return crypto.createHash('sha256').update(Buffer.from(hex.replace(/^0x/, ''), 'hex')).digest('hex');
}

(async () => {
  const art = JSON.parse(
    fs.readFileSync('artifacts/contracts/QuatriviumCredit.sol/QuatriviumCredit.json', 'utf8')
  );
  const raw = art.deployedBytecode.replace(/^0x/, '');
  const idx = raw.indexOf(PLACEHOLDER);
  if (idx < 0) {
    console.log('no placeholder in artifact');
    process.exit(1);
  }
  const before = raw.slice(0, idx);
  const after = raw.slice(idx + PLACEHOLDER.length);
  const p = new JsonRpcProvider(rpc, 97);
  const live = (await p.getCode(ADDR)).replace(/^0x/, '').toLowerCase();
  const needle = before.slice(-16).toLowerCase();
  const pos = live.indexOf(needle);
  console.log('placeholder index in artifact chars', idx, 'live needle pos', pos);
  if (pos < 0) {
    console.log('surrounding opcodes not found — source diverged');
    process.exit(2);
  }
  const libStart = pos + needle.length;
  const libAddr = '0x' + live.slice(libStart, libStart + 40);
  console.log('FamaLib on Demo', libAddr);
  const libCode = await p.getCode(libAddr);
  const libBytes = libCode.replace(/^0x/, '').length / 2;
  const libArt = JSON.parse(
    fs.readFileSync('artifacts/contracts/libraries/QuatriviumFamaLib.sol/QuatriviumFamaLib.json', 'utf8')
  );
  const libLocal = libArt.deployedBytecode.replace(/^0x/, '').toLowerCase();
  const libLive = libCode.replace(/^0x/, '').toLowerCase();
  function stripCbor(hex) {
    if (hex.length < 4) return hex;
    const metaLen = Number.parseInt(hex.slice(-4), 16);
    const cut = hex.length - 4 - metaLen * 2;
    if (cut > 0 && cut < hex.length) return hex.slice(0, cut);
    return hex;
  }
  const libLiveRt = stripCbor(libLive);
  const libLocalRt = stripCbor(libLocal);
  const marker = '307f';
  const idxPush = libLocalRt.indexOf(marker);
  const paddedAddr = libAddr.slice(2).toLowerCase().padStart(64, '0');
  const libPatched =
    idxPush >= 0
      ? libLocalRt.slice(0, idxPush + 4) + paddedAddr + libLocalRt.slice(idxPush + 4 + 64)
      : libLocalRt;
  console.log('FamaLib bytes live/local', libBytes, libLocal.length / 2);
  console.log('FamaLib opcodes match after embedding Demo address', libPatched === libLiveRt);

  const linked = (before + libAddr.slice(2) + after).toLowerCase();
  console.log('Credit bytes live/linked', live.length / 2, linked.length / 2);
  console.log('Credit sha live ', sha256hex(live));
  console.log('Credit sha linked', sha256hex(linked));
  console.log('EXACT', live === linked);
  if (live !== linked) {
    let diffs = 0;
    let first = -1;
    const n = Math.min(live.length, linked.length);
    for (let i = 0; i < n; i += 2) {
      if (live.slice(i, i + 2) !== linked.slice(i, i + 2)) {
        diffs += 1;
        if (first < 0) first = i / 2;
      }
    }
    console.log('byteDiffs', diffs, 'first', first, 'lenDelta', live.length - linked.length);
  }
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
