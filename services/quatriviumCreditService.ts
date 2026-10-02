/**
 * QuatriviumCredit Service — operaciones on-chain con ethers v6.
 */

import {
  Contract,
  Interface,
  ZeroAddress,
  ZeroHash,
  formatUnits,
  id,
  isAddress,
  type AbstractProvider,
  type Signer,
} from 'ethers';
import { ALTA_ABI, getAltaAddress, isAltaConfigured } from '../constants/altaConfig';
import { CONTRACT_ABI, ERC20_ABI, getContractAddress } from '../constants/contractConfig';
import { FAMA_ABI, isFamaAddress } from '../constants/famaConfig';
import { FAMA_CANJE_POR_USDT } from '../constants/fama';
import { isTestnetOnlyToken } from '../constants/bsc';
import { assertTrustedRpc, getProviderWithFallback, isAccessPaymentEnabled, isContractConfigured, isDemoAccount, isDemoMode } from '../constants/rpcConfig';
import { getTokenMeta } from '../constants/tokens';
import { isAllowedWei } from '../utils/sanitize';
import { CORE_LOAN_LEVEL, MAX_LOAN_LEVEL, nextClaimableMilestone, nextUpcomingMilestone } from '../constants/loanTiers';
import { cooldownRestanteDesdeTimestamp } from '../utils/creditCooldown';
import { walletRunsOnThisDevice } from '../utils/accountEntry';
import { identityHashBound, liveCreditReady } from '../utils/creditGates';
import { isPhoneActive } from './accountPhone';
import { getDeviceHash } from './deviceBinding';
import { cobrarComisionIntermediario, isPhraseBackedUp, loadAppWallet } from './appWallet';
import { loadVerifiedEmail } from './accountEmail';
import { requestDemoIdentity } from './demoIdentity';

const logWarn = __DEV__ ? console.warn : () => {};
const logInfo = __DEV__ ? console.log : () => {};

let walletSigner: Signer | null = null;

export const setWalletSigner = (signer: Signer) => {
  if (walletSigner === signer) return;
  walletSigner = signer;
};

export const clearWalletSigner = () => {
  walletSigner = null;
}

export const getWalletSigner = () => walletSigner;

const assertContractConfigured = () => {
  if (!isContractConfigured() || !isAddress(getContractAddress())) {
    throw new Error(
      'Contrato no configurado. Define EXPO_PUBLIC_CONTRACT_ADDRESS_TESTNET (development) o EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET (production).'
    );
  }
};

const recoverAppSigner = async (): Promise<Signer | null> => {
  const app = await loadAppWallet();
  if (!app) return null;
  setWalletSigner(app);
  return app;
};

const getProviderAndSigner = async () => {
  const provider = await assertTrustedRpc(getProviderWithFallback());
  let signer = walletSigner;
  if (!signer || !signer.provider) {
    signer = await recoverAppSigner();
    return { provider, signer };
  }
  const connected = await signer.provider.getNetwork().catch(() => null);
  const expected = Number((await provider.getNetwork()).chainId);
  if (connected && Number(connected.chainId) !== expected) {
    signer = await recoverAppSigner();
  }
  return { provider, signer };
};

const requireSigner = async () => {
  const { signer, provider } = await getProviderAndSigner();
  if (!signer) {
    throw new Error('no-wallet');
  }
  return { signer, provider };
};

const requireInternalSigner = async () => {
  const pair = await requireSigner();
  const app = await loadAppWallet();
  const current = (await pair.signer.getAddress()).toLowerCase();
  if (!app || app.address.toLowerCase() !== current) {
    throw new Error('internal-wallet-only');
  }
  return pair;
};

const assertToken = (tokenAddress: string) => {
  if (!getTokenMeta(tokenAddress)) {
    throw new Error('token-not-in-app');
  }
};

const assertAmount = (amountWei: string) => {
  if (!isAllowedWei(amountWei)) {
    throw new Error('invalid-amount');
  }
};

const contractWith = (runner: Signer | AbstractProvider) => {
  assertContractConfigured();
  return new Contract(getContractAddress(), CONTRACT_ABI, runner);
};

export type ProtocolCaps = {
  maxLevel: number;
  canClaimHitos: boolean;
  canDonate: boolean;
  canCanjearFama: boolean;
  canRacha: boolean;
  canPagarVerificacion: boolean;
};

const DEFAULT_CAPS: ProtocolCaps = {
  maxLevel: CORE_LOAN_LEVEL,
  canClaimHitos: false,
  canDonate: false,
  canCanjearFama: false,
  canRacha: false,
  canPagarVerificacion: false,
};

export function cachedProtocolCaps(): ProtocolCaps {
  return capsCache?.caps || DEFAULT_CAPS;
}

let capsCache: { addr: string; caps: ProtocolCaps } | null = null;

export function asWeiString(value: unknown): string {
  try {
    if (typeof value === 'bigint') return value.toString();
    const text = String(value ?? '0').trim();
    return /^\d+$/.test(text) ? text : '0';
  } catch {
    return '0';
  }
}

function asFamePoints(value: unknown): number {
  try {
    const n = Number(typeof value === 'bigint' ? value : String(value ?? '0'));
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  } catch {
    return 0;
  }
}

async function readFamaHermano(credit: Contract): Promise<string> {
  try {
    const hermano = await credit.famaHermano();
    return isFamaAddress(String(hermano || '')) ? String(hermano) : '';
  } catch {
    return '';
  }
}

const proposeAdmin = async (fragment: string, args: unknown[]) => {
  const { signer } = await requireSigner();
  const contract = contractWith(signer);
  const data = contract.interface.encodeFunctionData(fragment, args);
  const tx = await contract.proposeAdminAction(data);
  return tx.wait();
};

const assertProposalId = (id: number) => {
  if (!Number.isInteger(id) || id < 1) throw new Error('no-admin-proposal');
};

const asegurarAprobacionToken = async (
  signer: Signer,
  userAddress: string,
  tokenAddress: string,
  amountWei: string,
  spender = getContractAddress()
) => {
  const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);
  const allowance = (await tokenContract.allowance(userAddress, spender)) as bigint;
  const required = BigInt(amountWei);

  if (allowance < required) {
    logInfo('Aprobando token para el contrato...');
    const txApprove = await tokenContract.approve(spender, required);
    await txApprove.wait();
    logInfo('Token aprobado');
  }
};

const DEMO_TOKEN_ABI = [...ERC20_ABI, 'function mint(address to, uint256 amount)'];

/** En Demo cubre el interés con USDT de prueba para poder pagar y subir de nivel. Nunca en Real. */
async function topUpDemoUsdtToDebt(tokenAddress: string, neededWei = '0'): Promise<boolean> {
  if (!isDemoAccount() || !isDemoMode()) return false;
  if (!isTestnetOnlyToken(tokenAddress)) return false;
  const { signer } = await requireInternalSigner();
  const userAddress = await signer.getAddress();
  const credit = contractWith(signer);
  const deuda = await credit.obtenerDeuda(userAddress);
  const fromLoan = deuda[2] as bigint;
  let needed = fromLoan;
  if (neededWei && neededWei !== '0') {
    try {
      const extra = BigInt(neededWei);
      if (extra > needed) needed = extra;
    } catch {
      // Se usa la deuda on-chain.
    }
  }
  if (needed <= 0n) return false;
  const token = new Contract(tokenAddress, DEMO_TOKEN_ABI, signer);
  const balance = (await token.balanceOf(userAddress)) as bigint;
  if (balance >= needed) return false;
  const tx = await token.mint(userAddress, needed - balance);
  await tx.wait();
  return true;
}

async function mintDemoUsdtTo(tokenAddress: string, to: string, amountWei: string): Promise<boolean> {
  if (!isDemoAccount() || !isDemoMode()) return false;
  if (!isTestnetOnlyToken(tokenAddress) || !isAddress(to)) return false;
  let needed = 0n;
  try {
    needed = BigInt(amountWei || '0');
  } catch {
    return false;
  }
  if (needed <= 0n) return false;
  const { signer } = await requireInternalSigner();
  const token = new Contract(tokenAddress, DEMO_TOKEN_ABI, signer);
  const balance = (await token.balanceOf(to)) as bigint;
  if (balance >= needed) return false;
  const tx = await token.mint(to, needed - balance);
  await tx.wait();
  return true;
}

async function prepareDemoCreditOnChain() {
  if (!isDemoAccount()) return;
  const { signer } = await requireInternalSigner();
  const address = await signer.getAddress();
  const credit = contractWith(signer);
  const [kyc, phoneHash, deviceHash] = await Promise.all([
    credit.kycDeclarado(address) as Promise<boolean>,
    credit.phoneHashOf(address) as Promise<string>,
    credit.deviceHashOf(address) as Promise<string>,
  ]);
  if (!kyc) {
    const tx = await credit.declararKyc();
    await tx.wait();
  }
  if (phoneHash === ZeroHash || deviceHash === ZeroHash) {
    const attestation = await requestDemoIdentity(address);
    const tx = await credit.vincularIdentidad(
      attestation.phoneHash,
      attestation.deviceHash,
      attestation.deadline,
      attestation.v,
      attestation.r,
      attestation.s
    );
    await tx.wait();
  }
}

export const QuatriviumCreditService = {
  detectarCapacidadProtocolo: async (): Promise<ProtocolCaps> => {
    if (!isContractConfigured() || !isAddress(getContractAddress())) {
      return DEFAULT_CAPS;
    }
    const addr = getContractAddress().toLowerCase();
    if (capsCache?.addr === addr) return capsCache.caps;
    const { provider } = await getProviderAndSigner();
    const credit = contractWith(provider);
    let maxLevel = CORE_LOAN_LEVEL;
    let canClaimHitos = false;
    let canDonate = false;
    let canCanjearFama = false;
    let canRacha = false;
    let canPagarVerificacion = false;
    try {
      const row = await credit.niveles(CORE_LOAN_LEVEL + 1);
      if (BigInt(row[0] ?? 0) > 0n) maxLevel = MAX_LOAN_LEVEL;
    } catch {
      maxLevel = CORE_LOAN_LEVEL;
    }
    try {
      await credit.hitoCobrado(ZeroAddress);
      canClaimHitos = true;
    } catch {
      canClaimHitos = false;
    }
    try {
      await credit.donado(ZeroAddress);
      canDonate = true;
    } catch {
      canDonate = false;
    }
    canCanjearFama = Boolean(await readFamaHermano(credit));
    if (canCanjearFama) {
      try {
        const { provider } = await getProviderAndSigner();
        const hermano = await readFamaHermano(credit);
        if (hermano) {
          const fama = new Contract(hermano, FAMA_ABI, provider);
          await fama.FAMA_POR_DIA_RACHA();
          canRacha = true;
        }
      } catch {
        canRacha = false;
      }
    }
    try {
      const code = await provider.getCode(addr);
      const sel = id('pagarVerificacion(address,uint256)').slice(2, 10).toLowerCase();
      canPagarVerificacion = Boolean(code) && code.toLowerCase().includes(sel);
    } catch {
      canPagarVerificacion = false;
    }
    const caps = { maxLevel, canClaimHitos, canDonate, canCanjearFama, canRacha, canPagarVerificacion };
    capsCache = { addr, caps };
    return caps;
  },

  connectWallet: async () => {
    const { signer } = await getProviderAndSigner();
    if (!signer) {
      throw new Error('no-wallet');
    }
    return signer.getAddress();
  },

  depositar: async (amountInWei: string, tokenAddress: string) => {
    if (isDemoAccount() || isDemoMode()) {
      throw new Error('pool-real-only');
    }
    assertToken(tokenAddress);
    assertAmount(amountInWei);
    const { signer } = await requireInternalSigner();
    const userAddress = await signer.getAddress();
    await asegurarAprobacionToken(signer, userAddress, tokenAddress, amountInWei);
    const tx = await contractWith(signer).depositarLiquidez(tokenAddress, amountInWei);
    return tx.wait();
  },

  retirar: async (_amountInWei: string, _tokenAddress: string) => {
    throw new Error('pool locked');
  },

  solicitar: async (tokenAddress: string, nivel = 0) => {
    assertToken(tokenAddress);
    if (!Number.isInteger(nivel) || nivel < 0 || nivel > MAX_LOAN_LEVEL) {
      throw new Error('invalid-level');
    }
    const { signer } = await requireInternalSigner();
    const phraseOk = await isPhraseBackedUp().catch(() => false);
    if (!phraseOk) {
      throw new Error('phrase-required');
    }
    if (!isDemoAccount()) {
      const email = await loadVerifiedEmail();
      const phoneActive = await isPhoneActive().catch(() => false);
      const userAddress = await signer.getAddress();
      const credit = contractWith(signer);
      const donated = await credit.donado(userAddress).catch(() => 0n);
      let altaPaid = false;
      if (isAltaConfigured()) {
        try {
          const alta = new Contract(getAltaAddress(), ALTA_ABI, signer);
          altaPaid = BigInt(await alta.padrinoApartado(userAddress)) > 0n;
        } catch {
          altaPaid = false;
        }
      }
      if (!altaPaid && BigInt(donated.toString()) < 2n * 10n ** 18n) {
        throw new Error('access-required');
      }
      let kycDeclarado = false;
      let identityBound = false;
      try {
        kycDeclarado = Boolean(await credit.kycDeclarado(userAddress));
      } catch {
        kycDeclarado = false;
      }
      let deviceMatches = false;
      try {
        const phoneHash = String((await credit.phoneHashOf(userAddress)) || '');
        const deviceHash = String((await credit.deviceHashOf(userAddress)) || '');
        identityBound = identityHashBound(phoneHash) && identityHashBound(deviceHash);
        const localHash = await getDeviceHash().catch(() => '');
        deviceMatches = walletRunsOnThisDevice(deviceHash, localHash);
      } catch {
        identityBound = false;
        deviceMatches = false;
      }
      if (!liveCreditReady(false, {
        kycDeclarado,
        identityBound,
        hasEmail: Boolean(email),
        phraseBackedUp: true,
        deviceMatches,
        phoneActive,
      })) {
        if (!email) throw new Error('email-required');
        if (!identityBound || !phoneActive) throw new Error('identity required');
        if (!deviceMatches && !phoneActive) throw new Error('device-mismatch');
        throw new Error('kyc required');
      }
    }
    const credit = contractWith(signer);
    await credit.solicitarPrestamo.staticCall(tokenAddress, nivel);
    await cobrarComisionIntermediario(signer, true);
    const tx = await credit.solicitarPrestamo(tokenAddress, nivel);
    const receipt = await tx.wait();
    const userAddress = await signer.getAddress();
    const deuda = await credit.obtenerDeuda(userAddress);
    const remaining = deuda[2] as bigint;
    if (remaining > 0n) {
      await asegurarAprobacionToken(signer, userAddress, tokenAddress, remaining.toString());
    }
    return receipt;
  },

  cobrarBonoHito: async (tokenAddress: string) => {
    assertToken(tokenAddress);
    const { signer } = await requireInternalSigner();
    const credit = contractWith(signer);
    await credit.cobrarBonoHito.staticCall(tokenAddress);
    const tx = await credit.cobrarBonoHito(tokenAddress);
    return tx.wait();
  },

  donar: async (amountInWei: string, tokenAddress: string) => {
    if (!isAccessPaymentEnabled()) {
      throw new Error(isDemoAccount() || isDemoMode() ? 'access-not-ready' : 'donate-real-only');
    }
    assertToken(tokenAddress);
    assertAmount(amountInWei);
    const { signer } = await requireInternalSigner();
    const userAddress = await signer.getAddress();
    await asegurarAprobacionToken(signer, userAddress, tokenAddress, amountInWei);
    const credit = contractWith(signer);
    await credit.donar.staticCall(tokenAddress, amountInWei);
    const tx = await credit.donar(tokenAddress, amountInWei);
    return tx.wait();
  },

  pagarVerificacion: async (amountInWei: string, tokenAddress: string) => {
    if (!isAccessPaymentEnabled()) {
      throw new Error(isDemoAccount() || isDemoMode() ? 'access-not-ready' : 'donate-real-only');
    }
    assertToken(tokenAddress);
    assertAmount(amountInWei);
    const { signer } = await requireInternalSigner();
    const userAddress = await signer.getAddress();
    await asegurarAprobacionToken(signer, userAddress, tokenAddress, amountInWei);
    const credit = contractWith(signer);
    await credit.pagarVerificacion.staticCall(tokenAddress, amountInWei);
    const tx = await credit.pagarVerificacion(tokenAddress, amountInWei);
    return tx.wait();
  },

  pagarRegistroAlta: async (tokenAddress: string) => {
    if (!isAccessPaymentEnabled()) {
      throw new Error(isDemoAccount() || isDemoMode() ? 'access-not-ready' : 'donate-real-only');
    }
    if (!isAltaConfigured()) {
      throw new Error('access-not-ready');
    }
    assertToken(tokenAddress);
    const amountInWei = (3n * 10n ** 18n).toString();
    const { signer } = await requireInternalSigner();
    const userAddress = await signer.getAddress();
    await asegurarAprobacionToken(signer, userAddress, tokenAddress, amountInWei, getAltaAddress());
    const alta = new Contract(getAltaAddress(), ALTA_ABI, signer);
    await alta.pagarRegistro.staticCall();
    const tx = await alta.pagarRegistro();
    return tx.wait();
  },

  altaPagada: async (userAddress: string) => {
    if (!isAltaConfigured() || !isAddress(userAddress)) return false;
    try {
      const { provider } = await getProviderAndSigner();
      const alta = new Contract(getAltaAddress(), ALTA_ABI, provider);
      return BigInt(await alta.padrinoApartado(userAddress)) > 0n;
    } catch {
      return false;
    }
  },

  obtenerSaludAdmin: async (tokenAddress: string) => {
    const empty = { cash: 0n, outstanding: 0n, liquidity: 0n, fees: 0n, reservaBote: 0n, reservaLocked: 0n, reservaApyBps: 0 };
    if (!isContractConfigured() || !isAddress(tokenAddress)) return empty;
    try {
      const { provider } = await getProviderAndSigner();
      const credit = contractWith(provider);
      const token = new Contract(tokenAddress, ERC20_ABI, provider);
      const [cash, outstanding, liquidity, fees] = await Promise.all([
        token.balanceOf(getContractAddress()),
        credit.outstandingLoans(tokenAddress),
        credit.totalLiquidity(tokenAddress),
        credit.collectedFees(tokenAddress),
      ]);
      let reservaBote = 0n;
      let reservaLocked = 0n;
      let reservaApyBps = 0;
      try {
        const { getReservaAddress, isReservaConfigured, RESERVA_ABI } = await import('../constants/reservaConfig');
        if (isReservaConfigured()) {
          const reserva = new Contract(getReservaAddress(), RESERVA_ABI, provider);
          const salud = await reserva.saludReserva();
          reservaBote = BigInt(salud.bote_ ?? salud[0] ?? 0n);
          reservaLocked = BigInt(salud.bloqueado_ ?? salud[1] ?? 0n);
          reservaApyBps = Number(salud.apyBps ?? salud[2] ?? 0);
        }
      } catch {
        reservaBote = 0n;
      }
      return {
        cash: BigInt(cash),
        outstanding: BigInt(outstanding),
        liquidity: BigInt(liquidity),
        fees: BigInt(fees),
        reservaBote,
        reservaLocked,
        reservaApyBps,
      };
    } catch {
      return empty;
    }
  },

  obtenerFama: async (userAddress: string) => {
    const empty = {
      caja: 0,
      red: 0,
      racha: 0,
      canjeada: 0,
      redCanjeada: 0,
      disponible: 0,
      redDisponible: 0,
      perfil: 0,
    };
    if (!isAddress(userAddress) || !isContractConfigured()) return empty;
    const { provider } = await getProviderAndSigner();
    const hermano = await readFamaHermano(contractWith(provider));
    if (!hermano) return empty;
    try {
      const fama = new Contract(hermano, FAMA_ABI, provider);
      const [caja, red, racha, canjeada, redCanjeada, disponible, redDisponible, perfil] = await Promise.all([
        fama.famaCaja(userAddress),
        fama.famaRed(userAddress).catch(() => 0n),
        fama.famaRacha(userAddress).catch(() => 0n),
        fama.famaCanjeada(userAddress),
        fama.famaRedCanjeada(userAddress).catch(() => 0n),
        fama.famaDisponible(userAddress),
        fama.famaRedDisponible(userAddress).catch(() => 0n),
        fama.famaPerfil(userAddress).catch(() => 0n),
      ]);
      return {
        caja: asFamePoints(caja),
        red: asFamePoints(red),
        racha: asFamePoints(racha),
        canjeada: asFamePoints(canjeada),
        redCanjeada: asFamePoints(redCanjeada),
        disponible: asFamePoints(disponible),
        redDisponible: asFamePoints(redDisponible),
        perfil: asFamePoints(perfil),
      };
    } catch {
      return empty;
    }
  },

  obtenerRacha: async (userAddress: string) => {
    const empty = {
      dias: 0,
      diasMax: 0,
      famaDias: 0,
      hitoCobrado: 0,
      siguienteHito: 0,
      bonoPendienteUsd: 0,
      graciaVigente: false,
    };
    if (!isAddress(userAddress) || !isContractConfigured()) return empty;
    const { provider } = await getProviderAndSigner();
    const hermano = await readFamaHermano(contractWith(provider));
    if (!hermano) return empty;
    try {
      const fama = new Contract(hermano, FAMA_ABI, provider);
      const row = await fama.obtenerRacha(userAddress);
      const pendingWei = BigInt(row.bonoPendiente ?? row[6] ?? 0);
      return {
        dias: Number(row.dias ?? row[0] ?? 0) || 0,
        diasMax: Number(row.diasMax ?? row[1] ?? 0) || 0,
        famaDias: Number(row.famaDias ?? row[3] ?? 0) || 0,
        hitoCobrado: Number(row.hitoCobrado ?? row[4] ?? 0) || 0,
        siguienteHito: Number(row.siguienteHito ?? row[5] ?? 0) || 0,
        bonoPendienteUsd: Number(formatUnits(pendingWei, 18)) || 0,
        graciaVigente: Boolean(row.graciaVigente ?? row[7]),
      };
    } catch {
      return empty;
    }
  },

  notificarRacha: async (hijo: string) => {
    if (!isAddress(hijo)) return;
    const { signer } = await requireInternalSigner();
    const credit = contractWith(signer);
    const hermano = await readFamaHermano(credit);
    if (!hermano) return;
    const caja = new Contract(hermano, FAMA_ABI, signer);
    try {
      await caja.notificarRacha.staticCall(hijo);
      const tx = await caja.notificarRacha(hijo);
      await tx.wait();
    } catch {
      /* sin cierre nuevo, sin padrino o hermano legado */
    }
  },

  cobrarBonoRacha: async () => {
    const { signer } = await requireInternalSigner();
    const credit = contractWith(signer);
    const hermano = await readFamaHermano(credit);
    if (!hermano) throw new Error('racha-legacy');
    const caja = new Contract(hermano, FAMA_ABI, signer);
    await caja.cobrarBonoRacha.staticCall();
    const tx = await caja.cobrarBonoRacha();
    return tx.wait();
  },

  canjearFama: async (fama: number) => {
    if (!Number.isInteger(fama) || fama < FAMA_CANJE_POR_USDT || fama % FAMA_CANJE_POR_USDT !== 0) {
      throw new Error('invalid-amount');
    }
    const { signer } = await requireInternalSigner();
    const credit = contractWith(signer);
    const hermano = await readFamaHermano(credit);
    if (!hermano) throw new Error('canje-legacy');
    const caja = new Contract(hermano, FAMA_ABI, signer);
    await caja.canjearFama.staticCall(fama);
    const tx = await caja.canjearFama(fama);
    return tx.wait();
  },

  canjearFamaRed: async (fama: number) => {
    if (!Number.isInteger(fama) || fama < FAMA_CANJE_POR_USDT || fama % FAMA_CANJE_POR_USDT !== 0) {
      throw new Error('invalid-amount');
    }
    const { signer } = await requireInternalSigner();
    const credit = contractWith(signer);
    const hermano = await readFamaHermano(credit);
    if (!hermano) throw new Error('canje-legacy');
    const caja = new Contract(hermano, FAMA_ABI, signer);
    await caja.canjearFamaRed.staticCall(fama);
    const tx = await caja.canjearFamaRed(fama);
    return tx.wait();
  },

  pagar: async (amountInWei: string, tokenAddress: string) => {
    assertToken(tokenAddress);
    assertAmount(amountInWei);
    const { signer } = await requireInternalSigner();
    const userAddress = await signer.getAddress();
    await asegurarAprobacionToken(signer, userAddress, tokenAddress, amountInWei);
    const credit = contractWith(signer);
    await credit.pagarPrestamo.staticCall(tokenAddress, amountInWei);
    await cobrarComisionIntermediario(signer, true);
    const tx = await credit.pagarPrestamo(tokenAddress, amountInWei);
    const receipt = await tx.wait();
    await QuatriviumCreditService.notificarRacha(userAddress);
    return receipt;
  },

  pagarCuotas: async (tokenAddress: string, count: number) => {
    assertToken(tokenAddress);
    if (!Number.isInteger(count) || count < 1 || count > 12) {
      throw new Error('invalid-amount');
    }
    const { signer } = await requireInternalSigner();
    const userAddress = await signer.getAddress();
    const credit = contractWith(signer);
    await cobrarComisionIntermediario(signer, true);
    let last: unknown = null;
    for (let i = 0; i < count; i += 1) {
      const deuda = await credit.obtenerDeuda(userAddress);
      const plan = await credit.planPago(userAddress);
      const totalDue = deuda[2] as bigint;
      const pagado = plan[0] as bigint;
      if (totalDue <= pagado) break;
      const restantes = totalDue - pagado;
      const totales = Number(plan[2]) || 1;
      const pagadas = Number(plan[3]);
      const left = Math.max(1, totales - pagadas);
      const leftover = count - i;
      const amount = leftover >= left || left <= 1 ? restantes : restantes / BigInt(left);
      if (amount <= 0n) break;
      await asegurarAprobacionToken(signer, userAddress, tokenAddress, amount.toString());
      await credit.pagarPrestamo.staticCall(tokenAddress, amount);
      const tx = await credit.pagarPrestamo(tokenAddress, amount);
      last = await tx.wait();
      if (leftover >= left || left <= 1) break;
    }
    await QuatriviumCreditService.notificarRacha(userAddress);
    return last;
  },

  registrarHumano: async (_userAddress: string, padre?: string) => {
    const { signer } = await requireInternalSigner();
    const sponsor = padre && isAddress(padre) ? padre : ZeroAddress;
    const tx = await contractWith(signer).registrarHumanoConPadre(sponsor);
    return tx.wait();
  },

  /**
   * En testnet el contrato sigue exigiendo KYC + identidad. La UI demo no pide SMS,
   * así que el worker atestigua un hash único por wallet (nunca en mainnet).
   */
  prepareDemoCredit: prepareDemoCreditOnChain,

  topUpDemoUsdtToDebt,
  mintDemoUsdtTo,

  declararKyc: async () => {
    const { signer } = await requireInternalSigner();
    const tx = await contractWith(signer).declararKyc();
    return tx.wait();
  },

  setKycExigido: async (exigido: boolean) => proposeAdmin('setKycExigido', [exigido]),

  setIdentidadExigida: async (exigido: boolean) => proposeAdmin('setIdentidadExigida', [exigido]),

  proposeAddAdmin: async (address: string) => {
    if (!isAddress(address)) throw new Error('invalid address');
    return proposeAdmin('addAdmin', [address]);
  },

  proposeRemoveAdmin: async (address: string) => {
    if (!isAddress(address)) throw new Error('invalid address');
    return proposeAdmin('removeAdmin', [address]);
  },

  proposeFeeCollector: async (address: string) => {
    if (!isAddress(address)) throw new Error('invalid address');
    return proposeAdmin('setFeeCollector', [address]);
  },

  proposeFundador: async (address: string) => {
    if (!isAddress(address)) throw new Error('invalid address');
    return proposeAdmin('setFundador', [address]);
  },

  proposeOwner: async (address: string) => {
    if (!isAddress(address)) throw new Error('invalid address');
    return proposeAdmin('setOwner', [address]);
  },

  proposeAttester: async (address: string) => {
    if (!isAddress(address)) throw new Error('invalid address');
    return proposeAdmin('setAttester', [address]);
  },

  proposeRequiredConfirmations: async (required: number) => {
    if (!Number.isInteger(required) || required < 1 || required > 3) {
      throw new Error('invalid confirms');
    }
    return proposeAdmin('setRequiredConfirmations', [required]);
  },

  proposeSetTokenConfig: async (token: string, feed: string, enabled: boolean) => {
    if (!isAddress(token)) throw new Error('invalid address');
    if (enabled && !isAddress(feed)) throw new Error('invalid feed');
    return proposeAdmin('setTokenConfig', [token, enabled ? feed : ZeroAddress, enabled]);
  },

  confirmAdminAction: async (id: number) => {
    assertProposalId(id);
    const { signer } = await requireSigner();
    const tx = await contractWith(signer).confirmAdminAction(id);
    return tx.wait();
  },

  executeAdminAction: async (id: number) => {
    assertProposalId(id);
    const { signer } = await requireSigner();
    const tx = await contractWith(signer).executeAdminAction(id);
    return tx.wait();
  },

  canVincularIdentidad: async (
    phoneHash: string,
    deviceHash: string,
    deadline: number,
    v: number,
    r: string,
    s: string
  ) => {
    const { signer } = await requireInternalSigner();
    await contractWith(signer).vincularIdentidad.staticCall(phoneHash, deviceHash, deadline, v, r, s);
  },

  vincularIdentidad: async (
    phoneHash: string,
    deviceHash: string,
    deadline: number,
    v: number,
    r: string,
    s: string
  ) => {
    const { signer } = await requireInternalSigner();
    const credit = contractWith(signer);
    await credit.vincularIdentidad.staticCall(phoneHash, deviceHash, deadline, v, r, s);
    const tx = await credit.vincularIdentidad(phoneHash, deviceHash, deadline, v, r, s);
    return tx.wait();
  },

  obtenerDatosUsuario: async (userAddress: string, tokenAddress: string) => {
    const { provider } = await getProviderAndSigner();
    const contract = contractWith(provider);
    try {
      const lpValue = await contract.valorLp(userAddress, tokenAddress);
      return { liquidezDepositada: lpValue.toString() };
    } catch (e) {
      logWarn('valorLp falló:', e);
      return { liquidezDepositada: '0' };
    }
  },

  disconnect: async () => {
    clearWalletSigner();
  },

  obtenerProgresoUsuario: async (userAddress: string) => {
    const { provider } = await getProviderAndSigner();
    const progress = await contractWith(provider).obtenerProgresoUsuario(userAddress);
    const nivelActual = Number(progress.nivelActual ?? progress[0]);
    const solicitudesCompletadas = Number(progress.solicitudesCompletadas ?? progress[1]);
    const ultimoPrestamoTimestamp = Number(progress.ultimoPrestamoTimestamp ?? progress[2]);
    let lastHito = 0;
    let hitoSupported = false;
    let donatedWei = '0';
    const caps = await QuatriviumCreditService.detectarCapacidadProtocolo();
    if (caps.canClaimHitos) {
      try {
        lastHito = Number(await contractWith(provider).hitoCobrado(userAddress));
        hitoSupported = true;
      } catch {
        lastHito = 0;
      }
    }
    if (caps.canDonate) {
      try {
        donatedWei = (await contractWith(provider).donado(userAddress)).toString();
      } catch {
        donatedWei = '0';
      }
    }
    if (await QuatriviumCreditService.altaPagada(userAddress)) {
      const floor = 3n * 10n ** 18n;
      if (BigInt(donatedWei || '0') < floor) donatedWei = floor.toString();
    }
    return {
      nivelActual,
      solicitudesCompletadas,
      ultimoPrestamoTimestamp,
      lastHito,
      bonusPending: hitoSupported ? nextClaimableMilestone(nivelActual, lastHito) : 0,
      nextMilestone: nextUpcomingMilestone(nivelActual, lastHito),
      donatedWei: asWeiString(donatedWei),
    };
  },

  obtenerCooldownRestante: async (userAddress: string) => {
    const progress = await QuatriviumCreditService.obtenerProgresoUsuario(userAddress);
    return cooldownRestanteDesdeTimestamp(progress.ultimoPrestamoTimestamp);
  },

  obtenerOwner: async () => {
    const { provider } = await getProviderAndSigner();
    try {
      return await contractWith(provider).owner();
    } catch (e) {
      logWarn('owner falló:', e);
      return '0x0000000000000000000000000000000000000000';
    }
  },

  retirarComisiones: async () => proposeAdmin('retirarComisiones', []),

  retirarComisionesToken: async (tokenAddress: string) => {
    assertToken(tokenAddress);
    return proposeAdmin('retirarComisionesToken', [tokenAddress]);
  },

  pausarContrato: async () => {
    const { signer } = await requireSigner();
    const tx = await contractWith(signer).pausarContrato();
    return tx.wait();
  },

  despausarContrato: async () => proposeAdmin('despausarContrato', []),

  cancelAdminAction: async (id: number) => {
    assertProposalId(id);
    const { signer } = await requireSigner();
    const tx = await contractWith(signer).cancelAdminAction(id);
    return tx.wait();
  },

  liquidar: async (debtorAddress: string, tokenAddress: string) => {
    if (!isAddress(debtorAddress)) throw new Error('invalid address');
    assertToken(tokenAddress);
    const { signer } = await requireSigner();
    const credit = contractWith(signer);
    const userAddress = await signer.getAddress();
    // Obtener la deuda total del deudor para aprobar el monto exacto
    const deuda = await credit.obtenerDeuda(debtorAddress);
    const totalDue = deuda[2] as bigint;
    if (totalDue <= 0n) throw new Error('no-active-debt');
    const plan = await credit.planPago(debtorAddress);
    const pagado = plan[0] as bigint;
    const remaining = totalDue > pagado ? totalDue - pagado : 0n;
    if (remaining <= 0n) throw new Error('no-active-debt');
    await asegurarAprobacionToken(signer, userAddress, tokenAddress, remaining.toString());
    const tx = await credit.liquidate(debtorAddress, tokenAddress);
    return tx.wait();
  },

  marcarMorosoSiVencido: async (debtorAddress: string) => {
    if (!isAddress(debtorAddress)) throw new Error('invalid address');
    const { signer } = await requireSigner();
    const tx = await contractWith(signer).marcarMorosoSiVencido(debtorAddress);
    return tx.wait();
  },

  prepareDeposit: async (tokenAddress: string, amountInWei: string) => {
    assertContractConfigured();
    const iface = new Interface(CONTRACT_ABI);
    const data = iface.encodeFunctionData('depositarLiquidez', [tokenAddress, amountInWei]);
    return { to: getContractAddress(), data, value: '0x0' };
  },

  prepareRegistrarHumano: async (_userAddress: string, padre?: string) => {
    assertContractConfigured();
    const iface = new Interface(CONTRACT_ABI);
    const sponsor = padre && isAddress(padre) ? padre : ZeroAddress;
    const data = iface.encodeFunctionData('registrarHumanoConPadre', [sponsor]);
    return { to: getContractAddress(), data, value: '0x0' };
  },
};
