/** Canónico BSC para scripts Node (deploy, worker, production:check). */
const BSC_MAINNET = {
  chainId: 56,
  chainName: 'bsc',
  usdt: '0x55d398326f99059ff775485246999027b3197955',
  usdtUsdFeed: '0xb97ad0e75fa537bf4d14e83bc6b2faab978903a6',
  usdc: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
  usdcUsdFeed: '0x51597f405303c4377e36123cbc172b13269ea163',
  fdusd: '0xc5f0f7b66764f6ec8c8dff7ba683102295e16409',
  fdusdUsdFeed: '0x390180e80058a8499930f0c13963ad3e0d86bfc9',
  rpc: [
    'https://bsc-dataseed.binance.org/',
    'https://bsc-dataseed1.binance.org/',
    'https://bsc-dataseed2.binance.org/',
  ],
};

const BSC_TESTNET = {
  chainId: 97,
  chainName: 'bscTestnet',
  usdt: '0x337610d27c682e347c9cd60bd4b3b107c9d34ddd',
  usdtUsdFeed: '0xeca2605f0bcf2ba5966372c99837b1f182d3d620',
  rpc: [
    'https://bsc-testnet.publicnode.com',
    'https://data-seed-prebsc-1-s1.binance.org:8545/',
    'https://rpc.ankr.com/bsc_testnet_chapel',
  ],
};

const ZERO = '0x0000000000000000000000000000000000000000';

function isHexAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || ''));
}

function isZero(value) {
  return !isHexAddress(value) || String(value).toLowerCase() === ZERO;
}

module.exports = { BSC_MAINNET, BSC_TESTNET, ZERO, isHexAddress, isZero };
