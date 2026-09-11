import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { BrandLogo } from './BrandLogo';
import { UsernameSection } from './UsernameSection';
import { loadClaimedUsername } from '../services/accountUsername';
import { useUserProfile } from '../profile/ProfileContext';
import { AppText } from './AppText';

interface AccountOnboardingProps {
  walletAddress: string;
  walletReady: boolean;
  walletFailed?: boolean;
  onRetryWallet?: () => void;
  isRegistered: boolean;
  kycDeclarado: boolean;
  identityBound: boolean;
  isLoading: boolean;
  paused?: boolean;
  inviteCode?: string;
  onRegister: (padre?: string) => void;
  onDeclareKyc: () => Promise<boolean>;
  onPhoneBound: () => void;
  children: React.ReactNode;
}

export const AccountOnboarding: React.FC<AccountOnboardingProps> = ({
  walletAddress,
  walletReady,
  walletFailed,
  onRetryWallet,
  children,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { profile, saveProfile } = useUserProfile();
  const [username, setUsername] = useState('');
  const [usernameReady, setUsernameReady] = useState(false);

  useEffect(() => {
    loadClaimedUsername()
      .then((value) => {
        setUsername(value);
        setUsernameReady(true);
      })
      .catch(() => setUsernameReady(true));
  }, [walletAddress]);

  if (!walletReady || !usernameReady) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg, justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (walletReady && !walletAddress) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg, justifyContent: 'center', paddingHorizontal: 24 }]}>
        <AppText style={[styles.title, { color: colors.text }]}>{t('appWalletFailed')}</AppText>
        {walletFailed && onRetryWallet ? (
          <TouchableOpacity onPress={() => onRetryWallet()} style={{ marginTop: 16, alignItems: 'center' }}>
            <AppText style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>{t('appWalletRetry')}</AppText>
          </TouchableOpacity>
        ) : null}
      </SafeAreaView>
    );
  }

  if (username) {
    return <>{children}</>;
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BrandLogo size={64} style={styles.logo} />
        <AppText style={[styles.title, { color: colors.text }]}>{t('usernameTitle')}</AppText>
        <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('usernameLead')}</AppText>
        <AppText style={[styles.step, { color: colors.primary }]}>{t('onboardStepUsername')}</AppText>
        <UsernameSection
          walletAddress={walletAddress}
          claimedUsername={username}
          onClaimed={async (value) => {
            setUsername(value);
            await saveProfile({ ...profile, displayName: value });
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 40,
  },
  logo: {
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  lead: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 10,
  },
  step: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 18,
  },
});
