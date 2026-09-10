import { useCallback, useEffect, useState } from 'react';
import {
  loadReferralNetwork,
  type ReferralNetworkSnapshot,
} from '../services/referralNetwork';

const EMPTY: ReferralNetworkSnapshot = {
  directs: [],
  totalEarnedWei: '0',
  totalEarnedLabel: '0.00 USDT',
  activity: [],
  partial: false,
};

export const useReferralNetwork = (walletAddress: string, enabled: boolean) => {
  const [data, setData] = useState<ReferralNetworkSnapshot>(EMPTY);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled || !walletAddress) {
      setData(EMPTY);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setData(await loadReferralNetwork(walletAddress));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network');
      setData(EMPTY);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, walletAddress]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
};
