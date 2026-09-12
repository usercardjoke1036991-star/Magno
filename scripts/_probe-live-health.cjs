/**
 * Sondeo live Demo (BSC 97) y Real (BSC 56). No envía transacciones.
 * Uso: node scripts/_probe-live-health.cjs
 */
try {
  require('dotenv').config();
} catch {
  /* opcional */
}
const { ethers } = require('ethers');
const { BSC_MAINNET, BSC_TESTNET, isZero } = require('./bscNetworks.cjs');
const artifact = require('../artifacts/contracts/QuatriviumCredit.sol/QuatriviumCredit.json');

const DEMO =
  process.env.EXPO_PUBLIC_CONTRACT_ADDRESS_TESTNET ||
  '0xD2d2A9eF0D1e4f253abc90Dd4ACb0E6C50B2de9f';
const STALE_MAINNET = '0xa6aac9ce4923789a4095fbc0504db9a697f8a46d';
const ENV_MAINNET = String(process.env.EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET || '').trim();

const ERC20 = [
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

async function firstProvider(urls, chainId) {
  const errors = [];
  for (const url of urls) {
    try {
      const p = new ethers.JsonRpcProvider(url, chainId, { staticNetwork: true });
      const net = await Promise.race([
        p.getNetwork(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 8s')), 8000)),
      ]);
      if (Number(net.chainId) !== chainId) {
        errors.push(`${url} chain ${net.chainId}`);
        continue;
      }
      const block = await p.getBlockNumber();
      return { p, url, block };
    } catch (e) {
      errors.push(`${url} → ${(e.shortMessage || e.message || e).toString().slice(0, 80)}`);
    }
  }
  throw new Error(`sin RPC chain ${chainId}: ${errors.join(' | ')}`);
}

function fmt(v) {
  if (typeof v === 'bigint') return v.toString();
  if (v && typeof v === 'object' && typeof v.toString === 'function' && v.toString() !== '[object Object]') {
    return v.toString();
  }
  return v;
}

async function callSafe(contract, name, args = []) {
  try {
    const v = await contract[name](...args);
    if (Array.isArray(v) && v.length && typeof v !== 'string') {
      return { ok: true, value: Array.from(v).map((x) => (typeof x === 'bigint' ? x.toString() : String(x))) };
    }
    return { ok: true, value: fmt(v) };
  } catch (e) {
    return { ok: false, err: (e.shortMessage || e.reason || e.message || 'fail').toString().slice(0, 120) };
  }
}

function selectorInCode(code, name) {
  try {
    const frag = artifact.abi.find((x) => x.type === 'function' && x.name === name);
    if (!frag) return null;
    const sel = ethers.id(`${name}(${(frag.inputs || []).map((i) => i.type).join(',')})`).slice(2, 10);
    return code.toLowerCase().includes(sel.toLowerCase());
  } catch {
    return null;
  }
}

async function probeWorld({ label, chainId, rpcs, address, usdtList }) {
  const out = { label, chainId, address, configured: !isZero(address) };
  if (!out.configured) {
    out.status = 'NO DESPLEGADO';
    out.detail = 'Dirección vacía o zero. Cuenta Real no tiene crédito on-chain.';
    return out;
  }

  const rpc = await firstProvider(rpcs, chainId);
  out.rpc = rpc.url;
  out.block = rpc.block;

  const code = await rpc.p.getCode(address);
  out.hasCode = Boolean(code && code !== '0x');
  out.runtimeBytes = out.hasCode ? (code.length - 2) / 2 : 0;
  out.eip170 = out.hasCode ? out.runtimeBytes <= 24576 : null;
  if (!out.hasCode) {
    out.status = 'SIN BYTECODE';
    out.detail = 'La dirección no tiene contrato en esta red.';
    return out;
  }

  const c = new ethers.Contract(address, artifact.abi, rpc.p);
  const views = [
    'fundador',
    'owner',
    'paused',
    'feeCollector',
    'feeBasisPoints',
    'COOLDOWN_PRESTAMO',
    'TIMELOCK_DELAY',
    'attester',
    'kycExigido',
    'identidadExigida',
    'requiredConfirmations',
    'BONO_ACTIVACION',
  ];
  out.calls = {};
  for (const fn of views) {
    out.calls[fn] = await callSafe(c, fn);
  }

  out.admins = [];
  for (let i = 0; i < 3; i++) {
    const row = await callSafe(c, 'ownerList', [i]);
    if (!row.ok) break;
    out.admins.push(row.value);
  }

  const caps = [
    'dispersionCongelada',
    'marcarMorosoSiVencido',
    'donar',
    'cobrarBonoHito',
    'hitoCobrado',
    'retirarLiquidez',
    'obtenerCooldownRestante',
    'niveles',
  ];
  out.capabilities = {};
  for (const fn of caps) {
    out.capabilities[fn] = selectorInCode(code, fn);
  }

  out.levels = {};
  for (const id of [1, 10, 100, 101, 1000]) {
    const row = await callSafe(c, 'niveles', [id]);
    if (!row.ok) {
      out.levels[id] = { ok: false, err: row.err };
      continue;
    }
    const [monto, plazo, tasa] = row.value;
    out.levels[id] = {
      ok: true,
      monto: ethers.formatUnits(monto, 18),
      plazoDias: Number(plazo) / 86400,
      tasaBps: tasa,
    };
  }

  out.tokens = [];
  for (const token of usdtList) {
    const supported = await callSafe(c, 'supportedToken', [token]);
    const liq = await callSafe(c, 'totalLiquidity', [token]);
    const outst = await callSafe(c, 'outstandingLoans', [token]);
    const fees = await callSafe(c, 'collectedFees', [token]);
    let symbol = '?';
    let cash = null;
    try {
      const erc = new ethers.Contract(token, ERC20, rpc.p);
      symbol = await erc.symbol();
      cash = (await erc.balanceOf(address)).toString();
    } catch {
      /* token may not exist on this chain */
    }
    const tokenRow = {
      token,
      symbol,
      supported: supported.ok ? supported.value : supported.err,
      liquidity: liq.ok ? liq.value : liq.err,
      outstanding: outst.ok ? outst.value : outst.err,
      fees: fees.ok ? fees.value : fees.err,
      cash,
    };
    if (liq.ok && outst.ok && fees.ok && cash != null) {
      tokenRow.navOk = BigInt(cash) + BigInt(outst.value) === BigInt(liq.value) + BigInt(fees.value);
    }
    out.tokens.push(tokenRow);
  }

  const founder = out.calls.fundador?.ok ? out.calls.fundador.value : null;
  if (founder && !isZero(founder)) {
    out.founder = {
      humanos: await callSafe(c, 'humanosVerificados', [founder]),
      reputacion: await callSafe(c, 'reputacion', [founder]),
      deuda: await callSafe(c, 'obtenerDeuda', [founder]),
      progreso: await callSafe(c, 'obtenerProgresoUsuario', [founder]),
      moroso: await callSafe(c, 'esMoroso', [founder]),
      freeze: await callSafe(c, 'dispersionCongelada', [founder]),
    };
  }

  const paused = out.calls.paused?.ok && String(out.calls.paused.value) === 'true';
  const l1ok = out.levels[1]?.ok && Number(out.levels[1].monto) === 1;
  const l100ok = out.levels[100]?.ok && Number(out.levels[100].monto) === 10000;
  const l101 = out.levels[101];
  const is1000 = l101?.ok && Number(l101.monto) > 10000;
  out.generation = is1000 ? 'repo-1000' : l100ok ? 'live-100' : l1ok ? 'parcial' : 'desconocida';
  out.desfaseRepo = out.generation !== 'repo-1000';

  const navBroken = out.tokens.some((t) => t.navOk === false);
  if (paused) out.status = 'PAUSADO';
  else if (navBroken) out.status = 'NAV ROTO';
  else if (out.hasCode && l1ok) out.status = 'OPERATIVO';
  else out.status = 'DEGRADADO';

  return out;
}

function printWorld(w) {
  console.log(`\n======== ${w.label} ========`);
  console.log(`Red:        chain ${w.chainId}`);
  console.log(`Contrato:   ${w.address || '(vacío)'}`);
  console.log(`Estado:     ${w.status}`);
  if (w.detail) console.log(`Detalle:    ${w.detail}`);
  if (w.rpc) console.log(`RPC:        ${w.rpc}  bloque ${w.block}`);
  if (w.runtimeBytes) {
    console.log(`Bytecode:   ${w.runtimeBytes} bytes  EIP-170 ${w.eip170 ? 'OK' : 'EXCEDE'}`);
    console.log(`Generación: ${w.generation}  desfase vs repo 1000: ${w.desfaseRepo ? 'SÍ' : 'no'}`);
  }
  if (w.calls) {
    for (const [k, v] of Object.entries(w.calls)) {
      console.log(`  ${k}: ${v.ok ? v.value : 'AUSENTE (' + v.err + ')'}`);
    }
  }
  if (w.admins?.length) console.log(`  admins: ${w.admins.join(', ')}`);
  if (w.capabilities) {
    console.log('  selectores vs ABI actual:');
    for (const [k, v] of Object.entries(w.capabilities)) {
      console.log(`    ${k}: ${v === true ? 'sí' : v === false ? 'NO en bytecode' : '?'}`);
    }
  }
  if (w.levels) {
    for (const [id, row] of Object.entries(w.levels)) {
      if (row.ok) console.log(`  L${id}: $${row.monto} / ${row.plazoDias}d / ${row.tasaBps} bps`);
      else console.log(`  L${id}: no (${row.err})`);
    }
  }
  if (w.tokens) {
    for (const t of w.tokens) {
      console.log(
        `  token ${t.symbol} ${t.token}: supported=${t.supported} liq=${t.liquidity} out=${t.outstanding} cash=${t.cash} nav=${t.navOk}`
      );
    }
  }
  if (w.founder) {
    console.log('  fundador on-chain:');
    for (const [k, v] of Object.entries(w.founder)) {
      console.log(`    ${k}: ${v.ok ? JSON.stringify(v.value) : v.err}`);
    }
  }
}

async function main() {
  const worlds = [];

  worlds.push(
    await probeWorld({
      label: 'DEMO (BSC testnet 97)',
      chainId: 97,
      rpcs: BSC_TESTNET.rpc,
      address: DEMO,
      usdtList: [
        '0x2d4AE5E6984D98777a24473F196326ff2604F5A6',
        '0x337610d27c682e347c9cd60bd4b3b107c9d34ddd',
      ],
    })
  );

  const configuredMain = ENV_MAINNET && !isZero(ENV_MAINNET) ? ENV_MAINNET : '';
  worlds.push(
    await probeWorld({
      label: 'REAL configurado (.env / app)',
      chainId: 56,
      rpcs: BSC_MAINNET.rpc,
      address: configuredMain || ethers.ZeroAddress,
      usdtList: [BSC_MAINNET.usdt],
    })
  );

  worlds.push(
    await probeWorld({
      label: 'REAL residual (dirección vieja del checker)',
      chainId: 56,
      rpcs: BSC_MAINNET.rpc,
      address: STALE_MAINNET,
      usdtList: [BSC_MAINNET.usdt],
    })
  );

  worlds.forEach(printWorld);

  const demo = worlds[0];
  const realCfg = worlds[1];
  const stale = worlds[2];
  console.log('\n======== RESUMEN ========');
  console.log(`Demo live:     ${demo.status} · ${demo.generation || 'n/a'} · ${demo.runtimeBytes || 0} B`);
  console.log(`Mainnet app:   ${realCfg.status}`);
  console.log(`Mainnet viejo: ${stale.status} · ${stale.generation || 'n/a'} · ${stale.runtimeBytes || 0} B`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
