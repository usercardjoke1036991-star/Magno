import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import type { TranslationKey } from '../i18n/translations';
import { subscribeRuntimeMode } from '../constants/rpcConfig';
import { loadMovementHistory, type Movement, type MovementKind } from '../services/movementHistory';
import { formatAddress } from '../utils/formatters';
import { AppText } from './AppText';

const KIND_KEY: Record<MovementKind, TranslationKey> = {
  loan: 'historyLoan',
  payment: 'historyPayment',
  transfer_out: 'historyTransferOut',
  transfer_in: 'historyTransferIn',
  bonus: 'historyBonus',
  donation: 'historyDonation',
};

function formatWhen(timestamp: number): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString();
}

export const MovementHistory: React.FC<{
  walletAddress: string;
  enabled: boolean;
}> = ({ walletAddress, enabled }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [items, setItems] = useState<Movement[]>([]);
  const [partial, setPartial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled || !walletAddress) return;
    let cancelled = false;
    const load = () => {
      setLoading(true);
      setError(false);
      loadMovementHistory(walletAddress)
        .then((snapshot) => {
          if (cancelled) return;
          setItems(snapshot.items);
          setPartial(snapshot.partial);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const unsub = subscribeRuntimeMode(() => {
      setItems([]);
      load();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [enabled, walletAddress]);

  return (
    <View>
      <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('historyLead')}</AppText>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}
      {error ? <AppText style={[styles.warn, { color: colors.danger }]}>{t('referralLoadError')}</AppText> : null}
      {partial ? <AppText style={[styles.warn, { color: colors.warnText }]}>{t('historyPartial')}</AppText> : null}
      {!loading && !items.length ? (
        <AppText style={[styles.empty, { color: colors.textMuted }]}>{t('historyEmpty')}</AppText>
      ) : null}
      {items.map((item) => (
        <View key={item.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <AppText style={[styles.kind, { color: colors.primary }]}>{t(KIND_KEY[item.kind])}</AppText>
          <AppText style={[styles.amount, { color: colors.text }]}>{item.amountLabel}</AppText>
          <AppText style={[styles.meta, { color: colors.textMuted }]}>
            {t('historyFrom')}: {formatAddress(item.from)}
          </AppText>
          <AppText style={[styles.meta, { color: colors.textMuted }]}>
            {t('historyTo')}: {formatAddress(item.to)}
          </AppText>
          <AppText style={[styles.meta, { color: colors.textMuted }]}>
            {t('historyPlatform')}: {item.platform}
          </AppText>
          <AppText style={[styles.meta, { color: colors.textMuted }]}>
            {t('historyWorld')}: {item.world === 'live' ? t('accountWorldLive') : t('accountWorldDemo')}
          </AppText>
          <AppText style={[styles.meta, { color: colors.textMuted }]}>
            {t('historyWhen')}: {formatWhen(item.timestamp)}
          </AppText>
          {item.dueAt ? (
            <AppText style={[styles.meta, { color: colors.textMuted }]}>
              {t('historyDue')}: {formatWhen(item.dueAt)}
            </AppText>
          ) : null}
          {item.txHash ? (
            <AppText selectable style={[styles.hash, { color: colors.textMuted }]}>
              {t('historyHash')}: {item.txHash}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  lead: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  spinner: {
    marginVertical: 12,
  },
  warn: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  empty: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  kind: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    lineHeight: 17,
  },
  hash: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
});
