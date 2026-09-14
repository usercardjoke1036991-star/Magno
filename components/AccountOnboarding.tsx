import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { BrandLogo } from './BrandLogo';
import { UsernameSection } from './UsernameSection';
import { PublicIdentityForm } from './PublicIdentityForm';
import { LinkWalletForm } from './LinkWalletForm';
import { loadClaimedUsername } from '../services/accountUsername';
import { hasLockedPublicIdentity, loadOwnProfile } from '../services/userProfile';
import { hasCompletedWalletLink, loadLinkedExternalWallet } from '../services/linkedWallet';
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
  const { profile } = useUserProfile();
  const [username, setUsername] = useState('');
  const [usernameReady, setUsernameReady] = useState(false);
  const [hasFace, setHasFace] = useState(false);
  const [faceReady, setFaceReady] = useState(false);
  const [linkedWallet, setLinkedWallet] = useState('');
  const [linkedReady, setLinkedReady] = useState(false);

  useEffect(() => {
    let done = false;
    const finish = (value = '') => {
      if (done) return;
      done = true;
      setUsername(value);
      setUsernameReady(true);
    };
    const watchdog = setTimeout(() => finish(''), 3000);
    loadClaimedUsername()
      .then((value) => {
        clearTimeout(watchdog);
        finish(value);
      })
      .catch(() => {
        clearTimeout(watchdog);
        finish('');
      });
    return () => {
      done = true;
      clearTimeout(watchdog);
    };
  }, [walletAddress]);

  useEffect(() => {
    let done = false;
    loadOwnProfile(walletAddress || undefined)
      .then((stored) => {
        if (done) return;
        setHasFace(hasLockedPublicIdentity(stored));
        setFaceReady(true);
      })
      .catch(() => {
        if (!done) setFaceReady(true);
      });
    return () => {
      done = true;
    };
  }, [walletAddress]);

  useEffect(() => {
    if (hasLockedPublicIdentity(profile)) {
      setHasFace(true);
    }
  }, [profile]);

  useEffect(() => {
    let done = false;
    if (!walletAddress) {
      setLinkedWallet('');
      setLinkedReady(true);
      return;
    }
    setLinkedReady(false);
    loadLinkedExternalWallet(walletAddress)
      .then((stored) => {
        if (!done) {
          setLinkedWallet(stored);
          setLinkedReady(true);
        }
      })
      .catch(() => {
        if (!done) setLinkedReady(true);
      });
    return () => {
      done = true;
    };
  }, [walletAddress]);

  if (!walletReady || !usernameReady || !faceReady || !linkedReady) {
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

  if (username && hasFace && hasCompletedWalletLink(linkedWallet)) {
    return <>{children}</>;
  }

  if (username && hasFace && !hasCompletedWalletLink(linkedWallet)) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BrandLogo size={64} style={styles.logo} />
          <AppText style={[styles.title, { color: colors.text }]}>{t('linkWalletTitle')}</AppText>
          <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('linkWalletLead')}</AppText>
          <LinkWalletForm
            internalWallet={walletAddress}
            onLinked={(external) => {
              setLinkedWallet(external);
            }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (username && !hasFace) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BrandLogo size={64} style={styles.logo} />
          <AppText style={[styles.title, { color: colors.text }]}>{t('publicIdentityTitle')}</AppText>
          <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('publicIdentityLead')}</AppText>
          <PublicIdentityForm
            walletAddress={walletAddress}
            onSaved={() => {
              setHasFace(true);
            }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BrandLogo size={64} style={styles.logo} />
        <AppText style={[styles.title, { color: colors.text }]}>{t('createCredentialsTitle')}</AppText>
        <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('createCredentialsLead')}</AppText>
        <UsernameSection
          walletAddress={walletAddress}
          claimedUsername={username}
          onClaimed={async (value) => {
            setUsername(value);
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
});
