/**
 * QuatriviumCredit Service — operaciones on-chain con ethers v6.
 */

import {
  Contract,
  Interface,
  ZeroAddress,
  isAddress,
  type AbstractProvider,
  type Signer,
} from 'ethers';
import { CONTRACT_ABI, ERC20_ABI, getContractAddress } from '../constants/contractConfig';
import { assertTrustedRpc, getProviderWithFallback, isContractConfigured } from '../constants/rpcConfig';
import { getTokenMeta } from '../constants/tokens';
import { isAllowedWei } from '../utils/sanitize';
import { cobrarComisionIntermediario, loadAppWallet } from './appWallet';

const logWarn = __DEV__ ? console.warn : () => {};
const logInfo = __DEV__ ? console.log : () => {};

let walletSigner: Signer | null = null;

export const setWalletSigner = (signer: Signer) => {
  walletSigner = signer;
  logInfo('Wallet signer configurado');
};

export const clearWalletSigner = () => {
  walletSigner = null;
  logInfo('Wallet signer limpio');
};

export const getWalletSigner = () => walletSigner;

const assertContractConfigured = () => {
  if (!isContractConfigured() || !isAddress(getContractAddress())) {
    throw new Error(
      'Contrato no configurado. Define EXPO_PUBLIC_CONTRACT_ADDRESS_TESTNET (development) o EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET (production).'
    );
  }
};

const getProviderAndSigner = async () => {
  const provider = await assertTrustedRpc(getProviderWithFallback());
  if (walletSigner) {
    if (!walletSigner.provider) {
      throw new Error('wrong-network');
    }
    const connected = await walletSigner.provider.getNetwork().catch(() => null);
    if (connected && Number(connected.chainId) !== Number((await provider.getNetwork()).chainId)) {
      throw new Error('wrong-network');
    }
    return { provider, signer: walletSigner };
  }
  return { provider, signer: null as Signer | null };
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
  amountWei: string
) => {
  const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);
  const allowance = (await tokenContract.allowance(userAddress, getContractAddress())) as bigint;
  const required = BigInt(amountWei);

  if (allowance < required) {
    logInfo('Aprobando token para el contrato...');
    const txApprove = await tokenContract.approve(getContractAddress(), required);
    await txApprove.wait();
    logInfo('Token aprobado');
  }
};

export const QuatriviumCreditService = {
  connectWallet: async () => {
    const { signer } = await getProviderAndSigner();
    if (!signer) {
      throw new Error('no-wallet');
    }
    return signer.getAddress();
  },

  depositar: async (amountInWei: string, tokenAddress: string) => {
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
    if (!Number.isInteger(nivel) || nivel < 0 || nivel > 10) {
      throw new Error('invalid-level');
    }
    const { signer } = await requireInternalSigner();
    const credit = contractWith(signer);
    await credit.solicitarPrestamo.staticCall(tokenAddress, nivel);
    await cobrarComisionIntermediario(signer, true);
    const tx = await credit.solicitarPrestamo(tokenAddress, nivel);
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
    return tx.wait();
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
    return last;
  },

  registrarHumano: async (_userAddress: string, padre?: string) => {
    const { signer } = await requireInternalSigner();
    const sponsor = padre && isAddress(padre) ? padre : ZeroAddress;
    const tx = await contractWith(signer).registrarHumanoConPadre(sponsor);
    return tx.wait();
  },

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

  vincularIdentidad: async (
    phoneHash: string,
    deviceHash: string,
    deadline: number,
    v: number,
    r: string,
    s: string
  ) => {
    const { signer } = await requireInternalSigner();
    const tx = await contractWith(signer).vincularIdentidad(phoneHash, deviceHash, deadline, v, r, s);
    return tx.wait();
  },

  destruirCuenta: async (tokenAddress: string) => {
    assertToken(tokenAddress);
    const { signer } = await requireInternalSigner();
    const userAddress = await signer.getAddress();
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);
    const balance = (await tokenContract.balanceOf(userAddress)) as bigint;
    if (balance > 0n) {
      const allowance = (await tokenContract.allowance(userAddress, getContractAddress())) as bigint;
      if (allowance < balance) {
        const txApprove = await tokenContract.approve(getContractAddress(), balance);
        await txApprove.wait();
      }
    }
    const tx = await contractWith(signer).destruirCuenta(tokenAddress);
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
    return {
      nivelActual: Number(progress.nivelActual),
      solicitudesCompletadas: Number(progress.solicitudesCompletadas),
      ultimoPrestamoTimestamp: Number(progress.ultimoPrestamoTimestamp),
    };
  },

  obtenerCooldownRestante: async (userAddress: string) => {
    const { provider } = await getProviderAndSigner();
    const cooldown = await contractWith(provider).obtenerCooldownRestante(userAddress);
    return Number(cooldown);
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
