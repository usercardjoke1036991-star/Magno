import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CANJE_USDT_BUTTONS, FAMA_CANJE_POR_USDT, FAMA_PER_REFERRAL_L1, FAMA_PER_USDT, famaNeededForUsdt, maxCanjeUsdt } from '../constants/fama';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { formatUSD, parsePositiveDecimal } from '../utils/formatters';
import { AppText, AppTextInput } from './AppText';
import { AppIcon } from './icons';

interface FameCanjeSectionProps {
  famaCaja: number;
  famaCanjeada: number;
  famaDisponible: number;
  canRedeem: boolean;
  tokenSymbol: string;
  isPaying?: boolean;
  onRedeem: (fama: number) => void;
}

export function FameCanjeSection({
  famaCaja,
  famaCanjeada,
  famaDisponible,
  canRedeem,
  tokenSymbol,
  isPaying = false,
  onRedeem,
}: FameCanjeSectionProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [amount, setAmount] = useState('1');
  const parsed = parsePositiveDecimal(amount);
  const usdtWanted = parsed ? Math.floor(Number(parsed)) : 0;
  const famaNeed = famaNeededForUsdt(usdtWanted);
  const maxUsdt = maxCanjeUsdt(famaDisponible);
  const ready = Boolean(canRedeem && usdtWanted >= 1 && famaNeed > 0 && famaNeed <= famaDisponible);

  return (
    <View style={styles.stack}>
      <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('canjeLead')}</AppText>
      <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('canjeNoLevelLock')}</AppText>
      <AppText style={[styles.meta, { color: colors.textMuted }]}>
        {t('canjeHow', {
          fameUsdt: String(FAMA_PER_USDT),
          fameRef: String(FAMA_PER_REFERRAL_L1),
          rate: String(FAMA_CANJE_POR_USDT),
        })}
      </AppText>
      <AppText style={[styles.stat, { color: colors.text }]}>{t('canjeProfile', { points: String(famaCaja) })}</AppText>
      <AppText style={[styles.stat, { color: colors.primary }]}>{t('canjeAvailable', { points: String(famaDisponible) })}</AppText>
      <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('canjeRedeemed', { points: String(famaCanjeada) })}</AppText>
      <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('canjeRate', { rate: String(FAMA_CANJE_POR_USDT) })}</AppText>

      {!canRedeem ? (
        <AppText style={[styles.warn, { color: colors.warnText }]}>{t('canjeLegacy')}</AppText>
      ) : null}

      <View style={styles.row}>
        {CANJE_USDT_BUTTONS.map((usd) => {
          const need = famaNeededForUsdt(usd);
          const enabled = canRedeem && !isPaying && need <= famaDisponible;
          return (
            <TouchableOpacity
              key={usd}
              disabled={!enabled}
              onPress={() => setAmount(String(usd))}
              style={[styles.chip, { borderColor: colors.border, backgroundColor: usdtWanted === usd ? colors.primary : colors.surface }]}
            >
              <AppText style={{ color: usdtWanted === usd ? colors.onPrimary : enabled ? colors.text : colors.textMuted }}>
                {formatUSD(usd)}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      <AppText style={[styles.label, { color: colors.primary }]}>
        {t('canjeAmount')} ({tokenSymbol})
      </AppText>
      <AppTextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="1"
        editable={canRedeem && !isPaying}
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
      />
      {usdtWanted >= 1 && famaNeed > famaDisponible ? (
        <AppText style={[styles.warn, { color: colors.warnText }]}>
          {t('canjeNeed', { points: String(famaNeed - famaDisponible) })}
        </AppText>
      ) : usdtWanted >= 1 ? (
        <AppText style={[styles.meta, { color: colors.textMuted }]}>
          {t('canjeUsdtOut', { amount: formatUSD(usdtWanted) })} · {famaNeed} → {formatUSD(usdtWanted)}
        </AppText>
      ) : null}
      {maxUsdt > 0 ? (
        <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('canjeButton', { amount: formatUSD(maxUsdt) })}</AppText>
      ) : null}

      <TouchableOpacity
        disabled={!ready || isPaying}
        onPress={() => onRedeem(famaNeed)}
        style={[styles.btn, { backgroundColor: ready ? colors.primary : colors.chip }]}
      >
        {isPaying ? (
          <ActivityIndicator color={colors.onPrimary} size="small" />
        ) : (
          <View style={styles.btnRow}>
            <AppIcon name="pay" size={18} color={ready ? colors.onPrimary : colors.textMuted} />
            <AppText style={[styles.btnText, { color: ready ? colors.onPrimary : colors.textMuted }]}>
              {t('canjeButton', { amount: formatUSD(Math.max(1, usdtWanted)) })}
            </AppText>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  lead: { fontSize: 13, lineHeight: 20 },
  meta: { fontSize: 12, lineHeight: 18 },
  stat: { fontSize: 15, fontWeight: '700' },
  warn: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  btn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontSize: 15, fontWeight: '700' },
});
