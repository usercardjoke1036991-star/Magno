import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserBalances } from '../hooks/useWeb3Balances';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon, TokenLogo } from './icons';

interface BalanceDisplayProps {
  balances: UserBalances;
  selectedTokenSymbol: string;
}

export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  balances,
  selectedTokenSymbol,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <View>
      <View style={styles.balanceItem}>
        <View style={styles.labelRow}>
          <AppIcon name="wallet" size={14} color={colors.textMuted} />
          <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>{t('yourWallet')}</Text>
        </View>
        <View style={styles.valueRow}>
          <TokenLogo symbol={selectedTokenSymbol} size={18} />
          <Text style={[styles.balanceValue, { color: colors.connect }]}>
            {balances.tokenBalance} {selectedTokenSymbol}
          </Text>
        </View>
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('walletVsPoolHint')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  balanceItem: {
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 12,
    marginBottom: 0,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
});
