import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { Signer } from 'ethers';
import { formatUnits } from 'ethers';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { formatDueDate, formatUSD, parsePositiveDecimal } from '../utils/formatters';
import { showNotice } from '../utils/appNotice';
import { RESERVA_MIN_LEVEL } from '../constants/reserva';
import {
  bloquearReserva,
  desbloquearReserva,
  loadReservaPreview,
  renovarReserva,
  reservaErrorKey,
  type ReservaPreview,
} from '../services/reservaService';
import { AppSubsection } from './AppSection';
import { AppText, AppTextInput } from './AppText';
import { AppIcon } from './icons';

interface ReservaSectionProps {
  walletAddress: string;
  signer: Signer | null;
  tokenSymbol: string;
  tokenBalance?: string;
  identityBlocked: boolean;
  delinquent: boolean;
  paused: boolean;
  hasPadre: boolean;
  userLevel: number;
  isLoading?: boolean;
}

export function ReservaSection({
  walletAddress,
  signer,
  tokenSymbol,
  tokenBalance = '',
  identityBlocked,
  delinquent,
  paused,
  hasPadre,
  userLevel,
  isLoading = false,
}: ReservaSectionProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [amount, setAmount] = useState('50');
  const [acked, setAcked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ReservaPreview | null>(null);

  const refresh = useCallback(() => {
    if (!walletAddress) {
      setPreview(null);
      return;
    }
    loadReservaPreview(walletAddress, hasPadre)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [walletAddress, hasPadre]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const reservaPaused = Boolean(preview?.pausedOnChain);
  const creditPaused = paused;
  const levelOk = userLevel >= RESERVA_MIN_LEVEL;
  const canLock =
    Boolean(walletAddress) &&
    !busy &&
    !isLoading &&
    !identityBlocked &&
    !delinquent &&
    !creditPaused &&
    !reservaPaused &&
    levelOk &&
    acked &&
    !preview?.activa &&
    Boolean(preview?.practice || preview?.configured);
  const canUnlock =
    Boolean(walletAddress) &&
    !busy &&
    !isLoading &&
    Boolean(preview?.activa && preview.ready);
  const canRenew = canUnlock && levelOk && !delinquent && !creditPaused && !identityBlocked && !reservaPaused;
  const amountEditable = canLock;
  const parsed = parsePositiveDecimal(amount);

  async function run(action: () => Promise<void>, okKey: 'reservaBlockedOk' | 'reservaUnlockedOk' | 'reservaRenewedOk') {
    if (!signer) {
      showNotice(t('connect'), t('connectFirst'));
      return;
    }
    setBusy(true);
    try {
      await action();
      showNotice(t('ready'), t(okKey));
      refresh();
    } catch (error) {
      showNotice(t('error'), t(reservaErrorKey(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack}>
      <AppSubsection title={t('reservaTitle')} defaultOpen icon="lock">
        <AppText style={[styles.lead, { color: colors.text }]}>{t('reservaLead')}</AppText>
        <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('reservaNotBank')}</AppText>
        <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('reservaLockNote')}</AppText>
        <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('reservaCapNote')}</AppText>
        <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('reservaBoostComision')}</AppText>
        <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('reservaFounderNote')}</AppText>
        {preview ? (
          <AppText style={[styles.meta, { color: colors.textMuted }]}>
            {t('reservaBoteLabel')}: {formatUSD(Number(formatUnits(preview.boteWei, 18)))} {tokenSymbol}
          </AppText>
        ) : null}
        {preview?.practice ? (
          <AppText style={[styles.meta, { color: colors.warnText }]}>{t('reservaDemoPractice')}</AppText>
        ) : null}
        {identityBlocked ? (
          <AppText style={[styles.warn, { color: colors.warnText }]}>{t('reservaNeedIdentity')}</AppText>
        ) : null}
        {delinquent ? (
          <AppText style={[styles.warn, { color: colors.warnText }]}>{t('reservaDelinquent')}</AppText>
        ) : null}
        {!levelOk && !preview?.activa ? (
          <AppText style={[styles.warn, { color: colors.warnText }]}>{t('reservaNeedLevel')}</AppText>
        ) : null}
        {creditPaused || reservaPaused ? (
          <AppText style={[styles.warn, { color: colors.warnText }]}>{t('securityPausedBanner')}</AppText>
        ) : null}
        {!preview?.practice && !preview?.configured && !identityBlocked ? (
          <AppText style={[styles.warn, { color: colors.warnText }]}>{t('reservaNoContract')}</AppText>
        ) : null}
        {preview?.activa ? (
          <>
            <AppText style={[styles.meta, { color: colors.primary }]}>
              {t('reservaLocked')}: {formatUSD(Number(formatUnits(preview.principalWei, 18)))} {tokenSymbol}
            </AppText>
            <AppText style={[styles.meta, { color: colors.textMuted }]}>
              {t('reservaUntil')}: {formatDueDate(preview.unlockAt)}
            </AppText>
            <AppText style={[styles.meta, { color: colors.textMuted }]}>
              {t('reservaYieldEst')}: {formatUSD(Number(formatUnits(preview.techoWei, 18)))} · {t('reservaTier', { tier: String(preview.tramo) })}
            </AppText>
            {preview.enRed ? (
              <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('reservaBoost')}</AppText>
            ) : null}
          </>
        ) : null}
        {!preview?.activa ? (
          <>
            <AppText style={[styles.label, { color: colors.primary }]}>
              {t('reservaAmount')} ({tokenSymbol}
              {tokenBalance ? ` · ${tokenBalance}` : ''})
            </AppText>
            <AppTextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="50"
              editable={amountEditable}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },
              ]}
            />
          </>
        ) : null}
        <TouchableOpacity
          onPress={() => setAcked((value) => !value)}
          style={styles.ackRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acked }}
        >
          <View style={[styles.box, { borderColor: colors.border, backgroundColor: acked ? colors.primary : colors.inputBg }]} />
          <AppText style={[styles.ack, { color: colors.text }]}>{t('reservaAck')}</AppText>
        </TouchableOpacity>
        {!preview?.activa ? (
          <TouchableOpacity
            disabled={!canLock || !parsed}
            onPress={() => void run(() => bloquearReserva(signer as Signer, parsed || '0', hasPadre), 'reservaBlockedOk')}
            style={[styles.button, { backgroundColor: canLock && parsed ? colors.primary : colors.chip }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <View style={styles.buttonRow}>
                <AppIcon name="lock" size={18} color={canLock && parsed ? colors.onPrimary : colors.textMuted} />
                <AppText style={[styles.buttonText, { color: canLock && parsed ? colors.onPrimary : colors.textMuted }]}>
                  {t('reservaBlock')}
                </AppText>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity
              disabled={!canUnlock}
              onPress={() => void run(() => desbloquearReserva(signer as Signer), 'reservaUnlockedOk')}
              style={[styles.button, { backgroundColor: canUnlock ? colors.primary : colors.chip }]}
            >
              <AppText style={[styles.buttonText, { color: canUnlock ? colors.onPrimary : colors.textMuted }]}>
                {t('reservaUnlock')}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!canRenew}
              onPress={() => void run(() => renovarReserva(signer as Signer, hasPadre), 'reservaRenewedOk')}
              style={[styles.button, { backgroundColor: canRenew ? colors.primary : colors.chip }]}
            >
              <AppText style={[styles.buttonText, { color: canRenew ? colors.onPrimary : colors.textMuted }]}>
                {t('reservaRenew')}
              </AppText>
            </TouchableOpacity>
          </View>
        )}
      </AppSubsection>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  lead: { fontSize: 13, lineHeight: 20, marginBottom: 8 },
  meta: { fontSize: 12, lineHeight: 18, marginBottom: 6 },
  warn: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  ackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginVertical: 10 },
  box: { width: 18, height: 18, borderWidth: 1, borderRadius: 4, marginTop: 2 },
  ack: { flex: 1, fontSize: 12, lineHeight: 18 },
  button: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  actions: { gap: 8 },
});
