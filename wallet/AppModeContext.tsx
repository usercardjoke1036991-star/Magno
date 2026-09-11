import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isContractConfigured,
  isStoreProduction,
  setProductMode,
  setRuntimeMode,
  type AppMode,
} from '../constants/rpcConfig';

const STORAGE_KEY = 'quatrivium.appMode.v2';

interface AppModeValue {
  mode: AppMode;
  ready: boolean;
  setMode: (next: AppMode) => Promise<boolean>;
}

const AppModeContext = createContext<AppModeValue | null>(null);

function applyChain(pref: AppMode): AppMode {
  const account: AppMode = pref === 'demo' ? 'demo' : 'live';
  setProductMode(account);
  // Demo y Real son mundos distintos: Real nunca lee el contrato ni los saldos de testnet.
  setRuntimeMode(account);
  return account;
}

export const AppModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<AppMode>('live');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(async (saved) => {
        if (isStoreProduction()) {
          setRuntimeMode('live');
          setProductMode('live');
          setModeState('live');
          await AsyncStorage.setItem(STORAGE_KEY, 'live');
          return;
        }
        const pref: AppMode = saved === 'demo' ? 'demo' : 'live';
        setModeState(applyChain(pref));
        if (!saved) {
          await AsyncStorage.setItem(STORAGE_KEY, pref);
        }
      })
      .catch(() => {
        setModeState(applyChain('live'));
      })
      .finally(() => setReady(true));
  }, []);

  const setMode = useCallback(async (next: AppMode) => {
    if (isStoreProduction() && next !== 'live') {
      return false;
    }
    if (next === 'demo' && !isContractConfigured('testnet')) {
      return false;
    }
    setModeState(applyChain(next));
    await AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    return true;
  }, []);

  const value = useMemo(() => ({ mode, ready, setMode }), [mode, ready, setMode]);

  useEffect(() => {
    setProductMode(mode);
  }, [mode]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
};

export function useAppMode(): AppModeValue {
  const ctx = useContext(AppModeContext);
  if (!ctx) {
    throw new Error('useAppMode must be used within AppModeProvider');
  }
  return ctx;
}
