import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getContractAddress } from '../constants/contractConfig';
import {
  NETWORK_CONFIG,
  isContractConfigured,
  isDemoMode,
} from '../constants/rpcConfig';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { formatAddress } from '../utils/formatters';

export const NetworkStatusBanner: React.FC = () => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const live = isContractConfigured();
  const networkName =
    NETWORK_CONFIG.chainId === 56
      ? t('networkMainnet')
      : NETWORK_CONFIG.chainId === 97
        ? t('networkTestnet')
        : `${NETWORK_CONFIG.chainName} (${NETWORK_CONFIG.chainId})`;

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.kicker, { color: colors.textMuted }]}>{t('networkLive')}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{networkName}</Text>
      {live ? (
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {t('networkContract', { address: formatAddress(getContractAddress()) })}
        </Text>
      ) : isDemoMode() ? (
        <Text style={[styles.meta, { color: colors.textMuted }]}>{t('configWarn')}</Text>
      ) : null}
      {isDemoMode() ? (
        <Text style={[styles.meta, { color: colors.textMuted }]}>{t('networkNotMainnet')}</Text>
      ) : null}
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
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
});
