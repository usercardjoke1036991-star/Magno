import AsyncStorage from '@react-native-async-storage/async-storage';
import { Contract, formatEther, formatUnits, isAddress } from 'ethers';
import { useEffect, useState, useCallback, useRef } from 'react';
import { CONTRACT_ABI, ERC20_ABI, getContractAddress } from '../constants/contractConfig';
import { assertTrustedRpc, isContractConfigured, NETWORK_CONFIG, subscribeRuntimeMode } from '../constants/rpcConfig';
import { getTokenMeta, type Token } from '../constants/tokens';
import { LOAN_TIERS, overlayOnChainTier, type LoanTier } from '../constants/loanTiers';
import { describeAdminCalldata, type OpenAdminProposal } from '../utils/adminProposal';
import { QuatriviumCreditService } from '../services/quatriviumCreditService';
import {
  REFERRAL_BONUS_THRESHOLD,
  REFERRAL_REPUTATION_POINTS,
} from '../constants/reputation';
import { cooldownRestanteDesdeTimestamp } from '../utils/creditCooldown';

const logErr = __DEV__ ? console.log.bind(console) : () => {};
const logWarn = __DEV__ ? console.warn.bind(console) : () => {};

function creditStatusKey(wallet: string): string {
  return `quatrivium.creditStatus.${NETWORK_CONFIG.chainId}.${wallet.toLowerCase()}`;
}

function persistCreditStatus(wallet: string, isRegistered: boolean, hasActiveLoan: boolean) {
  AsyncStorage.setItem(
    creditStatusKey(wallet),
    JSON.stringify({ isRegistered, hasActiveLoan })
  ).catch(() => {});
}

export type { Token, LoanTier };

export interface UserBalances {
  bnbBalance: string;
  tokenBalance: string;
  poolBalance: string;
  poolOutstanding: string;
  poolCash: string;
  lpBalance: string;
}

export interface ActiveLoan {
  tierId: number;
  principalWei: string;
  totalDueWei: string;
  totalDueLabel: string;
  remainingWei: string;
  cuotaWei: string;
  cuotaLabel: string;
  remainingLabel: string;
  cuotasPagadas: number;
  cuotasTotales: number;
  proximaCuota: number;
  token: string;
  tokenSymbol: string;
  vencimiento: number;
}

export interface UserInfo {
  hasActiveLoan: boolean;
  isRegistered: boolean;
  isTokenSupported: boolean;
  reputation: number;
  networkPoints: number;
  networkBonusesPaid: number;
  networkBonusThreshold: number;
  referralPoints: number;
  isDelinquent: boolean;
  creditHistory: {
    paidOnTime: number;
    missedLoans: number;
    penalties: number;
  };
  userProgress: {
    nivelActual: number;
    solicitudesCompletadas: number;
    ultimoPrestamoTimestamp: number;
    cooldownRestante: number;
  };
  isOwner: boolean;
  isAdmin: boolean;
  paused: boolean;
  curveRateBps: number;
  kycDeclarado: boolean;
  kycExigido: boolean;
  identityBound: boolean;
  identidadExigida: boolean;
  adminRoster: string[];
  requiredConfirmations: number;
  proposalCount: number;
  openProposal: OpenAdminProposal | null;
  founderAddress: string;
  activeLoan: ActiveLoan | null;
  referral: {
    padre: string;
    fundador: string;
    isFundador: boolean;
    bonoActivacionCobrado: boolean;
    royaltiesCongeladas: boolean;
  };
}

const EMPTY_BALANCES: UserBalances = {
  bnbBalance: '0.00',
  tokenBalance: '0.00',
  poolBalance: '0.00',
  poolOutstanding: '0.00',
  poolCash: '0.00',
  lpBalance: '0.00',
};

const EMPTY_USER_INFO: UserInfo = {
  hasActiveLoan: false,
  isRegistered: false,
  isTokenSupported: false,
  reputation: 0,
  networkPoints: 0,
  networkBonusesPaid: 0,
  networkBonusThreshold: REFERRAL_BONUS_THRESHOLD,
  referralPoints: REFERRAL_REPUTATION_POINTS,
  isDelinquent: false,
  creditHistory: { paidOnTime: 0, missedLoans: 0, penalties: 0 },
  userProgress: { nivelActual: 1, solicitudesCompletadas: 0, ultimoPrestamoTimestamp: 0, cooldownRestante: 0 },
  isOwner: false,
  isAdmin: false,
  paused: false,
  curveRateBps: 0,
  kycDeclarado: false,
  kycExigido: false,
  identityBound: false,
  identidadExigida: false,
  adminRoster: [],
  requiredConfirmations: 1,
  proposalCount: 0,
  openProposal: null,
  founderAddress: '',
  activeLoan: null,
  referral: {
    padre: '',
    fundador: '',
    isFundador: false,
    bonoActivacionCobrado: false,
    royaltiesCongeladas: false,
  },
};

function formatDue(amountWei: bigint, decimals: number, symbol: string): string {
  const formatted = Number(formatUnits(amountWei, decimals)).toFixed(4);
  return `${formatted} ${symbol}`;
}

export const useWeb3Balances = (walletAddress: string, selectedToken: Token) => {
  const [balances, setBalances] = useState<UserBalances>(EMPTY_BALANCES);
  const [userInfo, setUserInfo] = useState<UserInfo>(EMPTY_USER_INFO);
  const [loanTiers, setLoanTiers] = useState<LoanTier[]>(LOAN_TIERS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchGen = useRef(0);
  const tokenAddress = selectedToken.address;
  const tokenDecimals = selectedToken.decimals;

  const fetchBalances = useCallback(async (opts?: { silent?: boolean }) => {
    const gen = ++fetchGen.current;
    const live = () => gen === fetchGen.current;

    if (!opts?.silent) setIsLoading(true);
    setError(null);

    try {
      const provider = await assertTrustedRpc();
      if (!live()) return;
      let decimals = tokenDecimals;
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
      try {
        decimals = Number(await tokenContract.decimals());
      } catch {
        // usar decimales configurados
      }

      let poolBalance = '0.00';
      let poolOutstanding = '0.00';
      let poolCash = '0.00';
      let isTokenSupported = false;
      let curveRateBps = 0;
      let kycExigido = false;
      if (isContractConfigured()) {
        try {
          const creditContract = new Contract(getContractAddress(), CONTRACT_ABI, provider);
          try {
            isTokenSupported = Boolean(await creditContract.isSupportedToken(tokenAddress));
          } catch {
            isTokenSupported = false;
          }
          try {
            curveRateBps = Number(await creditContract.obtenerTasaInteresActual(tokenAddress));
          } catch {
            curveRateBps = 0;
          }
          try {
            kycExigido = Boolean(await creditContract.kycExigido());
          } catch {
            kycExigido = false;
          }
          try {
            const nav = (await creditContract.totalLiquidity(tokenAddress)) as bigint;
            let outstanding = 0n;
            try {
              outstanding = (await creditContract.outstandingLoans(tokenAddress)) as bigint;
            } catch {
              outstanding = 0n;
            }
            poolBalance = Number(formatUnits(nav, decimals)).toFixed(2);
            poolOutstanding = Number(formatUnits(outstanding, decimals)).toFixed(2);
            poolCash = Number(formatUnits(nav > outstanding ? nav - outstanding : 0n, decimals)).toFixed(2);
          } catch {
            const poolHeld = (await tokenContract.balanceOf(getContractAddress())) as bigint;
            poolBalance = Number(formatUnits(poolHeld, decimals)).toFixed(2);
            poolCash = poolBalance;
          }
        } catch {
          // contrato no disponible
        }
      }

      if (!walletAddress || !isAddress(walletAddress)) {
        if (!live()) return;
        setUserInfo({ ...EMPTY_USER_INFO, isTokenSupported, curveRateBps, kycExigido });
        setBalances({ ...EMPTY_BALANCES, poolBalance, poolOutstanding, poolCash });
        return;
      }

      try {
        const bnb = await provider.getBalance(walletAddress);
        if (!live()) return;
        setBalances((prev) => ({
          ...prev,
          bnbBalance: Number(formatEther(bnb)).toFixed(4),
          poolBalance,
          poolOutstanding,
          poolCash,
        }));
      } catch (e) {
        logErr('Error fetching BNB balance:', e);
        setBalances((prev) => ({ ...prev, bnbBalance: '0.00', poolBalance, poolOutstanding, poolCash }));
      }

      try {
        const bal = (await tokenContract.balanceOf(walletAddress)) as bigint;
        setBalances((prev) => ({
          ...prev,
          tokenBalance: Number(formatUnits(bal, decimals)).toFixed(4),
          poolBalance,
          poolOutstanding,
          poolCash,
        }));
      } catch (e) {
        logErr('Error fetching token balances:', e);
        setBalances((prev) => ({
          ...prev,
          tokenBalance: '0.00',
          poolBalance,
          poolOutstanding,
          poolCash,
        }));
      }

      if (!live()) return;

      if (!isContractConfigured()) {
        setUserInfo((prev) => {
          if (
            !prev.isRegistered &&
            !prev.hasActiveLoan &&
            !prev.kycDeclarado &&
            !prev.identityBound &&
            prev.userProgress.solicitudesCompletadas === 0
          ) {
            return prev;
          }
          return { ...EMPTY_USER_INFO };
        });
        setLoanTiers(LOAN_TIERS);
        setBalances((prev) => {
          if (
            prev.poolBalance === EMPTY_BALANCES.poolBalance &&
            prev.poolOutstanding === EMPTY_BALANCES.poolOutstanding &&
            prev.poolCash === EMPTY_BALANCES.poolCash &&
            prev.lpBalance === EMPTY_BALANCES.lpBalance
          ) {
            return prev;
          }
          return {
            ...prev,
            poolBalance: EMPTY_BALANCES.poolBalance,
            poolOutstanding: EMPTY_BALANCES.poolOutstanding,
            poolCash: EMPTY_BALANCES.poolCash,
            lpBalance: EMPTY_BALANCES.lpBalance,
          };
        });
        return;
      }

      setUserInfo((prev) => ({ ...prev, isTokenSupported, curveRateBps, kycExigido }));

      try {
        const creditContract = new Contract(getContractAddress(), CONTRACT_ABI, provider);
        if (!live()) return;

        try {
          const [loan, registeredFlag] = await Promise.all([
            creditContract.usuarios(walletAddress).catch(() => null),
            creditContract.humanosVerificados(walletAddress).catch(() => null),
          ]);
          if (!live()) return;

          const principal = loan ? BigInt(loan.montoActivo) : 0n;
          const hasLoan = principal > 0n;
          let activeLoan: ActiveLoan | null = null;

          if (loan && principal > 0n) {
            let totalDue = principal;
            try {
              const debt = await creditContract.obtenerDeuda(walletAddress);
              totalDue = BigInt(debt.total);
            } catch {
              const tasa = BigInt(loan.tasaAplicadaBP);
              totalDue = principal + (principal * tasa) / 10000n;
            }

            const loanToken = String(loan.monedaActivo || tokenAddress).toLowerCase();
            const meta = getTokenMeta(loanToken);
            const loanDecimals = meta?.decimals ?? decimals;
            const loanSymbol = meta?.symbol ?? 'TOKEN';

            let remainingWei = totalDue.toString();
            let cuotaWei = totalDue.toString();
            let cuotasPagadas = 0;
            let cuotasTotales = 1;
            let proximaCuota = Number(loan.vencimiento);
            try {
              const plan = await creditContract.planPago(walletAddress);
              const pagado = BigInt(plan.pagado);
              const restantes = totalDue > pagado ? totalDue - pagado : 0n;
              const totales = Math.max(1, Number(plan.totales) || 1);
              const pagadas = Number(plan.pagadas);
              const left = Math.max(1, totales - pagadas);
              remainingWei = restantes.toString();
              cuotaWei = (left <= 1 ? restantes : restantes / BigInt(left)).toString();
              cuotasPagadas = pagadas;
              cuotasTotales = totales;
              proximaCuota = Number(plan.venceCuota) || Number(loan.vencimiento);
            } catch {
              // contrato anterior sin plan de cuotas
            }

            activeLoan = {
              tierId: Number(loan.nivelActual || 0),
              principalWei: principal.toString(),
              totalDueWei: totalDue.toString(),
              totalDueLabel: formatDue(totalDue, loanDecimals, loanSymbol),
              remainingWei,
              cuotaWei,
              cuotaLabel: formatDue(BigInt(cuotaWei), loanDecimals, loanSymbol),
              remainingLabel: formatDue(BigInt(remainingWei), loanDecimals, loanSymbol),
              cuotasPagadas,
              cuotasTotales,
              proximaCuota,
              token: loanToken,
              tokenSymbol: loanSymbol,
              vencimiento: Number(loan.vencimiento),
            };
          }

          const nowSec = Math.floor(Date.now() / 1000);
          const overdue = Boolean(
            activeLoan
            && (
              (activeLoan.vencimiento > 0 && nowSec > activeLoan.vencimiento)
              || (activeLoan.proximaCuota > 0 && nowSec > activeLoan.proximaCuota)
            )
          );
          const registered = Boolean(registeredFlag) || hasLoan;

          setUserInfo((prev) => ({
            ...prev,
            hasActiveLoan: hasLoan,
            activeLoan,
            isDelinquent: overdue,
            isRegistered: registered || prev.isRegistered,
          }));
          persistCreditStatus(walletAddress, registered, hasLoan);
        } catch (e) {
          logErr('Error fetching user loan status:', e);
        }

        try {
          const rows = await Promise.all(
            LOAN_TIERS.map(async (base) => {
              try {
                const row = await creditContract.niveles(base.id);
                return overlayOnChainTier(base, BigInt(row[0]), BigInt(row[1]), BigInt(row[2]));
              } catch {
                return base;
              }
            })
          );
          if (live()) setLoanTiers(rows);
        } catch {
          if (live()) setLoanTiers(LOAN_TIERS);
        }

        try {
          const supported = Boolean(await creditContract.isSupportedToken(tokenAddress));
          let nextCurve = 0;
          try {
            nextCurve = Number(await creditContract.obtenerTasaInteresActual(tokenAddress));
          } catch {
            nextCurve = 0;
          }
          setUserInfo((prev) => ({ ...prev, isTokenSupported: supported, curveRateBps: nextCurve }));
        } catch (e) {
          logWarn('isSupportedToken failed:', e);
          setUserInfo((prev) => ({ ...prev, isTokenSupported: false }));
        }

        try {
          const lpValue = (await creditContract.valorLp(walletAddress, tokenAddress)) as bigint;
          setBalances((prev) => ({
            ...prev,
            lpBalance: Number(formatUnits(lpValue, decimals)).toFixed(4),
          }));
        } catch (e) {
          logWarn('valorLp failed:', e);
          setBalances((prev) => ({ ...prev, lpBalance: '0.00' }));
        }

        try {
          const nav = (await creditContract.totalLiquidity(tokenAddress)) as bigint;
          let outstanding = 0n;
          try {
            outstanding = (await creditContract.outstandingLoans(tokenAddress)) as bigint;
          } catch {
            outstanding = 0n;
          }
          setBalances((prev) => ({
            ...prev,
            poolBalance: Number(formatUnits(nav, decimals)).toFixed(2),
            poolOutstanding: Number(formatUnits(outstanding, decimals)).toFixed(2),
            poolCash: Number(formatUnits(nav > outstanding ? nav - outstanding : 0n, decimals)).toFixed(2),
          }));
        } catch {
          // keep ERC20 cash fallback already set
        }

        try {
          let declared = false;
          let required = false;
          try {
            required = Boolean(await creditContract.kycExigido());
          } catch {
            required = false;
          }
          try {
            declared = Boolean(await creditContract.kycDeclarado(walletAddress));
          } catch {
            declared = false;
          }
          setUserInfo((prev) => ({ ...prev, kycDeclarado: declared, kycExigido: required }));
        } catch {
          setUserInfo((prev) => ({ ...prev, kycDeclarado: false, kycExigido: false }));
        }

        try {
          let requiredIdentity = false;
          let bound = false;
          try {
            requiredIdentity = Boolean(await creditContract.identidadExigida());
          } catch {
            requiredIdentity = false;
          }
          try {
            const phoneHash = String(await creditContract.phoneHashOf(walletAddress) || '');
            bound = Boolean(phoneHash) && !/^0x0+$/.test(phoneHash);
          } catch {
            bound = false;
          }
          setUserInfo((prev) => ({ ...prev, identidadExigida: requiredIdentity, identityBound: bound }));
        } catch {
          setUserInfo((prev) => ({ ...prev, identidadExigida: false, identityBound: false }));
        }

        try {
          const history = await creditContract.obtenerHistorialUsuario(walletAddress);
          setUserInfo((prev) => {
            const loan = prev.activeLoan;
            const nowSec = Math.floor(Date.now() / 1000);
            const overdue = Boolean(
              loan
              && (
                (loan.vencimiento > 0 && nowSec > loan.vencimiento)
                || (loan.proximaCuota > 0 && nowSec > loan.proximaCuota)
              )
            );
            return {
              ...prev,
              reputation: Number(history.puntosReputacion ?? history[0]),
              isDelinquent: Boolean(history.moroso ?? history[1]) || overdue,
              creditHistory: {
                paidOnTime: Number(history.pagadosATiempo ?? history[2]),
                missedLoans: Number(history.morosos ?? history[3]),
                penalties: Number(history.totalPenalizaciones ?? history[4]),
              },
            };
          });
        } catch (e) {
          logErr('Error fetching credit history:', e);
        }

        try {
          const red = await creditContract.obtenerRedReputacion(walletAddress);
          setUserInfo((prev) => ({
            ...prev,
            networkPoints: Number(red.puntos ?? red[0] ?? 0),
            networkBonusesPaid: Number(red.bonosCobrados ?? red[1] ?? 0),
            networkBonusThreshold: Number(red.umbral ?? red[2] ?? REFERRAL_BONUS_THRESHOLD) || REFERRAL_BONUS_THRESHOLD,
            referralPoints: Number(red.puntosPorReferido ?? red[4] ?? REFERRAL_REPUTATION_POINTS) || REFERRAL_REPUTATION_POINTS,
          }));
        } catch {
          // Contrato desplegado antes de los bonos de red.
        }

        try {
          const progress = await QuatriviumCreditService.obtenerProgresoUsuario(walletAddress);
          const lastTs = Number(progress.ultimoPrestamoTimestamp);
          const cooldown = cooldownRestanteDesdeTimestamp(lastTs);
          const currentLevel = Number(progress.nivelActual) > 0 ? Number(progress.nivelActual) : 1;

          setUserInfo((prev) => ({
            ...prev,
            userProgress: {
              nivelActual: currentLevel,
              solicitudesCompletadas: Number(progress.solicitudesCompletadas),
              ultimoPrestamoTimestamp: lastTs,
              cooldownRestante: cooldown,
            },
          }));
        } catch (e) {
          logErr('Error fetching user progress:', e);
        }

        try {
          const ownerAddress = await QuatriviumCreditService.obtenerOwner();
          let isAdmin = false;
          let paused = false;
          try {
            isAdmin = Boolean(await creditContract.admins(walletAddress));
          } catch {
            isAdmin = walletAddress.toLowerCase() === String(ownerAddress).toLowerCase();
          }
          try {
            paused = Boolean(await creditContract.paused());
          } catch {
            paused = false;
          }
          setUserInfo((prev) => ({
            ...prev,
            isOwner: walletAddress.toLowerCase() === String(ownerAddress).toLowerCase(),
            isAdmin: isAdmin || walletAddress.toLowerCase() === String(ownerAddress).toLowerCase(),
            paused,
          }));
          const roster: string[] = [];
          for (let i = 0; i < 3; i += 1) {
            try {
              const item = String(await creditContract.ownerList(i));
              if (item && !/^0x0+$/i.test(item)) roster.push(item);
            } catch {
              break;
            }
          }
          let confirms = 1;
          let proposals = 0;
          try {
            confirms = Number(await creditContract.requiredConfirmations()) || 1;
          } catch {
            confirms = 1;
          }
          try {
            proposals = Number(await creditContract.proposalCount()) || 0;
          } catch {
            proposals = 0;
          }
          let openProposal: OpenAdminProposal | null = null;
          for (let id = proposals; id >= 1 && id >= proposals - 12; id -= 1) {
            try {
              const row = await creditContract.proposals(id);
              const executed = Boolean(row.executed ?? row[4]);
              const cancelled = Boolean(row.cancelled ?? row[5]);
              const eta = Number(row.eta ?? row[1]);
              if (executed || cancelled || eta <= 0) continue;
              openProposal = {
                id,
                selector: describeAdminCalldata(String(row.data ?? row[2] ?? '0x')),
                eta,
                confirms: Number((row.confirms ?? row[3]) || 0),
                executed,
                cancelled,
              };
              break;
            } catch {
              continue;
            }
          }
          setUserInfo((prev) => ({
            ...prev,
            adminRoster: roster,
            requiredConfirmations: confirms,
            proposalCount: proposals,
            openProposal,
          }));
        } catch (e) {
          logErr('Error fetching owner status:', e);
          setUserInfo((prev) => ({ ...prev, isOwner: false, isAdmin: false }));
        }

        try {
          let fundador = '';
          try {
            fundador = String(await creditContract.fundador());
          } catch {
            fundador = '';
          }
          let padre = '';
          let bonoActivacionCobrado = false;
          try {
            const nodo = await creditContract.redGenealogica(walletAddress);
            padre = String(nodo.padre ?? nodo[0] ?? '');
            bonoActivacionCobrado = Boolean(nodo.bonoActivacionCobrado ?? nodo[1]);
          } catch {
            padre = '';
          }
          let royaltiesCongeladas = false;
          try {
            royaltiesCongeladas = Boolean(await creditContract.dispersionCongelada(walletAddress));
          } catch {
            royaltiesCongeladas = false;
          }
          setUserInfo((prev) => ({
            ...prev,
            founderAddress: fundador,
            referral: {
              padre,
              fundador,
              isFundador:
                Boolean(fundador) && walletAddress.toLowerCase() === fundador.toLowerCase(),
              bonoActivacionCobrado,
              royaltiesCongeladas,
            },
          }));
        } catch (e) {
          logErr('Error fetching referral network:', e);
        }
      } catch (e) {
        logErr('Error fetching protocol info:', e);
      }
    } catch (fetchError) {
      if (!live()) return;
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Failed to fetch balances';
      setError(errorMessage);
      if (!isContractConfigured()) {
        setUserInfo((prev) => {
          if (
            !prev.isRegistered &&
            !prev.hasActiveLoan &&
            !prev.kycDeclarado &&
            !prev.identityBound &&
            prev.userProgress.solicitudesCompletadas === 0
          ) {
            return prev;
          }
          return { ...EMPTY_USER_INFO };
        });
        setLoanTiers(LOAN_TIERS);
      }
    } finally {
      if (live()) setIsLoading(false);
    }
  }, [walletAddress, tokenAddress, tokenDecimals]);

  useEffect(() => {
    if (!walletAddress || !isAddress(walletAddress)) return;
    AsyncStorage.getItem(creditStatusKey(walletAddress))
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as { isRegistered?: boolean; hasActiveLoan?: boolean };
        setUserInfo((prev) => ({
          ...prev,
          isRegistered: Boolean(saved.isRegistered) || prev.isRegistered,
          hasActiveLoan: Boolean(saved.hasActiveLoan),
        }));
      })
      .catch(() => {});
  }, [walletAddress]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  useEffect(() => subscribeRuntimeMode(() => {
    fetchBalances();
  }), [fetchBalances]);

  // Auto-refresh cada 30 s cuando hay wallet conectada para mantener el saldo al día
  useEffect(() => {
    if (!walletAddress) return;
    const id = setInterval(() => { void fetchBalances({ silent: true }); }, 30_000);
    return () => clearInterval(id);
  }, [walletAddress, fetchBalances]);

  return {
    balances,
    userInfo,
    loanTiers,
    isLoading,
    error,
    refetch: fetchBalances,
  };
};
