import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppState,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './icons';
import { KycSection } from './KycSection';
import { PhoneOtpSection } from './PhoneOtpSection';
import { AppText } from './AppText';
import { SecretInput } from './SecretInput';
import { checkPassword } from '../services/appLock';
import { getSecretPhrase, hasSecretPhrase, markPhraseBackedUp } from '../services/appWallet';
import { loadVerifiedEmail } from '../services/accountEmail';
import { EmailOtpSection } from './EmailOtpSection';
import { loanGateBannerRows } from '../utils/creditGates';
import { subscribeScreenshot } from './ScreenGuard';
import { BusyMark } from './BusyLogo';
import { useScreenScroll } from '../hooks/useScreenScroll';
import { isPickerHeld, setPickerActive } from '../utils/pickerHold';

const KYC_RESUME_KEY = 'qv.kyc.screen';

interface KycAccessBannerProps {
  kycDone: boolean;
  phoneDone: boolean;
  emailDone?: boolean;
  phraseDone?: boolean;
  showIdentity?: boolean;
  accessPaid?: boolean;
  kycRequired?: boolean;
  phoneRequired?: boolean;
  deviceMatches?: boolean;
  walletAddress: string;
  isRegistered: boolean;
  kycDeclarado: boolean;
  identityBound: boolean;
  isLoading: boolean;
  paused?: boolean;
  pending?: boolean;
  onDeclare: () => Promise<boolean>;
  onPhoneBound: () => void;
  onPhraseSaved?: () => void;
  onEmailVerified?: (email: string) => void;
}

export const KycAccessBanner: React.FC<KycAccessBannerProps> = ({
  kycDone,
  phoneDone,
  emailDone = true,
  phraseDone = false,
  showIdentity = true,
  accessPaid = false,
  kycRequired = true,
  phoneRequired = true,
  deviceMatches = false,
  walletAddress,
  isRegistered,
  kycDeclarado,
  identityBound,
  isLoading,
  paused,
  pending = false,
  onDeclare,
  onPhoneBound,
  onPhraseSaved,
  onEmailVerified,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [open, setOpen] = useState<'kyc' | 'phone' | 'phrase' | 'email' | null>(null);
  const { scrollHeight, scrollRef, frameRef, scrollY, keyboardPad } = useScreenScroll(open !== null);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [phrasePassword, setPhrasePassword] = useState('');
  const [phraseText, setPhraseText] = useState('');
  const [phraseError, setPhraseError] = useState('');
  const [phraseBusy, setPhraseBusy] = useState(false);
  const pickerGuard = useRef(false);

  const hidePhrase = () => {
    setPhraseText('');
    setPhrasePassword('');
    setPhraseError('');
  };

  const closeModal = () => {
    if (pickerGuard.current || isPickerHeld()) return;
    setOpen(null);
    hidePhrase();
    void AsyncStorage.removeItem(KYC_RESUME_KEY);
  };

  const openKyc = () => {
    setOpen('kyc');
    void AsyncStorage.setItem(KYC_RESUME_KEY, 'kyc');
  };

  const onPickerActive = (active: boolean) => {
    pickerGuard.current = active;
    setPickerActive(active);
    if (active) void AsyncStorage.setItem(KYC_RESUME_KEY, 'kyc');
  };

  useEffect(() => {
    let live = true;
    void AsyncStorage.getItem(KYC_RESUME_KEY)
      .then((saved) => {
        if (live && saved === 'kyc') setOpen('kyc');
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!phraseText) return undefined;
    const timer = setTimeout(hidePhrase, 45_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') hidePhrase();
    });
    const shot = subscribeScreenshot(hidePhrase);
    return () => {
      clearTimeout(timer);
      sub.remove();
      shot();
    };
  }, [phraseText]);

  const revealPhrase = async () => {
    if (phraseBusy || !phrasePassword) return;
    setPhraseBusy(true);
    setPhraseError('');
    try {
      const checked = await checkPassword(phrasePassword);
      if (!checked.ok) {
        setPhraseError(t('lockPasswordWrong'));
        return;
      }
      if (!(await hasSecretPhrase())) {
        setPhraseError(t('seedMissing'));
        return;
      }
      const next = await getSecretPhrase();
      if (!next) {
        setPhraseError(t('seedMissing'));
        return;
      }
      setPhraseText(next);
    } finally {
      setPhraseBusy(false);
    }
  };

  const confirmPhrase = async () => {
    await markPhraseBackedUp();
    setOpen(null);
    setPhrasePassword('');
    setPhraseText('');
    onPhraseSaved?.();
  };

  const rows = loanGateBannerRows({
    phraseDone,
    accessPaid,
    showIdentity,
    emailDone,
    kycDone,
    phoneDone,
    kycRequired,
    phoneRequired,
  });

  const onGreen = colors.onPrimary;
  const onGreenMuted = colors.onPrimary;

  if (pending || !rows.length) return null;

  return (
    <View>
      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {rows.map((row, index) => {
          const last = index === rows.length - 1;
          if (row === 'phrase') {
            return (
              <TouchableOpacity
                key={row}
                onPress={() => {
                  setPhrasePassword('');
                  setPhraseText('');
                  setPhraseError('');
                  setOpen('phrase');
                }}
                style={[styles.kycBtn, { backgroundColor: colors.primary, borderColor: colors.primary }, last && styles.lastBtn]}
                accessibilityRole="button"
                accessibilityLabel={t('seedBannerTitle')}
              >
                <AppIcon name="shield" size={18} color={onGreen} />
                <View style={styles.grow}>
                  <AppText style={[styles.title, { color: onGreen }]}>{t('seedBannerTitle')}</AppText>
                  <AppText style={[styles.lead, { color: onGreenMuted }]}>{t('seedBannerTodo')}</AppText>
                </View>
                <AppText style={[styles.chevron, { color: onGreen }]}>›</AppText>
              </TouchableOpacity>
            );
          }
          if (row === 'email') {
            return (
              <TouchableOpacity
                key={row}
                onPress={() => {
                  void loadVerifiedEmail()
                    .then((email) => setVerifiedEmail(email))
                    .catch(() => setVerifiedEmail(''));
                  setOpen('email');
                }}
                style={[styles.kycBtn, { backgroundColor: colors.primary, borderColor: colors.primary }, last && styles.lastBtn]}
                accessibilityRole="button"
                accessibilityLabel={t('emailBannerTitle')}
              >
                <AppIcon name="bell" size={18} color={onGreen} />
                <View style={styles.grow}>
                  <AppText style={[styles.title, { color: onGreen }]}>{t('emailBannerTitle')}</AppText>
                  <AppText style={[styles.lead, { color: onGreenMuted }]}>{t('emailBannerTodo')}</AppText>
                </View>
                <AppText style={[styles.chevron, { color: onGreen }]}>›</AppText>
              </TouchableOpacity>
            );
          }
          if (row === 'kyc') {
            return (
              <TouchableOpacity
                key={row}
                onPress={openKyc}
                style={[styles.kycBtn, { backgroundColor: colors.primary, borderColor: colors.primary }, last && styles.lastBtn]}
                accessibilityRole="button"
                accessibilityLabel={t('kycBannerTitle')}
              >
                <AppIcon name="id" size={18} color={onGreen} />
                <View style={styles.grow}>
                  <AppText style={[styles.title, { color: onGreen }]}>{t('kycBannerTitle')}</AppText>
                  <AppText style={[styles.lead, { color: onGreenMuted }]}>{t('kycOpenHint')}</AppText>
                </View>
                <AppText style={[styles.chevron, { color: onGreen }]}>›</AppText>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={row}
              onPress={() => setOpen('phone')}
              style={[styles.kycBtn, { backgroundColor: colors.primary, borderColor: colors.primary }, last && styles.lastBtn]}
              accessibilityRole="button"
              accessibilityLabel={identityBound && !deviceMatches ? t('deviceBannerTitle') : t('phoneBannerTitle')}
            >
              <AppIcon name="phone" size={18} color={onGreen} />
              <View style={styles.grow}>
                <AppText style={[styles.title, { color: onGreen }]}>
                  {identityBound && !deviceMatches ? t('deviceBannerTitle') : t('phoneBannerTitle')}
                </AppText>
                <AppText style={[styles.lead, { color: onGreenMuted }]}>
                  {identityBound && !deviceMatches ? t('seedNeedDevice') : t('phoneBannerTodo')}
                </AppText>
              </View>
              <AppText style={[styles.chevron, { color: onGreen }]}>›</AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={open !== null} animationType="slide" onRequestClose={closeModal}>
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
          <View style={styles.screenHeader}>
            <TouchableOpacity onPress={closeModal} accessibilityRole="button">
              <AppText style={[styles.back, { color: colors.primary }]}>{t('settingsBack')}</AppText>
            </TouchableOpacity>
            <AppText style={[styles.screenTitle, { color: colors.text }]}>
              {open === 'phone'
                ? identityBound && !deviceMatches
                  ? t('deviceBannerTitle')
                  : t('otpTitle')
                : open === 'phrase'
                  ? t('seedBannerTitle')
                  : open === 'email'
                    ? t('emailBannerTitle')
                    : t('kycScreenTitle')}
            </AppText>
            <View style={styles.headerSpacer} />
          </View>
          <View ref={frameRef} style={{ height: scrollHeight }}>
          <ScrollView
            ref={scrollRef}
            style={{ height: scrollHeight }}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={keyboardPad > 0 ? { paddingBottom: 24 + keyboardPad } : undefined}
            onScroll={(event) => {
              scrollY.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            {open === 'email' ? (
              <EmailOtpSection
                walletAddress={walletAddress}
                verifiedEmail={verifiedEmail}
                onVerified={(email) => {
                  setVerifiedEmail(email);
                  onEmailVerified?.(email);
                  if (email) setOpen(null);
                }}
              />
            ) : null}
            {open === 'kyc' ? (
              <KycSection
                walletAddress={walletAddress}
                isRegistered={isRegistered}
                kycDeclarado={kycDeclarado}
                isLoading={isLoading}
                paused={paused}
                onPickerActive={onPickerActive}
                onDeclare={async () => {
                  const ok = await onDeclare();
                  if (ok) {
                    setOpen(null);
                    void AsyncStorage.removeItem(KYC_RESUME_KEY);
                  }
                  return ok;
                }}
              />
            ) : null}
            {open === 'phone' ? (
              <PhoneOtpSection
                walletAddress={walletAddress}
                isRegistered={isRegistered}
                identityBound={identityBound}
                deviceMatches={deviceMatches}
                isLoading={isLoading}
                paused={paused}
                onBound={() => {
                  onPhoneBound();
                  setOpen(null);
                }}
              />
            ) : null}
            {open === 'phrase' ? (
              <View>
                <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('lostPhoneHint')}</AppText>
                {phraseError ? <AppText style={[styles.lead, { color: colors.danger }]}>{phraseError}</AppText> : null}
                {phraseText ? (
                  <>
                    <AppText selectable={false} style={[styles.phrase, { color: colors.text }]}>{phraseText}</AppText>
                    <TouchableOpacity onPress={() => void confirmPhrase()} style={[styles.save, { backgroundColor: colors.connect }]}>
                      <AppText style={styles.saveText}>{t('seedConfirmSaved')}</AppText>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <SecretInput
                      value={phrasePassword}
                      onChangeText={setPhrasePassword}
                      placeholder={t('lockCurrentPassword')}
                    />
                    <TouchableOpacity
                      disabled={phraseBusy || !phrasePassword}
                      onPress={() => void revealPhrase()}
                      style={[styles.save, { backgroundColor: colors.connect }, (!phrasePassword || phraseBusy) && { opacity: 0.6 }]}
                    >
                      <AppText style={styles.saveText}>{t('seedReveal')}</AppText>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : null}
          </ScrollView>
          </View>
          <BusyMark />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  kycBtn: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  lastBtn: {
    marginBottom: 0,
  },
  grow: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  lead: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  chevron: {
    fontSize: 22,
    lineHeight: 24,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  back: {
    fontSize: 15,
    fontWeight: '600',
    width: 72,
  },
  screenTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 72,
  },
  phrase: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 16,
  },
  save: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  saveText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
  },
});
