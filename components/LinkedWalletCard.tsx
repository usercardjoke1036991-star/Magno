import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAccount, useAppKit } from '@reown/appkit-react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { formatAddress } from '../utils/formatters';
import {
  hasLinkedExternalWallet,
  loadRequiredExternalWallet,
  saveLinkedExternalWallet,
} from '../services/linkedWallet';
import { AppText } from './AppText';

interface LinkedWalletCardProps {
  internalWallet: string;
  compact?: boolean;
}

export function LinkedWalletCard({ internalWallet, compact = false }: LinkedWalletCardProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const [linked, setLinked] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!internalWallet) return undefined;
    let live = true;
    loadRequiredExternalWallet(internalWallet)
      .then((stored) => {
        if (live) setLinked(stored);
      })
      .catch(() => {
        if (live) setLinked('');
      });
    return () => {
      live = false;
    };
  }, [internalWallet, address, isConnected]);

  const saveConnected = async () => {
    if (!hasLinkedExternalWallet(address || '')) {
      open();
      return;
    }
    setBusy(true);
    try {
      const saved = await saveLinkedExternalWallet(internalWallet, address || '');
      setLinked(saved);
    } catch {
      open();
    } finally {
      setBusy(false);
    }
  };

  const connectedReady = hasLinkedExternalWallet(address || '');
  const mismatch = Boolean(linked && connectedReady && String(address).toLowerCase() !== linked.toLowerCase());

  return (
    <View
      style={[
        styles.box,
        compact ? styles.compact : null,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <AppText style={[styles.title, { color: colors.text }]}>{t('wallet')}</AppText>
      {linked ? (
        <AppText selectable style={[styles.lead, { color: colors.textMuted }]}>
          {formatAddress(linked)}
        </AppText>
      ) : null}
      {mismatch ? (
        <AppText style={[styles.meta, { color: colors.warnText }]}>{t('linkWalletMismatch')}</AppText>
      ) : null}
      <TouchableOpacity
        disabled={busy}
        onPress={() => (linked && connectedReady && !mismatch ? open() : void saveConnected())}
        style={[styles.btn, { backgroundColor: linked ? colors.chip : colors.primary }]}
        accessibilityRole="button"
        accessibilityLabel={t('linkWalletBind')}
      >
        {busy ? (
          <ActivityIndicator color={linked ? colors.text : colors.onPrimary} />
        ) : (
          <AppText style={[styles.btnText, { color: linked ? colors.text : colors.onPrimary }]}>
            {t('linkWalletBind')}
          </AppText>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  compact: {
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  lead: {
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    fontSize: 12,
    lineHeight: 17,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
