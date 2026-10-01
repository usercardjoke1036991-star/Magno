import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAccount, useAppKit } from '@reown/appkit-react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { formatAddress } from '../utils/formatters';
import * as linkedWallet from '../services/linkedWallet';
import { openWalletConnect } from '../utils/openWalletConnect';
import { AppText } from './AppText';

interface LinkWalletFormProps {
  internalWallet: string;
  onLinked: (externalWallet: string) => void | Promise<void>;
  allowSkip?: boolean;
}

export const LinkWalletForm: React.FC<LinkWalletFormProps> = ({ internalWallet, onLinked, allowSkip = true }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const connected = Boolean(isConnected && linkedWallet.hasLinkedExternalWallet(address || ''));

  const submit = async () => {
    if (!connected || !address) {
      setError(t('linkWalletNeed'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await linkedWallet.saveLinkedExternalWallet(internalWallet, address);
      await onLinked(saved);
    } catch {
      setError(t('linkWalletNeed'));
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    setError('');
    try {
      const saved = await linkedWallet.skipLinkedExternalWallet(internalWallet);
      await onLinked(saved);
    } catch {
      setError(t('linkWalletNeed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => {
          setError('');
          void openWalletConnect(open);
        }}
        style={[styles.btn, { backgroundColor: colors.chip }]}
        accessibilityRole="button"
        accessibilityLabel={t('connectWallet')}
      >
        <AppText style={[styles.btnText, { color: colors.text }]}>{t('connectWallet')}</AppText>
      </TouchableOpacity>
      {connected && address ? (
        <AppText style={[styles.meta, { color: colors.text }]}>{formatAddress(address)}</AppText>
      ) : null}
      {error ? <AppText style={[styles.error, { color: colors.danger }]}>{error}</AppText> : null}
      <TouchableOpacity
        disabled={busy || !connected}
        onPress={() => void submit()}
        style={[styles.btn, { backgroundColor: connected ? colors.primary : colors.chip, marginTop: 12 }]}
        accessibilityRole="button"
        accessibilityLabel={t('linkWalletBind')}
      >
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <AppText style={[styles.btnText, { color: connected ? colors.onPrimary : colors.textMuted }]}>
            {t('linkWalletBind')}
          </AppText>
        )}
      </TouchableOpacity>
      {allowSkip ? (
      <TouchableOpacity
        disabled={busy}
        onPress={() => void skip()}
        style={styles.skip}
        accessibilityRole="button"
        accessibilityLabel={t('linkWalletSkip')}
      >
        <AppText style={[styles.skipText, { color: colors.textMuted }]}>{t('linkWalletSkip')}</AppText>
      </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  btn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
  },
  error: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  skip: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
