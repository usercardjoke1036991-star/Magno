import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Web3Provider } from './web3Config';
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

export default function App() {
  useEffect(() => {
    migrateLegacyStorage().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <ThemeProvider>
          <LanguageProvider>
            <AppModeProvider>
              <LanguageWelcome>
                <AppLockGate>
                  <FundsConfirmHost>
                    <Web3Provider>
                      <AppWalletProvider>
                        <ProfileProvider>
                          <HomeScreen />
                        </ProfileProvider>
                      </AppWalletProvider>
                    </Web3Provider>
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
