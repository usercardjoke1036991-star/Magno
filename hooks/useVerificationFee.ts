import { useMemo } from 'react';
import { useAccount, useAppKit, useProvider } from '@reown/appkit-react-native';
import { isDemoAccount } from '../constants/rpcConfig';
import { getSupportedTokens } from '../constants/tokens';
import { useI18n } from '../i18n/LanguageContext';
import { useAppMode } from '../wallet/AppModeContext';
import { useAppWallet } from '../wallet/AppWalletContext';
import { useWeb3Balances } from './useWeb3Balances';
import { chargeFounderUsdt, type FounderChargeResult } from '../services/founderUsdtCharge';
import { hasVerificationFeeReceipt, markVerificationFeeReceipt } from '../services/verificationFeeReceipt';
import { verificationFeeUsdt, type VerificationFeeKind } from '../utils/creditGates';

export function useVerificationFee(kind: VerificationFeeKind) {
  const { t } = useI18n();
  const { mode } = useAppMode();
  const { address } = useAppWallet();
  const token = useMemo(() => getSupportedTokens()[0], [mode]);
  const { userInfo, balances, refetch } = useWeb3Balances(address, token);
  const { address: adminAddress, isConnected: adminConnected } = useAccount();
  const { provider: adminProvider } = useProvider();
  const { open: openExternalWallet } = useAppKit();
  const demo = isDemoAccount();
  const feeUsdt = verificationFeeUsdt(kind, demo);

  const chargeVerificationFee = async (target: string): Promise<FounderChargeResult> => {
    if (feeUsdt <= 0) return 'paid';
    const wallet = String(address || '').trim();
    const mark = String(target || '').trim();
    if (!wallet || !mark) return 'failed';
    if (await hasVerificationFeeReceipt(wallet, kind, mark)) return 'paid';
    const result = await chargeFounderUsdt(
      {
        walletAddress: wallet,
        token,
        founderAddress: userInfo.founderAddress,
        canDonate: userInfo.canDonate,
        isTokenSupported: userInfo.isTokenSupported,
        bnbBalance: balances.bnbBalance,
        adminConnected,
        adminProvider,
        adminAddress,
        openExternalWallet,
        confirmFunds: async () => true,
        t,
        refetch,
        silent: true,
      },
      feeUsdt
    );
    if (result === 'paid') {
      await markVerificationFeeReceipt(wallet, kind, mark);
    }
    return result;
  };

  return { chargeVerificationFee };
}
