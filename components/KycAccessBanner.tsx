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

interface KycAccessBannerProps {
  kycDone: boolean;
  phoneDone: boolean;
  walletAddress: string;
  isRegistered: boolean;
  kycDeclarado: boolean;
  identityBound: boolean;
  isLoading: boolean;
  paused?: boolean;
  onDeclare: () => Promise<boolean>;
  onPhoneBound: () => void;
}

export const KycAccessBanner: React.FC<KycAccessBannerProps> = ({
  kycDone,
  phoneDone,
  walletAddress,
  isRegistered,
  kycDeclarado,
  identityBound,
  isLoading,
  paused,
  onDeclare,
  onPhoneBound,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [open, setOpen] = useState<'kyc' | 'phone' | null>(null);

  return (
    <View>
      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
          accessibilityLabel={t('phoneBannerTitle')}
        >
          <AppIcon name={phoneDone ? 'check' : 'phone'} size={18} color={phoneDone ? colors.success : '#fff'} />
          <View style={styles.grow}>
            <AppText style={[styles.title, { color: phoneDone ? colors.text : '#fff' }]}>
              {phoneDone ? t('phoneBannerDoneTitle') : t('phoneBannerTitle')}
            </AppText>
            <AppText style={[styles.lead, { color: phoneDone ? colors.textMuted : 'rgba(255,255,255,0.86)' }]}>
              {phoneDone ? t('phoneBannerDone') : t('phoneBannerTodo')}
            </AppText>
          </View>
          <AppText style={[styles.chevron, { color: phoneDone ? colors.textMuted : '#fff' }]}>›</AppText>
        </TouchableOpacity>
      </View>

      <Modal visible={open !== null} animationType="slide" onRequestClose={() => setOpen(null)}>
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
          <View style={styles.screenHeader}>
            <TouchableOpacity onPress={() => setOpen(null)} accessibilityRole="button">
              <AppText style={[styles.back, { color: colors.primary }]}>{t('settingsBack')}</AppText>
            </TouchableOpacity>
            <AppText style={[styles.screenTitle, { color: colors.text }]}>
              {open === 'phone' ? t('otpTitle') : t('kycScreenTitle')}
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
});
