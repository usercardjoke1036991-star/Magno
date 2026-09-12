import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { supportKind, supportNameKey } from '../constants/support';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { formatUSD } from '../utils/formatters';
import { AppSubsection } from './AppSection';
import { AppText, AppTextInput } from './AppText';
import { AppIcon } from './icons';

interface DonateFounderSectionProps {
  isLoading: boolean;
  tokenSymbol: string;
  tokenSupported: boolean;
  walletConnected: boolean;
  founderAddress?: string;
  donatedUsd: number;
  lpUsd: number;
  onDonate: (amount: string) => void;
}

export function DonateFounderSection({
  isLoading,
  tokenSymbol,
  tokenSupported,
  walletConnected,
  founderAddress,
  donatedUsd,
  lpUsd,
  onDonate,
}: DonateFounderSectionProps) {
  const [amount, setAmount] = useState('5');
  const { t } = useI18n();
  const { colors } = useTheme();
  const kind = supportKind(donatedUsd, lpUsd);
  const titleKey = supportNameKey(kind);
  const blocked = isLoading || !walletConnected || !tokenSupported || !founderAddress;

  return (
    <View style={styles.stack}>
      <AppSubsection title={t('donateTitle')} defaultOpen icon="star">
        <AppText style={[styles.lead, { color: colors.text }]}>{t('donateLead')}</AppText>
        <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('supportDonateBenefit')}</AppText>
        <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('supportPoolBenefit')}</AppText>
        {titleKey ? (
          <AppText style={[styles.title, { color: colors.primary }]}>
            {t('supportYourTitle', { title: t(titleKey) })}
          </AppText>
        ) : (
          <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('supportBenefitLead')}</AppText>
        )}
        <AppText style={[styles.meta, { color: colors.textMuted }]}>
          {t('donateGoesTo')} · {formatUSD(donatedUsd)} / {formatUSD(lpUsd)}
        </AppText>
        {founderAddress ? (
          <AppText selectable style={[styles.address, { color: colors.primary, backgroundColor: colors.surface }]}>
            {founderAddress}
          </AppText>
        ) : (
          <AppText style={[styles.warn, { color: colors.warnText }]}>{t('liveCreditNotReady')}</AppText>
        )}
        <AppText style={[styles.label, { color: colors.primary }]}>
          {t('donateAmount')} ({tokenSymbol})
        </AppText>
        <AppTextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="5"
          editable={!blocked}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },
          ]}
        />
        <TouchableOpacity
          disabled={blocked}
          onPress={() => onDonate(amount)}
          style={[styles.button, { backgroundColor: blocked ? colors.chip : colors.primary }]}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <View style={styles.buttonRow}>
              <AppIcon name="deposit" size={18} color={blocked ? colors.textMuted : colors.onPrimary} />
              <AppText style={[styles.buttonText, { color: blocked ? colors.textMuted : colors.onPrimary }]}>
                {t('donateNow')}
              </AppText>
            </View>
          )}
        </TouchableOpacity>
      </AppSubsection>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10,
  },
  lead: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  meta: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  address: {
    fontFamily: 'monospace',
    fontSize: 11,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  warn: {
    fontSize: 12,
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
