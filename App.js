import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking as RNLinking, View } from 'react-native';
import { Inter_400Regular, useFonts } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from './i18n/LanguageContext';
import { ThemeProvider } from './theme/ThemeContext';
import { ProfileProvider } from './profile/ProfileContext';
import { migrateLegacyStorage } from './utils/legacyStorage';
import HomeScreen from './app/index';
import { ScreenGuard } from './components/ScreenGuard';
import { AppLockGate } from './components/AppLockGate';
import { LanguageWelcome } from './components/LanguageWelcome';
import { FundsConfirmHost } from './components/FundsConfirmHost';
import { AppModeProvider } from './wallet/AppModeContext';
import { AppWalletProvider } from './wallet/AppWalletContext';
import * as Linking from 'expo-linking';
import { rememberAppUrl } from './utils/pendingDeepLink';

function DeferredWeb3({ children }) {
  const [Box, setBox] = useState(null);
  useEffect(() => {
    let live = true;
    import('./web3Config')
      .then((mod) => {
        if (live) setBox(() => mod.Web3Provider);
      })
      .catch(() => {
        if (live) setBox(() => ({ children: inner }) => inner);
      });
    return () => {
      live = false;
    };
  }, []);
  if (__DEV__) {
    console.log('[boot] DeferredWeb3', { ready: Boolean(Box) });
  }
  if (!Box) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  const Provider = Box;
  return <Provider>{children}</Provider>;
}

export default function App() {
  // Arranque a prueba de colgados: fuentes, idioma y candado tienen tope de espera.
  const [fontsLoaded] = useFonts({
    QvSans: Inter_400Regular,
    Inter_400Regular,
  });
  const [fontWaitOver, setFontWaitOver] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFontWaitOver(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    migrateLegacyStorage().catch(() => {});
    const remember = (url) => rememberAppUrl(url);
    Linking.getInitialURL().then(remember).catch(() => {});
    RNLinking.getInitialURL().then(remember).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => remember(url));
    const rnSub = RNLinking.addEventListener('url', ({ url }) => remember(url));
    return () => {
      sub.remove();
      rnSub.remove();
    };
  }, []);

  if (__DEV__) {
    console.log('[boot] App render', { fontsLoaded, fontWaitOver });
  }

  if (!fontsLoaded && !fontWaitOver) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <ThemeProvider>
          <LanguageProvider>
            <AppModeProvider>
              <LanguageWelcome>
                <AppLockGate>
                  <FundsConfirmHost>
                    <DeferredWeb3>
                      <AppWalletProvider>
                        <ProfileProvider>
                          <HomeScreen />
                        </ProfileProvider>
                      </AppWalletProvider>
                    </DeferredWeb3>
                  </FundsConfirmHost>
                </AppLockGate>
              </LanguageWelcome>
            </AppModeProvider>
          </LanguageProvider>
        </ThemeProvider>
        <ScreenGuard />
      </View>
    </SafeAreaProvider>
  );
}
