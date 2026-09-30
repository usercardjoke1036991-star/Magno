import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { FAMA_POR_DIA_RACHA, RACHA_BONO_USDT, RACHA_GRACIA_DIAS, RACHA_HITOS } from '../constants/racha';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { formatUSD } from '../utils/formatters';
import { AppText } from './AppText';
import { AppIcon } from './icons';

export interface RachaView {
  dias: number;
  diasMax: number;
  famaDias: number;
  hitoCobrado: number;
  siguienteHito: number;
  bonoPendienteUsd: number;
  graciaVigente: boolean;
}

interface RachaSectionProps {
  racha: RachaView;
  canUse: boolean;
  isPaying?: boolean;
  onClaim: () => void;
}

export function RachaSection({ racha, canUse, isPaying = false, onClaim }: RachaSectionProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const pending = racha.bonoPendienteUsd > 0;
  const nextAmount = racha.siguienteHito ? rachaBonusLabel(racha.siguienteHito) : '';

  return (
    <View style={styles.stack}>
      <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('rachaLead')}</AppText>
      <AppText style={[styles.meta, { color: colors.textMuted }]}>
        {t('rachaHow', {
          fame: String(FAMA_POR_DIA_RACHA),
          grace: String(RACHA_GRACIA_DIAS),
        })}
      </AppText>
      <AppText style={[styles.stat, { color: colors.success }]}>{t('rachaDays', { count: String(racha.dias) })}</AppText>
      <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('rachaPeak', { count: String(racha.diasMax) })}</AppText>
      <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('rachaFameDays', { count: String(racha.famaDias) })}</AppText>
      <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('rachaDecayNote')}</AppText>
      <AppText style={[styles.meta, { color: colors.textMuted }]}>
        {racha.graciaVigente ? t('rachaGraceOn') : t('rachaGraceOff')}
      </AppText>

      {RACHA_HITOS.map((hito, index) => (
        <AppText key={hito} style={[styles.meta, { color: colors.success }]}>
          {t('rachaHitoLine', { days: String(hito), amount: formatUSD(RACHA_BONO_USDT[index]) })}
        </AppText>
      ))}

      {racha.siguienteHito ? (
        <AppText style={[styles.meta, { color: colors.textMuted }]}>
          {t('rachaNextBonus', { days: String(racha.siguienteHito), amount: nextAmount })}
        </AppText>
      ) : (
        <AppText style={[styles.meta, { color: colors.textMuted }]}>{t('rachaMaxReached')}</AppText>
      )}

      {!canUse ? (
        <AppText style={[styles.warn, { color: colors.warnText }]}>{t('rachaLegacy')}</AppText>
      ) : null}

      <TouchableOpacity
        disabled={!canUse || !pending || isPaying}
        onPress={onClaim}
        style={[
          styles.btn,
          {
            backgroundColor: canUse && pending ? colors.primary : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {isPaying ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <View style={styles.btnRow}>
            <AppIcon name="star" size={16} color={canUse && pending ? colors.onPrimary : colors.textMuted} />
            <AppText style={{ color: canUse && pending ? colors.onPrimary : colors.textMuted }}>
              {pending ? t('rachaClaim', { amount: formatUSD(racha.bonoPendienteUsd) }) : t('rachaNothing')}
            </AppText>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

function rachaBonusLabel(days: number): string {
  const index = RACHA_HITOS.indexOf(days as (typeof RACHA_HITOS)[number]);
  if (index < 0) return formatUSD(0);
  return formatUSD(RACHA_BONO_USDT[index]);
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  lead: { fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 13, lineHeight: 18 },
  stat: { fontSize: 22, fontWeight: '700' },
  warn: { fontSize: 13, lineHeight: 18 },
  btn: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
