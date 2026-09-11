/**
 * useHomeHandlers — lógica de cada acción del usuario en la pantalla principal.
 * Extraído de app/index.tsx para reducir complejidad del componente raíz.
 * Cada handler valida precondiciones y delega al hook useWeb3Transactions.
 */
import { formatUnits, parseUnits, type Eip1193Provider, type Signer } from 'ethers';
import { Alert, Linking } from 'react-native';
import { getEthersSignerFromProvider } from '../web3Config';
import { setWalletSigner } from '../services/quatriviumCreditService';
import { useWeb3Transactions } from './useWeb3Transactions';
import { isContractConfigured, isDemoMode } from '../constants/rpcConfig';
import { formatCooldown, parsePositiveDecimal } from '../utils/formatters';
import { useI18n } from '../i18n/LanguageContext';
import { NOTIFY_API } from '../constants/appLinks';
import type { LoanTier, UserInfo } from './useWeb3Balances';
import type { Token } from '../constants/tokens';

const BSC_TESTNET_FAUCET = 'https://www.bnbchain.org/en/testnet-faucet';
const MIN_GAS_BNB = 0.001; // mínimo recomendado para gas en testnet

/** Intenta fondear la wallet con BNB testnet desde el notify-worker. Silencioso si falla. */
async function tryAutoFund(address: string): Promise<boolean> {
  if (!NOTIFY_API || !address) return false;
  try {
    const res = await fetch(`${NOTIFY_API}/auto-fund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { funded?: boolean; txHash?: string };
    return data.funded === true;
  } catch {
    // Network error o worker no disponible — no bloquear el flujo
    return false;
  }
}

export interface HomeHandlersParams {
  walletAddress: string | null | undefined;
  userInfo: UserInfo;
  balances: { tokenBalance: string; bnbBalance: string };
  selectedToken: Token;
  appSigner: Signer | null | undefined;
  adminConnected: boolean;
  adminProvider: unknown;
  confirmFunds: () => Promise<boolean>;
  refetch: () => void;
  clearPendingInvite: () => Promise<void>;
}

export const useHomeHandlers = ({
  walletAddress,
  userInfo,
  balances,
  selectedToken,
  appSigner,
  adminConnected,
  adminProvider,
  confirmFunds,
  refetch,
  clearPendingInvite,
}: HomeHandlersParams) => {
  const { t } = useI18n();

  const {
    isLoading: txLoading,
    registrarHumano,
    solicitarPrestamo,
    pagarPrestamo,
    pagarCuotas,
    depositarLiquidez,
    retirarComisiones,
    retirarComisionesToken,
    pausarContrato,
    declararKyc,
    executeAdminAction,
    confirmAdminAction,
    proposeAddAdmin,
    proposeRemoveAdmin,
    proposeFeeCollector,
    proposeRequiredConfirmations,
    proposeSetTokenConfig,
    proposeFundador,
    proposeOwner,
    liquidarDeudor,
    marcarMorosoSiVencido,
  } = useWeb3Transactions();

  /** Ejecuta una acción admin cambiando temporalmente el signer al de MetaMask/WalletConnect. */
  const runAsAdmin = async (fn: () => Promise<void>) => {
    if (!adminConnected || !adminProvider) {
      Alert.alert(t('admin'), t('appWalletAdminConnect'));
      return;
    }
    try {
      const signer = await getEthersSignerFromProvider(adminProvider as Eip1193Provider);
      if (!signer) throw new Error('admin');
      setWalletSigner(signer);
      await fn();
    } finally {
      if (appSigner) setWalletSigner(appSigner);
    }
  };

  const handleRegistrarHumano = async (padre?: string) => {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return;
    }
    if (userInfo.paused) {
      Alert.alert(t('admin'), t('protocolPaused'));
      return;
    }

    // Intento silencioso de auto-fondeo desde el notify-worker (solo testnet con worker activo).
    // Si el worker no está disponible, simplemente continúa con el saldo actual.
    let localBnbBalance = parseFloat(balances.bnbBalance || '0');
    if (localBnbBalance < MIN_GAS_BNB && isDemoMode()) {
      const funded = await tryAutoFund(walletAddress);
      if (funded) {
        localBnbBalance += 0.005; // el worker envía 0.005 BNB
        void refetch(); // actualiza la UI de forma asíncrona
      }
    }

    // Pre-check: verificar que la app wallet tiene BNB suficiente para gas
    if (localBnbBalance < MIN_GAS_BNB) {
      if (isDemoMode()) {
        Alert.alert(
          t('errNeedGas'),
          t('errNeedGasTestnet'),
          [
            { text: t('cancel'), style: 'cancel' },
            {
              text: t('openFaucet'),
              onPress: () => void Linking.openURL(BSC_TESTNET_FAUCET),
            },
          ]
        );
      } else {
        Alert.alert(t('errNeedGas'), t('errNeedGas'));
      }
      return;
    }
    const result = await registrarHumano(walletAddress, padre);
    if (result.success) {
      await clearPendingInvite();
      refetch();
    }
  };

  const handleSolicitarCredito = async (tier: LoanTier) => {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return;
    }
    if (!(await confirmFunds())) return;
    if (!isContractConfigured()) {
      Alert.alert(t('contract'), t('configureContract'));
      return;
    }
    if (!userInfo.isRegistered) {
      Alert.alert(t('register'), t('activateBeforeLoan'));
      return;
    }
    if (!userInfo.kycDeclarado) {
      Alert.alert(t('kycTitle'), t('kycNeedBeforeLoan'));
      return;
    }
    if (!userInfo.identityBound) {
      Alert.alert(t('otpTitle'), t('otpNeedBeforeLoan'));
      return;
    }
    if (userInfo.hasActiveLoan) {
      Alert.alert(t('activeLoan'), t('loanBusy'));
      return;
    }
    if (tier.id > userInfo.userProgress.nivelActual) {
      Alert.alert(t('loanLockedTitle'), t('loanLockedBody'));
      return;
    }
    if (userInfo.paused) {
      Alert.alert(t('admin'), t('protocolPaused'));
      return;
    }
    if (userInfo.isDelinquent) {
      Alert.alert(t('delinquent'), t('moraBlocked'));
      return;
    }
    if (!userInfo.isTokenSupported) {
      Alert.alert(t('token'), t('tokenNotEnabledAlert'));
      return;
    }
    if (userInfo.userProgress.cooldownRestante > 0) {
      Alert.alert(
        t('cooldownTitle'),
        t('cooldownWait', {
          time: formatCooldown(userInfo.userProgress.cooldownRestante, t('available')),
        })
      );
      return;
    }
    const result = await solicitarPrestamo(selectedToken.address, tier.id);
    if (result.success) refetch();
  };

  const handlePagar = async (kind: 'installment' | 'all' | number) => {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return;
    }
    if (!(await confirmFunds())) return;

    if (!userInfo.activeLoan || userInfo.activeLoan.totalDueWei === '0') {
      Alert.alert(t('noDebt'), t('noActiveLoan'));
      return;
    }

    const loanToken = userInfo.activeLoan.token;
    const left = Math.max(
      1,
      (userInfo.activeLoan.cuotasTotales || 1) - (userInfo.activeLoan.cuotasPagadas || 0)
    );
    const count = kind === 'all' ? left : kind === 'installment' ? 1 : kind;

    if (count >= left) {
      const amountWei = userInfo.activeLoan.remainingWei || userInfo.activeLoan.totalDueWei;
      if (loanToken.toLowerCase() === selectedToken.address.toLowerCase()) {
        const needed = Number(formatUnits(amountWei, selectedToken.decimals));
        if (needed > Number(balances.tokenBalance) + 1e-8) {
          Alert.alert(t('amount'), t('amountExceedsBalance'));
          return;
        }
      }
      const result = await pagarPrestamo(amountWei, loanToken);
      if (result.success) refetch();
      return;
    }

    if (count <= 1) {
      const amountWei =
        userInfo.activeLoan.cuotaWei || userInfo.activeLoan.remainingWei || userInfo.activeLoan.totalDueWei;
      if (loanToken.toLowerCase() === selectedToken.address.toLowerCase()) {
        const needed = Number(formatUnits(amountWei, selectedToken.decimals));
        if (needed > Number(balances.tokenBalance) + 1e-8) {
          Alert.alert(t('amount'), t('amountExceedsBalance'));
          return;
        }
      }
      const result = await pagarPrestamo(amountWei, loanToken);
      if (result.success) refetch();
      return;
    }

    const result = await pagarCuotas(count, loanToken);
    if (result.success) refetch();
  };

  const handleDepositarPool = async (amountHuman: string) => {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return;
    }
    if (!(await confirmFunds())) return;
    if (userInfo.paused) {
      Alert.alert(t('admin'), t('protocolPaused'));
      return;
    }
    if (!userInfo.isTokenSupported) {
      Alert.alert(t('token'), t('tokenNotEnabledAlert'));
      return;
    }
    const parsed = parsePositiveDecimal(amountHuman);
    if (!parsed) {
      Alert.alert(t('amount'), t('amountGreaterZero'));
      return;
    }
    if (Number(parsed) > Number(balances.tokenBalance)) {
      Alert.alert(t('amount'), t('poolNeedInternalFunds'));
      return;
    }
    try {
      const amountWei = parseUnits(parsed, selectedToken.decimals).toString();
      const result = await depositarLiquidez(amountWei, selectedToken.address);
      if (result.success) refetch();
    } catch {
      Alert.alert(t('amount'), t('invalidAmount'));
    }
  };

  const handleRetirarComisiones = async () => {
    await runAsAdmin(async () => {
      const result = await retirarComisiones();
      if (result.success) refetch();
    });
  };

  const handleRetirarComisionesToken = async () => {
    await runAsAdmin(async () => {
      const result = await retirarComisionesToken(selectedToken.address);
      if (result.success) refetch();
    });
  };

  const handleDeclararKyc = async (): Promise<boolean> => {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return false;
    }
    if (!userInfo.isRegistered) {
      Alert.alert(t('register'), t('activateBeforeLoan'));
      return false;
    }
    const result = await declararKyc();
    if (result.success) refetch();
    return result.success;
  };

  const handleExecuteProposal = async (id: number) => {
    await runAsAdmin(async () => {
      const result = await executeAdminAction(id);
      if (result.success) refetch();
    });
  };

  const handleConfirmProposal = async (id: number) => {
    await runAsAdmin(async () => {
      const result = await confirmAdminAction(id);
      if (result.success) refetch();
    });
  };

  const handleProposeAddAdmin = async (address: string) => {
    await runAsAdmin(async () => {
      const result = await proposeAddAdmin(address);
      if (result.success) refetch();
    });
  };

  const handleProposeRemoveAdmin = async (address: string) => {
    await runAsAdmin(async () => {
      const result = await proposeRemoveAdmin(address);
      if (result.success) refetch();
    });
  };

  const handleProposeFeeCollector = async (address: string) => {
    await runAsAdmin(async () => {
      const result = await proposeFeeCollector(address);
      if (result.success) refetch();
    });
  };

  const handleProposeConfirmations = async (required: number) => {
    await runAsAdmin(async () => {
      const result = await proposeRequiredConfirmations(required);
      if (result.success) refetch();
    });
  };

  const handleProposeFundador = async (address: string) => {
    await runAsAdmin(async () => {
      const result = await proposeFundador(address);
      if (result.success) refetch();
    });
  };

  const handleProposeOwner = async (address: string) => {
    await runAsAdmin(async () => {
      const result = await proposeOwner(address);
      if (result.success) refetch();
    });
  };

  const handleProposeSetTokenConfig = async (token: string, feed: string, enabled: boolean) => {
    await runAsAdmin(async () => {
      const result = await proposeSetTokenConfig(token, feed, enabled);
      if (result.success) refetch();
    });
  };

  const handlePausarProtocolo = async () => {
    await runAsAdmin(async () => {
      const result = await pausarContrato();
      if (result.success) refetch();
    });
  };

  const handleLiquidarDeudor = async (debtorAddress: string, tokenAddr: string) => {
    await runAsAdmin(async () => {
      const result = await liquidarDeudor(debtorAddress, tokenAddr);
      if (result.success) refetch();
    });
  };

  const handleMarcarMorosoSiVencido = async (debtorAddress: string) => {
    await runAsAdmin(async () => {
      const result = await marcarMorosoSiVencido(debtorAddress);
      if (result.success) refetch();
    });
  };

  return {
    txLoading,
    handleRegistrarHumano,
    handleSolicitarCredito,
    handlePagar,
    handleDepositarPool,
    handleRetirarComisiones,
    handleRetirarComisionesToken,
    handleDeclararKyc,
    handleExecuteProposal,
    handleConfirmProposal,
    handleProposeAddAdmin,
    handleProposeRemoveAdmin,
    handleProposeFeeCollector,
    handleProposeConfirmations,
    handleProposeFundador,
    handleProposeOwner,
    handleProposeSetTokenConfig,
    handlePausarProtocolo,
    handleLiquidarDeudor,
    handleMarcarMorosoSiVencido,
  };
};
