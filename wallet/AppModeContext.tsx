import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getRuntimeMode,
  isContractConfigured,
  isStoreProduction,
  setRuntimeMode,
  type AppMode,
} from '../constants/rpcConfig';

const STORAGE_KEY = 'quatrivium.appMode';

interface AppModeValue {
  mode: AppMode;
  ready: boolean;
  setMode: (next: AppMode) => Promise<boolean>;
}

const AppModeContext = createContext<AppModeValue | null>(null);

export const AppModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<AppMode>(getRuntimeMode);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(async (saved) => {
        if (isStoreProduction()) {
          setRuntimeMode('live');
          setModeState('live');
          await AsyncStorage.setItem(STORAGE_KEY, 'live');
          return;
        }
        if (saved !== 'demo' && saved !== 'live') return;
        const network = saved === 'live' ? 'mainnet' : 'testnet';
        if (isContractConfigured(network)) {
          setRuntimeMode(saved);
          setModeState(saved);
          return;
        }
        if (saved === 'live' && isContractConfigured('testnet')) {
          setRuntimeMode('demo');
          setModeState('demo');
          await AsyncStorage.setItem(STORAGE_KEY, 'demo');
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setMode = useCallback(async (next: AppMode) => {
    if (isStoreProduction() && next !== 'live') {
      return false;
    }
    const network = next === 'live' ? 'mainnet' : 'testnet';
    if (!isContractConfigured(network)) {
      return false;
    }
    setRuntimeMode(next);
    setModeState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    return true;
  }, []);

  const value = useMemo(() => ({ mode, ready, setMode }), [mode, ready, setMode]);

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
