import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAccount, useAppKit } from '@reown/appkit-react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { useWeb3Balances } from '../hooks/useWeb3Balances';
import { getSupportedTokens } from '../constants/tokens';
import { formatAddress } from '../utils/formatters';
import { useAppMode } from '../wallet/AppModeContext';
import { openWalletConnect } from '../utils/openWalletConnect';
import { AppText } from './AppText';

export const AdminAccess: React.FC = () => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { mode } = useAppMode();
  const token = useMemo(() => getSupportedTokens()[0], [mode]);
  const { userInfo } = useWeb3Balances(
    isConnected && address ? address.toLowerCase() : '',
    token
  );
  const allowed = Boolean(userInfo.isAdmin || userInfo.isOwner);

  return (
    <View>
      <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('settingsAdminLead')}</AppText>
      {isConnected && address ? (
        <AppText style={[styles.meta, { color: colors.text }]}>{formatAddress(address)}</AppText>
      ) : null}
      {isConnected && allowed ? (
        <AppText style={[styles.ok, { color: colors.success }]}>{t('settingsAdminOk')}</AppText>
      ) : null}
      {isConnected && !allowed ? (
        <AppText style={[styles.warn, { color: colors.danger }]}>{t('settingsAdminNot')}</AppText>
      ) : null}
      <TouchableOpacity
        onPress={() => void openWalletConnect(open)}
        style={[styles.btn, { backgroundColor: colors.primary }]}
        accessibilityRole="button"
        accessibilityLabel={t('settingsAdminConnect')}
      >
        <AppText style={[styles.btnText, { color: colors.onPrimary }]}>{t('settingsAdminConnect')}</AppText>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  lead: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  meta: {
    fontSize: 13,
    marginBottom: 8,
  },
  ok: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  warn: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
