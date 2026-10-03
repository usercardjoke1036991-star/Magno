/**
 * useHomeHandlers — lógica de cada acción del usuario en la pantalla principal.
 * Extraído de app/index.tsx para reducir complejidad del componente raíz.
 * Cada handler valida precondiciones y delega al hook useWeb3Transactions.
 */
import { useRef } from 'react';
import { Contract, formatUnits, parseEther, parseUnits, type Eip1193Provider, type Signer } from 'ethers';
import { Alert, Linking } from 'react-native';
import { getEthersSignerFromProvider } from '../web3Config';
import { ERC20_ABI } from '../constants/contractConfig';
import { getTokenMeta, isOfficialWorldToken } from '../constants/tokens';
import { setWalletSigner, QuatriviumCreditService } from '../services/quatriviumCreditService';
import { aportarReservaBote, reservaErrorKey } from '../services/reservaService';
import { recordMovement } from '../services/movementHistory';
import { useWeb3Transactions } from './useWeb3Transactions';
import { lockSponsorOnce } from '../services/sponsorLock';
import { notifyApiBases } from '../constants/appLinks';
import { getProviderWithFallback, isAccessPaymentEnabled, isCreditReady, isDemoAccount, isDemoMode, isDonationEnabled, isDonationVisible } from '../constants/rpcConfig';
import { isHttpsUrl } from '../utils/sanitize';
import { showNotice } from '../utils/appNotice';
import { isAltaConfigured } from '../constants/altaConfig';
import { accessPayUsdt, creditNeedsAccess, creditNeedsDeviceMatch, creditNeedsEmail, creditNeedsKyc, creditNeedsPhone, creditNeedsPhrase, hasCreditAccess } from '../utils/creditGates';
import { loadVerifiedEmail } from '../services/accountEmail';
import { isPhoneActive } from '../services/accountPhone';
import { enviarToken, isPhraseBackedUp, loadAppWallet } from '../services/appWallet';
import { signedAuthBody } from '../services/walletAuth';
import { loadRequiredExternalWallet } from '../services/linkedWallet';
import { ensureExternalWalletOnAppChain } from '../utils/walletChain';
import { openWalletConnect } from '../utils/openWalletConnect';
import { cooldownRestanteDesdeTimestamp } from '../utils/creditCooldown';
import { formatCooldown, formatUSD, parsePositiveDecimal } from '../utils/formatters';
import { milestoneBonusUsd } from '../constants/loanTiers';
import { FAMA_CANJE_POR_USDT, usdtFromFama } from '../constants/fama';
import { readJsonLimited, safeJsonFetch } from '../utils/safeFetch';
import { useI18n } from '../i18n/LanguageContext';
import { humanizeTxError } from '../utils/txErrors';
import type { FundsConfirmPurpose } from '../services/fundsConfirm';
import { useAdminTotp } from '../components/AdminTotpHost';
import type { LoanTier, UserInfo } from './useWeb3Balances';
import type { Token } from '../constants/tokens';

const BSC_TESTNET_FAUCET = 'https://www.bnbchain.org/en/testnet-faucet';
const MIN_GAS_WEI = parseEther('0.001');

async function readOnChainBnb(address: string): Promise<bigint | null> {
  try {
    return await getProviderWithFallback().getBalance(address);
  } catch {
    return null;
  }
}

async function waitForBnb(address: string, minWei: bigint, timeoutMs = 25_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const bal = await readOnChainBnb(address);
    if (bal !== null && bal >= minWei) return true;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  const last = await readOnChainBnb(address);
  return last !== null && last >= minWei;
}

async function tokenBalanceOf(token: string, wallet: string): Promise<bigint | null> {
  try {
    const erc20 = new Contract(token, ERC20_ABI, getProviderWithFallback());
    return BigInt(await erc20.balanceOf(wallet));
  } catch {
    return null;
  }
}

type AutoFundResult = 'funded' | 'enough' | 'fail';

async function postAutoFund(base: string, address: string): Promise<AutoFundResult> {
  const root = base.replace(/\/$/, '');
  const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(root);
  if (!local && !isHttpsUrl(root)) return 'fail';
  const signer = await loadAppWallet();
  if (!signer) return 'fail';
  const body = JSON.stringify({
    address,
    ...(await signedAuthBody(signer, address, 'autofund')),
  });
  try {
    const res = local
      ? await fetch(`${root}/auto-fund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body,
        })
      : await safeJsonFetch(`${root}/auto-fund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          timeoutMs: 20_000,
        });
    if (!res.ok) return 'fail';
    const data = await readJsonLimited<{ funded?: boolean }>(res);
    return data.funded === true ? 'funded' : 'enough';
  } catch {
    return 'fail';
  }
}

/** Intenta fondear la wallet con BNB testnet desde el notify-worker. */
async function tryAutoFund(address: string): Promise<AutoFundResult> {
  if (!address) return 'fail';
  const bases = notifyApiBases();
  for (const base of bases) {
    const result = await postAutoFund(base, address);
    if (result !== 'fail') return result;
  }
  return 'fail';
}

export interface HomeHandlersParams {
  walletAddress: string | null | undefined;
  userInfo: UserInfo;
  balances: { tokenBalance: string; bnbBalance: string };
  selectedToken: Token;
  appSigner: Signer | null | undefined;
  adminConnected: boolean;
  adminProvider: unknown;
  adminAddress?: string;
  openExternalWallet?: () => void;
  confirmFunds: (purpose?: FundsConfirmPurpose) => Promise<boolean>;
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
  adminAddress,
  openExternalWallet,
  confirmFunds,
  refetch,
  clearPendingInvite,
}: HomeHandlersParams) => {
  const { t } = useI18n();
  const accesoBusy = useRef(false);
  const { confirmAdminStep } = useAdminTotp();

  const {
    isLoading: txLoading,
    registrarHumano,
    solicitarPrestamo,
    cobrarBonoHito,
    donarProyecto,
    canjearFama,
    canjearFamaRed,
    cobrarBonoRacha,
    pagarPrestamo,
    pagarCuotas,
    depositarLiquidez,
    retirarComisiones,
    retirarComisionesToken,
    pausarContrato,
    despausarContrato,
    cancelAdminAction,
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
    proposeAttester,
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
      try {
        await Promise.race([
          ensureExternalWalletOnAppChain(adminProvider as Eip1193Provider),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('wrong-network')), 25_000);
          }),
        ]);
      } catch (error) {
        Alert.alert(t('connect'), humanizeTxError(error));
        return;
      }
      const signer = await getEthersSignerFromProvider(adminProvider as Eip1193Provider);
      if (!signer) throw new Error('admin');
      const adminWallet = await signer.getAddress();
      const adminBnb = await readOnChainBnb(adminWallet);
      if (adminBnb === null || adminBnb < MIN_GAS_WEI) {
        Alert.alert(t('errNeedGas'), t('errNeedGasAdmin'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('ready'), onPress: () => void Linking.openURL(BSC_TESTNET_FAUCET) },
        ]);
        return;
      }
      if (!(await confirmAdminStep(signer, adminWallet))) {
        Alert.alert(t('admin'), t('adminTotpBlocked'));
        return;
      }
      setWalletSigner(signer);
      await fn();
    } catch (error) {
      Alert.alert(t('admin'), humanizeTxError(error));
    } finally {
      if (appSigner) setWalletSigner(appSigner);
    }
  };

  const ensureGasForTx = async (): Promise<boolean> => {
    if (!walletAddress) return false;
    let onChain = await readOnChainBnb(walletAddress);
    if (onChain === null) {
      const parsed = Number.parseFloat(balances.bnbBalance);
      onChain = Number.isFinite(parsed) && parsed > 0 ? parseEther(parsed.toFixed(6)) : 0n;
    }
    const demoGas = isDemoAccount() || isDemoMode();
    if (onChain < MIN_GAS_WEI && demoGas) {
      showNotice(t('ready'), t('demoLookingGas'));
      const fund = await tryAutoFund(walletAddress);
      if (fund !== 'fail') {
        const funded = await waitForBnb(walletAddress, MIN_GAS_WEI, fund === 'funded' ? 12_000 : 8_000);
        if (funded) {
          void refetch();
          return true;
        }
      }
      const again = await readOnChainBnb(walletAddress);
      if (again !== null) onChain = again;
    }
    if (onChain < MIN_GAS_WEI) {
      if (demoGas) {
        showNotice(t('errNeedGas'), t('errNeedGasTestnet'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('openFaucet'), onPress: () => void Linking.openURL(BSC_TESTNET_FAUCET) },
        ]);
      } else {
        showNotice(t('errNeedGas'), t('errNeedGas'));
      }
      return false;
    }
    return true;
  };

  const ensureCreditReady = (): boolean => {
    if (isCreditReady()) return true;
    showNotice(
      t(isDemoAccount() ? 'contract' : 'appModeLive'),
      t(isDemoAccount() ? 'configureContract' : 'liveCreditNotReady'),
    );
    return false;
  };

  const askToLinkExternal = (message: string) => {
    showNotice(t('linkWalletTitle'), message, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('connectWallet'), onPress: () => void openWalletConnect(() => openExternalWallet?.()) },
    ]);
  };

  const requireLinkedExternal = async (): Promise<string> => {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return '';
    }
    const linked = await loadRequiredExternalWallet(walletAddress);
    if (!linked) {
      askToLinkExternal(t('linkWalletNeedFunds'));
      return '';
    }
    if (!adminConnected || !adminProvider) {
      askToLinkExternal(t('linkWalletNeed'));
      return '';
    }
    if (String(adminAddress || '').toLowerCase() !== linked.toLowerCase()) {
      askToLinkExternal(t('linkWalletMismatch'));
      return '';
    }
    return linked;
  };

  const fundInternalFromExternal = async (amountWei: string, tokenAddress: string): Promise<boolean> => {
    if (!walletAddress) return false;
    const need = BigInt(amountWei);
    if (need <= 0n) return false;
    const internalBal = await tokenBalanceOf(tokenAddress, walletAddress);
    if (internalBal !== null && internalBal >= need) {
      return true;
    }
    const linked = await requireLinkedExternal();
    if (!linked || !adminProvider) return false;
    try {
      await ensureExternalWalletOnAppChain(adminProvider as Eip1193Provider);
    } catch (error) {
      Alert.alert(t('connect'), humanizeTxError(error));
      return false;
    }
    const signer = await getEthersSignerFromProvider(adminProvider as Eip1193Provider);
    if (!signer) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return false;
    }
    if (isDemoAccount()) {
      try {
        await QuatriviumCreditService.mintDemoUsdtTo(tokenAddress, linked, amountWei);
      } catch {
        // Si no hay minteo, se intenta con el saldo de la billetera vinculada.
      }
    }
    const extBal = await tokenBalanceOf(tokenAddress, linked);
    if (extBal !== null && extBal < need) {
      Alert.alert(t('amountExceedsBalance'), t('poolNeedInternalFunds', { symbol: selectedToken.symbol }));
      return false;
    }
    const extBnb = await readOnChainBnb(linked);
    if (extBnb !== null && extBnb < MIN_GAS_WEI) {
      showNotice(t('errNeedGas'), t('errNeedGas'));
      return false;
    }
    try {
      await enviarToken(signer, tokenAddress, walletAddress, amountWei, true);
      return true;
    } catch (error) {
      Alert.alert(t('error'), humanizeTxError(error));
      return false;
    }
  };

  const handleRegistrarHumano = async () => {
    if (!ensureCreditReady()) return;
    if (!walletAddress) {
      showNotice(t('connect'), t('appWalletNotReady'));
      return;
    }
    if (userInfo.paused) {
      showNotice(t('admin'), t('protocolPaused'));
      return;
    }

    if (!(await ensureGasForTx())) return;
    let padre: string | undefined;
    try {
      const locked = await lockSponsorOnce(walletAddress, '');
      padre = locked.padre || undefined;
    } catch {
      padre = undefined;
    }
    const result = await registrarHumano(walletAddress, padre);
    if (result.success) {
      await clearPendingInvite();
      if (isDemoAccount()) {
        try {
          await QuatriviumCreditService.prepareDemoCredit();
        } catch (caught) {
          Alert.alert(t('error'), humanizeTxError(caught) || t('demoPrepFailed'));
        }
      }
      refetch();
    }
  };

  const handleSolicitarCredito = async (tier: LoanTier) => {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return;
    }
    if (!ensureCreditReady()) return;
    if (!userInfo.isRegistered) {
      Alert.alert(t('register'), t('activateBeforeLoan'));
      return;
    }
    const [hasEmail, phraseOk, phoneReady] = await Promise.all([
      loadVerifiedEmail().then((email) => Boolean(email)).catch(() => false),
      isPhraseBackedUp().catch(() => false),
      isPhoneActive().catch(() => false),
    ]);
    if (creditNeedsPhrase(phraseOk)) {
      Alert.alert(t('seedBannerTitle'), t('seedNeedBeforeLoan'));
      return;
    }
    if (creditNeedsAccess(userInfo.donatedUsd || 0)) {
      Alert.alert(t('creditAccessTitle'), t('creditAccessNeed'));
      return;
    }
    if (creditNeedsEmail(hasEmail)) {
      Alert.alert(t('emailTitle'), t('emailNeedBeforeLoan'));
      return;
    }
    if (creditNeedsKyc(userInfo)) {
      Alert.alert(t('kycTitle'), t('kycNeedBeforeLoan'));
      return;
    }
    if (creditNeedsPhone(userInfo, phoneReady)) {
      Alert.alert(t('otpTitle'), t('otpNeedBeforeLoan'));
      return;
    }
    if (creditNeedsDeviceMatch(userInfo.deviceMatches, phoneReady)) {
      Alert.alert(t('deviceBannerTitle'), t('seedNeedDevice'));
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
    const wait = Math.max(
      cooldownRestanteDesdeTimestamp(userInfo.userProgress.ultimoPrestamoTimestamp),
      Number(userInfo.userProgress.cooldownRestante) || 0,
    );
    if (wait > 0) {
      Alert.alert(
        t('cooldownTitle'),
        t('cooldownWait', {
          time: formatCooldown(wait, t('available')),
        })
      );
      return;
    }
    if (!userInfo.isTokenSupported && !isOfficialWorldToken(selectedToken.address)) {
      Alert.alert(t('token'), t('tokenNotEnabledAlert'));
      return;
    }
    if (!(await confirmFunds('loanRequest'))) return;
    if (!(await ensureGasForTx())) return;
    if (isDemoAccount()) {
      try {
        await QuatriviumCreditService.prepareDemoCredit();
      } catch (caught) {
        Alert.alert(t('error'), humanizeTxError(caught) || t('demoPrepFailed'));
        return;
      }
    }
    const result = await solicitarPrestamo(selectedToken.address, tier.id);
    if (!result.success) {
      refetch();
      return;
    }
    if (isDemoAccount()) {
      try {
        const minted = await QuatriviumCreditService.topUpDemoUsdtToDebt(selectedToken.address);
        if (minted) Alert.alert(t('ready'), t('demoUsdtTopUp'));
      } catch (caught) {
        Alert.alert(t('error'), humanizeTxError(caught) || t('demoUsdtTopUpFailed'));
      }
    }
    refetch();
  };

  const handleCobrarBonoHito = async () => {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return;
    }
    if (!ensureCreditReady()) return;
    if (userInfo.paused) {
      Alert.alert(t('admin'), t('protocolPaused'));
      return;
    }
    if (userInfo.isDelinquent) {
      Alert.alert(t('delinquent'), t('moraBlocked'));
      return;
    }
    if (!userInfo.canClaimHitos) {
      Alert.alert(t('toPoolBonus'), t('bonusLegacyContract'));
      return;
    }
    if (!userInfo.userProgress.bonusPending) {
      Alert.alert(t('toPoolBonus'), t('milestoneBonusHint', {
        amount: formatUSD(milestoneBonusUsd(userInfo.userProgress.nextMilestone || 100)),
        level: userInfo.userProgress.nextMilestone || 100,
      }));
      return;
    }
    if (!(await ensureGasForTx())) return;
    const result = await cobrarBonoHito(selectedToken.address);
    if (result.success) {
      const level = userInfo.userProgress.bonusPending;
      void recordMovement(walletAddress, {
        kind: 'bonus',
        from: selectedToken.address,
        to: walletAddress,
        amountLabel: formatUSD(milestoneBonusUsd(level)),
        tokenSymbol: selectedToken.symbol,
        platform: 'Quatrivium',
        timestamp: Date.now(),
      });
      refetch();
    }
  };

  const handleCanjearFama = async (fama: number) => {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return;
    }
    if (!ensureCreditReady()) return;
    if (userInfo.paused) {
      Alert.alert(t('admin'), t('protocolPaused'));
      return;
    }
    if (userInfo.isDelinquent) {
      Alert.alert(t('delinquent'), t('moraBlocked'));
      return;
    }
    if (!userInfo.isRegistered) {
      Alert.alert(t('sectionCreditLine'), t('creditAccessNeed'));
      return;
    }
    if (!userInfo.canCanjearFama) {
      Alert.alert(t('hubCanje'), t('canjeLegacy'));
      return;
    }
    if (!Number.isInteger(fama) || fama < FAMA_CANJE_POR_USDT || fama % FAMA_CANJE_POR_USDT !== 0) {
      Alert.alert(t('amount'), t('invalidAmount'));
      return;
    }
    if (fama > userInfo.famaDisponible) {
      Alert.alert(t('hubCanje'), t('canjeNeed', { points: String(fama - userInfo.famaDisponible) }));
      return;
    }
    if (!(await confirmFunds())) return;
    if (!(await ensureGasForTx())) return;
    const result = await canjearFama(fama);
    if (result.success) {
      void recordMovement(walletAddress, {
        kind: 'bonus',
        from: '',
        to: walletAddress,
        amountLabel: formatUSD(usdtFromFama(fama)),
        tokenSymbol: selectedToken.symbol,
        platform: 'Quatrivium',
        timestamp: Date.now(),
      });
      refetch();
    }
  };

  const handleCanjearFamaRed = async (fama: number) => {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return;
    }
    if (!ensureCreditReady()) return;
    if (userInfo.paused) {
      Alert.alert(t('admin'), t('protocolPaused'));
      return;
    }
    if (userInfo.isDelinquent) {
      Alert.alert(t('delinquent'), t('moraBlocked'));
      return;
    }
    if (!userInfo.isRegistered) {
      Alert.alert(t('sectionCreditLine'), t('creditAccessNeed'));
      return;
    }
    if (!userInfo.canCanjearFama) {
      Alert.alert(t('hubCanje'), t('canjeLegacy'));
      return;
    }
    if (!Number.isInteger(fama) || fama < FAMA_CANJE_POR_USDT || fama % FAMA_CANJE_POR_USDT !== 0) {
      Alert.alert(t('amount'), t('invalidAmount'));
      return;
    }
    if (fama > (userInfo.famaRedDisponible || 0)) {
      Alert.alert(t('hubCanje'), t('canjeNeed', { points: String(fama - (userInfo.famaRedDisponible || 0)) }));
      return;
    }
    if (!(await confirmFunds())) return;
    if (!(await ensureGasForTx())) return;
    const result = await canjearFamaRed(fama);
    if (result.success) {
      void recordMovement(walletAddress, {
        kind: 'bonus',
        from: '',
        to: walletAddress,
        amountLabel: formatUSD(usdtFromFama(fama)),
        tokenSymbol: selectedToken.symbol,
        platform: 'Quatrivium',
        timestamp: Date.now(),
      });
      refetch();
    }
  };

  const handleCobrarBonoRacha = async () => {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return;
    }
    if (!ensureCreditReady()) return;
    if (userInfo.paused) {
      Alert.alert(t('admin'), t('protocolPaused'));
      return;
    }
    if (userInfo.isDelinquent) {
      Alert.alert(t('delinquent'), t('moraBlocked'));
      return;
    }
    if (!userInfo.isRegistered) {
      Alert.alert(t('sectionCreditLine'), t('creditAccessNeed'));
      return;
    }
    if (!userInfo.canRacha) {
      Alert.alert(t('rachaTitle'), t('rachaLegacy'));
      return;
    }
    if (!(userInfo.racha?.bonoPendienteUsd > 0)) {
      Alert.alert(t('rachaTitle'), t('rachaNothing'));
      return;
    }
    if (!(await confirmFunds())) return;
    if (!(await ensureGasForTx())) return;
    const result = await cobrarBonoRacha();
    if (result.success) {
      void recordMovement(walletAddress, {
        kind: 'bonus',
        from: '',
        to: walletAddress,
        amountLabel: formatUSD(userInfo.racha.bonoPendienteUsd),
        tokenSymbol: selectedToken.symbol,
        platform: 'Quatrivium',
        timestamp: Date.now(),
      });
      refetch();
    }
  };

  const handlePagar = async (kind: 'installment' | 'all' | number) => {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return;
    }
    if (!ensureCreditReady()) return;

    if (!userInfo.activeLoan || userInfo.activeLoan.totalDueWei === '0') {
      Alert.alert(t('noDebt'), t('noActiveLoan'));
      return;
    }
    if (!(await confirmFunds('loanPay'))) return;
    if (!(await ensureGasForTx())) return;

    const loanToken = userInfo.activeLoan.token;
    if (isDemoAccount()) {
      try {
        await QuatriviumCreditService.topUpDemoUsdtToDebt(
          loanToken,
          userInfo.activeLoan.remainingWei || userInfo.activeLoan.totalDueWei
        );
        void refetch();
      } catch (caught) {
        Alert.alert(t('error'), humanizeTxError(caught) || t('demoUsdtTopUpFailed'));
        return;
      }
    }
    const left = Math.max(
      1,
      (userInfo.activeLoan.cuotasTotales || 1) - (userInfo.activeLoan.cuotasPagadas || 0)
    );
    const count = kind === 'all' ? left : kind === 'installment' ? 1 : kind;

    const assertEnoughToPay = async (amountWei: string) => {
      if (isDemoAccount() || !walletAddress) return true;
      const meta = getTokenMeta(loanToken) || selectedToken;
      const raw = await tokenBalanceOf(loanToken, walletAddress);
      let available: number;
      if (raw !== null) {
        available = Number(formatUnits(raw, meta.decimals));
      } else if (loanToken.toLowerCase() === selectedToken.address.toLowerCase()) {
        available = Number(balances.tokenBalance);
      } else {
        Alert.alert(t('error'), t('errRpcNoContract'));
        return false;
      }
      const needed = Number(formatUnits(amountWei, meta.decimals));
      if (needed > available + 1e-8) {
        Alert.alert(t('amount'), t('amountExceedsBalance'));
        return false;
      }
      return true;
    };

    if (count >= left) {
      const amountWei = userInfo.activeLoan.remainingWei || userInfo.activeLoan.totalDueWei;
      if (!(await assertEnoughToPay(amountWei))) return;
      const result = await pagarPrestamo(amountWei, loanToken);
      if (result.success) refetch();
      return;
    }

    if (count <= 1) {
      const amountWei =
        userInfo.activeLoan.cuotaWei || userInfo.activeLoan.remainingWei || userInfo.activeLoan.totalDueWei;
      if (!(await assertEnoughToPay(amountWei))) return;
      const result = await pagarPrestamo(amountWei, loanToken);
      if (result.success) refetch();
      return;
    }

    let multiWei = userInfo.activeLoan.remainingWei || userInfo.activeLoan.totalDueWei;
    try {
      const cuota = BigInt(userInfo.activeLoan.cuotaWei || '0');
      const remaining = BigInt(userInfo.activeLoan.remainingWei || userInfo.activeLoan.totalDueWei || '0');
      const planned = cuota * BigInt(count);
      multiWei = (planned > 0n && planned < remaining ? planned : remaining).toString();
    } catch {
      // se usa remainingWei
    }
    if (!(await assertEnoughToPay(multiWei))) return;
    const result = await pagarCuotas(count, loanToken);
    if (result.success) refetch();
  };

  const handleDepositarPool = async (amountHuman: string) => {
    if (isDemoAccount()) {
      Alert.alert(t('sectionPool'), t('poolRealOnly'));
      return;
    }
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return;
    }
    if (!ensureCreditReady()) return;
    if (userInfo.paused) {
      Alert.alert(t('admin'), t('protocolPaused'));
      return;
    }
    if (!userInfo.isTokenSupported && !isOfficialWorldToken(selectedToken.address)) {
      Alert.alert(t('token'), t('tokenNotEnabledAlert'));
      return;
    }
    const parsed = parsePositiveDecimal(amountHuman);
    if (!parsed) {
      Alert.alert(t('amount'), t('amountGreaterZero'));
      return;
    }
    if (!(await confirmFunds())) return;
    try {
      const amountWei = parseUnits(parsed, selectedToken.decimals).toString();
      if (!(await fundInternalFromExternal(amountWei, selectedToken.address))) return;
      if (!(await ensureGasForTx())) return;
      const result = await depositarLiquidez(amountWei, selectedToken.address);
      if (result.success) refetch();
    } catch {
      Alert.alert(t('amount'), t('invalidAmount'));
    }
  };

  const handlePagarAcceso = async () => {
    if (isDemoAccount() && !isAltaConfigured()) return;
    if (accesoBusy.current) return;
    accesoBusy.current = true;
    try {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return;
    }
    if (!userInfo.founderAddress) {
      Alert.alert(t('creditAccessTitle'), t('creditAccessPending'));
      return;
    }
    if (!isAltaConfigured() && !isAccessPaymentEnabled()) {
      Alert.alert(t('creditAccessTitle'), t('creditAccessPending'));
      return;
    }
    if (!ensureCreditReady()) return;
    if (hasCreditAccess(Number(userInfo.donatedUsd || 0))) return;
    if (walletAddress && (await QuatriviumCreditService.altaPagada(walletAddress))) return;
    if (!isAltaConfigured() && !userInfo.canDonate) {
      Alert.alert(t('creditAccessTitle'), t('creditAccessPending'));
      return;
    }
    if (!userInfo.isTokenSupported && !isOfficialWorldToken(selectedToken.address)) {
      Alert.alert(t('token'), t('tokenNotEnabledAlert'));
      return;
    }
    const amount = String(accessPayUsdt());
    const amountWei = parseUnits(amount, selectedToken.decimals).toString();
    if (!(await confirmFunds())) return;
    if (!(await fundInternalFromExternal(amountWei, selectedToken.address))) return;
    if (!(await ensureGasForTx())) return;
    try {
      const result = isAltaConfigured()
        ? { success: Boolean(await QuatriviumCreditService.pagarRegistroAlta(selectedToken.address)) }
        : await donarProyecto(amountWei, selectedToken.address);
      if (result.success) {
        void recordMovement(walletAddress, {
          kind: 'access',
          from: walletAddress,
          to: '',
          amountLabel: `${amount} ${selectedToken.symbol}`,
          tokenSymbol: selectedToken.symbol,
          platform: 'Quatrivium',
          timestamp: Date.now(),
        });
        refetch();
        Alert.alert(t('creditAccessTitle'), t('creditAccessDone'));
      }
    } catch {
      Alert.alert(t('amount'), t('invalidAmount'));
    }
    } finally {
      accesoBusy.current = false;
    }
  };

  const handleAportarReserva = async (amountHuman: string) => {
    const parsed = parsePositiveDecimal(amountHuman);
    if (!parsed) {
      Alert.alert(t('amount'), t('amountGreaterZero'));
      return;
    }
    if (!(await confirmFunds())) return;
    try {
      await runAsAdmin(async () => {
        const signer = await getEthersSignerFromProvider(adminProvider as Eip1193Provider);
        if (!signer) throw new Error('admin');
        await aportarReservaBote(signer, parsed);
        showNotice(t('ready'), t('reservaAdminPotOk'));
        refetch();
      });
    } catch (error) {
      Alert.alert(t('error'), t(reservaErrorKey(error)));
    }
  };

  const handleDonar = async (amountHuman: string) => {
    if (!isDonationVisible()) {
      Alert.alert(t('donateTitle'), t('donateRealOnly'));
      return;
    }
    if (!userInfo.founderAddress) {
      Alert.alert(t('donateTitle'), t('donateWalletPending'));
      return;
    }
    if (!isDonationEnabled()) {
      Alert.alert(t('donateTitle'), t('liveCreditNotReady'));
      return;
    }
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return;
    }
    if (!ensureCreditReady()) return;
    if (!userInfo.canDonate) {
      Alert.alert(t('donateTitle'), t('bonusLegacyContract'));
      return;
    }
    if (!userInfo.isTokenSupported && !isOfficialWorldToken(selectedToken.address)) {
      Alert.alert(t('token'), t('tokenNotEnabledAlert'));
      return;
    }
    const parsed = parsePositiveDecimal(amountHuman);
    if (!parsed) {
      Alert.alert(t('amount'), t('amountGreaterZero'));
      return;
    }
    if (!(await confirmFunds())) return;
    try {
      const amountWei = parseUnits(parsed, selectedToken.decimals).toString();
      if (!(await fundInternalFromExternal(amountWei, selectedToken.address))) return;
      if (!(await ensureGasForTx())) return;
      const result = await donarProyecto(amountWei, selectedToken.address);
      if (result.success) {
        void recordMovement(walletAddress, {
          kind: 'donation',
          from: walletAddress,
          to: '',
          amountLabel: `${parsed} ${selectedToken.symbol}`,
          tokenSymbol: selectedToken.symbol,
          platform: 'Quatrivium',
          timestamp: Date.now(),
        });
        refetch();
      }
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
    if (!ensureCreditReady()) return false;
    if (!walletAddress) {
      Alert.alert(t('connect'), t('appWalletNotReady'));
      return false;
    }
    if (!userInfo.isRegistered) {
      Alert.alert(t('register'), t('activateBeforeLoan'));
      return false;
    }
    if (!(await ensureGasForTx())) return false;
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

  const handleProposeAttester = async (address: string) => {
    await runAsAdmin(async () => {
      const result = await proposeAttester(address);
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

  const handleDespausarProtocolo = async () => {
    await runAsAdmin(async () => {
      const result = await despausarContrato();
      if (result.success) refetch();
    });
  };

  const handleCancelProposal = async (id: number) => {
    await runAsAdmin(async () => {
      const result = await cancelAdminAction(id);
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
    handleCobrarBonoHito,
    handleCanjearFama,
    handleCanjearFamaRed,
    handleCobrarBonoRacha,
    handlePagar,
    handleDepositarPool,
    handlePagarAcceso,
    handleDonar,
    handleAportarReserva,
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
    handleProposeAttester,
    handleProposeSetTokenConfig,
    handlePausarProtocolo,
    handleDespausarProtocolo,
    handleCancelProposal,
    handleLiquidarDeudor,
    handleMarcarMorosoSiVencido,
  };
};
