import React, { useState } from 'react';
import {
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

interface KycAccessBannerProps {
  kycDone: boolean;
  phoneDone: boolean;
  emailDone?: boolean;
  phraseDone?: boolean;
  showIdentity?: boolean;
  deviceMatches?: boolean;
  walletAddress: string;
  isRegistered: boolean;
  kycDeclarado: boolean;
  identityBound: boolean;
  isLoading: boolean;
  paused?: boolean;
  onDeclare: () => Promise<boolean>;
  onPhoneBound: () => void;
  onPhraseSaved?: () => void;
}

export const KycAccessBanner: React.FC<KycAccessBannerProps> = ({
  kycDone,
  phoneDone,
  emailDone = true,
  phraseDone = false,
  showIdentity = true,
  deviceMatches = true,
  walletAddress,
  isRegistered,
  kycDeclarado,
  identityBound,
  isLoading,
  paused,
  onDeclare,
  onPhoneBound,
  onPhraseSaved,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [open, setOpen] = useState<'kyc' | 'phone' | 'phrase' | null>(null);
  const [phrasePassword, setPhrasePassword] = useState('');
  const [phraseText, setPhraseText] = useState('');
  const [phraseError, setPhraseError] = useState('');
  const [phraseBusy, setPhraseBusy] = useState(false);

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

  return (
    <View>
      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            if (phraseDone) return;
            setPhrasePassword('');
            setPhraseText('');
            setPhraseError('');
            setOpen('phrase');
          }}
          style={[styles.kycBtn, { backgroundColor: phraseDone ? colors.surface : colors.primary, borderColor: phraseDone ? colors.border : colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={t('seedBannerTitle')}
        >
          <AppIcon name={phraseDone ? 'check' : 'shield'} size={18} color={phraseDone ? colors.success : '#fff'} />
          <View style={styles.grow}>
            <AppText style={[styles.title, { color: phraseDone ? colors.text : '#fff' }]}>
              {phraseDone ? t('seedBannerDoneTitle') : t('seedBannerTitle')}
            </AppText>
            <AppText style={[styles.lead, { color: phraseDone ? colors.textMuted : 'rgba(255,255,255,0.86)' }]}>
              {phraseDone ? t('seedBannerDone') : t('seedBannerTodo')}
            </AppText>
          </View>
          {phraseDone ? null : <AppText style={[styles.chevron, { color: '#fff' }]}>›</AppText>}
        </TouchableOpacity>
        {showIdentity ? (
        <>
        <View
          style={[styles.kycBtn, { backgroundColor: emailDone ? colors.surface : colors.primary, borderColor: emailDone ? colors.border : colors.primary }]}
          accessibilityRole="text"
          accessibilityLabel={t('emailBannerTitle')}
        >
          <AppIcon name={emailDone ? 'check' : 'bell'} size={18} color={emailDone ? colors.success : '#fff'} />
          <View style={styles.grow}>
            <AppText style={[styles.title, { color: emailDone ? colors.text : '#fff' }]}>
              {emailDone ? t('emailBannerDoneTitle') : t('emailBannerTitle')}
            </AppText>
            <AppText style={[styles.lead, { color: emailDone ? colors.textMuted : 'rgba(255,255,255,0.86)' }]}>
              {emailDone ? t('emailBannerDone') : t('emailBannerTodo')}
            </AppText>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setOpen('kyc')}
          style={[styles.kycBtn, { backgroundColor: kycDone ? colors.surface : colors.primary, borderColor: kycDone ? colors.border : colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={t('kycBannerTitle')}
        >
          <AppIcon name={kycDone ? 'check' : 'id'} size={18} color={kycDone ? colors.success : '#fff'} />
          <View style={styles.grow}>
            <AppText style={[styles.title, { color: kycDone ? colors.text : '#fff' }]}>
              {kycDone ? t('kycBannerDoneTitle') : t('kycBannerTitle')}
            </AppText>
            <AppText style={[styles.lead, { color: kycDone ? colors.textMuted : 'rgba(255,255,255,0.86)' }]}>
              {kycDone ? t('kycBannerDone') : t('kycOpenHint')}
            </AppText>
          </View>
          <AppText style={[styles.chevron, { color: kycDone ? colors.textMuted : '#fff' }]}>›</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setOpen('phone')}
          style={[styles.kycBtn, { backgroundColor: phoneDone ? colors.surface : colors.primary, borderColor: phoneDone ? colors.border : colors.primary, marginBottom: 0 }]}
          accessibilityRole="button"
          accessibilityLabel={identityBound && !deviceMatches ? t('deviceBannerTitle') : t('phoneBannerTitle')}
        >
          <AppIcon name={phoneDone ? 'check' : 'phone'} size={18} color={phoneDone ? colors.success : '#fff'} />
          <View style={styles.grow}>
            <AppText style={[styles.title, { color: phoneDone ? colors.text : '#fff' }]}>
              {phoneDone
                ? t('phoneBannerDoneTitle')
                : identityBound && !deviceMatches
                  ? t('deviceBannerTitle')
                  : t('phoneBannerTitle')}
            </AppText>
            <AppText style={[styles.lead, { color: phoneDone ? colors.textMuted : 'rgba(255,255,255,0.86)' }]}>
              {phoneDone
                ? t('phoneBannerDone')
                : identityBound && !deviceMatches
                  ? t('seedNeedDevice')
                  : t('phoneBannerTodo')}
            </AppText>
          </View>
          <AppText style={[styles.chevron, { color: phoneDone ? colors.textMuted : '#fff' }]}>›</AppText>
        </TouchableOpacity>
        </>
        ) : null}
      </View>

      <Modal visible={open !== null} animationType="slide" onRequestClose={() => setOpen(null)}>
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
          <View style={styles.screenHeader}>
            <TouchableOpacity onPress={() => setOpen(null)} accessibilityRole="button">
              <AppText style={[styles.back, { color: colors.primary }]}>{t('settingsBack')}</AppText>
            </TouchableOpacity>
            <AppText style={[styles.screenTitle, { color: colors.text }]}>
              {open === 'phone' ? t('otpTitle') : open === 'phrase' ? t('seedBannerTitle') : t('kycScreenTitle')}
            </AppText>
            <View style={styles.headerSpacer} />
          </View>
          <ScrollView keyboardShouldPersistTaps="always">
            {open === 'kyc' ? (
              <KycSection
                walletAddress={walletAddress}
                isRegistered={isRegistered}
                kycDeclarado={kycDeclarado}
                isLoading={isLoading}
                paused={paused}
                onDeclare={async () => {
                  const ok = await onDeclare();
                  if (ok) setOpen(null);
                  return ok;
                }}
              />
            ) : null}
            {open === 'phone' ? (
              <PhoneOtpSection
                walletAddress={walletAddress}
                isRegistered={isRegistered}
                identityBound={identityBound}
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
                    <AppText style={[styles.phrase, { color: colors.text }]}>{phraseText}</AppText>
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
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
