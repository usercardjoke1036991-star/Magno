import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { BrandLogo } from './BrandLogo';
import { EmailOtpSection } from './EmailOtpSection';
import { UsernameSection } from './UsernameSection';
import { loadVerifiedEmail } from '../services/accountEmail';
import { loadClaimedUsername } from '../services/accountUsername';
import { bindLegalIdentity, isValidLegalName, loadBoundLegalName } from '../services/kycDeclaration';
import { notifyApiConfigured } from '../services/phoneOtp';
import { useUserProfile } from '../profile/ProfileContext';

interface AccountOnboardingProps {
  walletAddress: string;
  walletReady: boolean;
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
  children,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { profile, saveProfile } = useUserProfile();
  const [email, setEmail] = useState('');
  const [emailReady, setEmailReady] = useState(false);
  const [username, setUsername] = useState('');
  const [usernameReady, setUsernameReady] = useState(false);
  const [legalName, setLegalName] = useState('');
  const [legalReady, setLegalReady] = useState(false);

  useEffect(() => {
    loadVerifiedEmail()
      .then((value) => {
        setEmail(value);
        setEmailReady(true);
      })
      .catch(() => setEmailReady(true));
    loadClaimedUsername()
      .then((value) => {
        setUsername(value);
        setUsernameReady(true);
      })
      .catch(() => setUsernameReady(true));
    loadBoundLegalName(walletAddress)
      .then((value) => {
        setLegalName(value);
        setLegalReady(true);
      })
      .catch(() => setLegalReady(true));
  }, [walletAddress]);

  const emailOk = Boolean(email) || !notifyApiConfigured();
  const usernameOk = Boolean(username);
  const legalOk = isValidLegalName(legalName);
  const complete = emailOk && usernameOk && legalOk;

  if (!walletReady || !emailReady || !usernameReady || !legalReady) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg, justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (walletReady && !walletAddress) {
    return <>{children}</>;
  }

  if (complete) {
    return <>{children}</>;
  }

  const step = !emailOk ? 'email' : 'names';

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BrandLogo size={64} style={styles.logo} />
        <Text style={[styles.title, { color: colors.text }]}>{t('onboardTitle')}</Text>
        <Text style={[styles.lead, { color: colors.textMuted }]}>{t('onboardLead')}</Text>
        <Text style={[styles.step, { color: colors.primary }]}>
          {step === 'email' ? t('onboardStepEmail') : t('onboardStepNames')}
        </Text>
        {step === 'email' ? (
          <EmailOtpSection
            walletAddress={walletAddress}
            verifiedEmail={email}
            onVerified={(value) => {
              setEmail(value);
            }}
          />
        ) : (
          <UsernameSection
            walletAddress={walletAddress}
            claimedUsername={username}
            legalName={legalName}
            includeLegalName
            onClaimed={async (value, nextLegal) => {
              setUsername(value);
              if (nextLegal) {
                const saved = await bindLegalIdentity(walletAddress, nextLegal);
                setLegalName(saved.boundLegalName || saved.legalName);
              }
              await saveProfile({ ...profile, displayName: value });
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  logo: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  lead: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  step: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
    textAlign: 'center',
  },
});
