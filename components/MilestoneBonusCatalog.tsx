import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { milestoneBonusUsd, milestoneLevels } from '../constants/loanTiers';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { formatUSD } from '../utils/formatters';
import { AppText } from './AppText';
import { AppIcon } from './icons';

interface MilestoneBonusCatalogProps {
  userLevel: number;
  lastHito: number;
  claimable: number;
  canClaim?: boolean;
  isPaying?: boolean;
  onClaim: () => void;
}

export function MilestoneBonusCatalog({
  userLevel,
  lastHito,
  claimable,
  canClaim = true,
  isPaying = false,
  onClaim,
}: MilestoneBonusCatalogProps) {
  const { t } = useI18n();
  const { colors } = useTheme();

  return (
    <View style={styles.stack}>
      <AppText style={[styles.lead, { color: colors.textMuted }]}>
        {canClaim ? t('bonusCatalogLead') : t('bonusLegacyContract')}
      </AppText>
      {milestoneLevels().map((level) => {
        const amount = formatUSD(milestoneBonusUsd(level));
        const claimed = lastHito >= level;
        const unlocked = userLevel >= level;
        const ready = canClaim && claimable === level;
        return (
          <View
            key={level}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.row}>
              <AppIcon
                name={claimed ? 'check' : unlocked ? 'star' : 'lock'}
                size={18}
                color={claimed ? colors.success : unlocked ? colors.primary : colors.textMuted}
              />
              <View style={styles.body}>
                <AppText style={[styles.title, { color: colors.text }]}>
                  {t('level')} {level}
                </AppText>
                <AppText style={[styles.amount, { color: colors.text }]}>{amount}</AppText>
                <AppText style={[styles.meta, { color: colors.textMuted }]}>
                  {claimed
                    ? t('bonusClaimed')
                    : ready
                      ? t('bonusReady')
                      : unlocked
                        ? t('poolBonusPending')
                        : t('bonusLocked')}
                </AppText>
              </View>
            </View>
            {ready ? (
              <TouchableOpacity
                disabled={isPaying}
                onPress={onClaim}
                style={[styles.btn, { backgroundColor: colors.primary }]}
              >
                {isPaying ? (
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                ) : (
                  <AppText style={[styles.btnText, { color: colors.onPrimary }]}>{t('claimPoolBonus')}</AppText>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10,
  },
  lead: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    marginTop: 4,
  },
  btn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
