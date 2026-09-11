import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { isContractConfigured } from '../constants/rpcConfig';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { useAppMode } from '../wallet/AppModeContext';

export const DemoModeBanner: React.FC = () => {
  const { mode } = useAppMode();
  const { t } = useI18n();
  const { colors } = useTheme();
  if (mode === 'demo') {
    return (
      <View style={[styles.box, { backgroundColor: colors.chip, borderColor: colors.border }]}>
        <AppText style={[styles.title, { color: colors.text }]}>{t('appModeDemoBanner')}</AppText>
        <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('appModeDemoBannerLead')}</AppText>
      </View>
    );
  }
  if (!isContractConfigured('mainnet')) {
    return (
      <View style={[styles.box, { backgroundColor: colors.warnBg, borderColor: colors.border }]}>
        <AppText style={[styles.title, { color: colors.warnText }]}>{t('liveNetworkPending')}</AppText>
        <AppText style={[styles.lead, { color: colors.warnText }]}>{t('liveNetworkPendingLead')}</AppText>
      </View>
    );
  }
  return (
    <View style={[styles.box, { backgroundColor: colors.chip, borderColor: colors.border }]}>
      <AppText style={[styles.title, { color: colors.text }]}>{t('appModeLive')}</AppText>
      <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('appModeLiveBannerLead')}</AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  lead: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
});
