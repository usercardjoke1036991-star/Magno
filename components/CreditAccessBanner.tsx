import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { accessPayUsdt, hasCreditAccess } from '../utils/creditGates';
import { AppText } from './AppText';
import { useAppMode } from '../wallet/AppModeContext';

interface CreditAccessBannerProps {
  paidUsd: number;
  canPay: boolean;
  isLoading?: boolean;
  tokenSymbol?: string;
  onPay: () => void;
}

export const CreditAccessBanner: React.FC<CreditAccessBannerProps> = ({
  paidUsd,
  canPay,
  isLoading = false,
  tokenSymbol = 'USDT',
  onPay,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { mode } = useAppMode();
  if (mode === 'demo' || hasCreditAccess(paidUsd)) {
    return null;
  }

  const pendingLead = t('creditAccessPending');

  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <AppText style={[styles.title, { color: colors.text }]}>{t('creditAccessTitle')}</AppText>
      <AppText style={[styles.lead, { color: colors.textMuted }]}>
        {canPay ? t('creditAccessLead') : pendingLead}
      </AppText>
      {canPay ? (
        <TouchableOpacity
          disabled={isLoading}
          onPress={onPay}
          style={[styles.pay, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={t('creditAccessPay')}
        >
          {isLoading ? (
            <ActivityIndicator color="#111" />
          ) : (
            <AppText style={[styles.payText, { color: colors.onPrimary }]}>
              {t('creditAccessPay', { amount: String(accessPayUsdt()), symbol: tokenSymbol })}
            </AppText>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  lead: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  pay: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  payText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
