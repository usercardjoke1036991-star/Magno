import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LoanTier } from '../hooks/useWeb3Balances';
import { formatUSD } from '../utils/formatters';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { formatRankLabel, getRankForLevel } from '../constants/ranks';
import { RankMedal } from './RankMedal';
import { AppIcon } from './icons';
import { directCommissionFromLoan, formatCommissionUSD, ACTIVATION_BONUS_USD } from '../constants/commissions';

interface LoanTierCardProps {
  tier: LoanTier;
  userLevel: number;
  hasActiveLoan: boolean;
  isActiveTier: boolean;
  dueLabel?: string;
  cuotaLabel?: string;
  cuotasPagadas?: number;
  cuotasTotales?: number;
  remainingLabel?: string;
  isLoading: boolean;
  isDelinquent?: boolean;
  paused?: boolean;
  curveRateBps?: number;
  onRequestLoan: (tier: LoanTier) => void;
  onPayLoan: () => void;
  onPayAll?: () => void;
  onPayCount?: (count: number) => void;
}

export const LoanTierCard: React.FC<LoanTierCardProps> = ({
  tier,
  userLevel,
  hasActiveLoan,
  isActiveTier,
  dueLabel,
  cuotaLabel,
  cuotasPagadas = 0,
  cuotasTotales = 1,
  remainingLabel,
  isLoading,
  isDelinquent = false,
  paused = false,
  curveRateBps = 0,
  onRequestLoan,
  onPayAll,
  onPayCount,
  onPayLoan,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const locked = tier.id > userLevel;
  const unlocked = !locked;
  const appliedBps = Math.max(tier.interestBps, curveRateBps || 0);
  const interest = (tier.usdAmount * appliedBps) / 10000;
  const totalRepay = tier.usdAmount + interest;
  const installments = tier.installments || 1;
  const cuotaPreview = formatUSD(totalRepay / installments);
  const isMaxLevel = tier.id === 10;
  const rank = getRankForLevel(tier.id);
  const rankLabel = formatRankLabel(rank, t(rank.nameKey));
  const referralEarn = formatCommissionUSD(directCommissionFromLoan(tier.usdAmount, appliedBps));
  const curveRaisesRate = appliedBps > tier.interestBps;
  const remainingInstallments = Math.max(0, cuotasTotales - cuotasPagadas);

  return (
    <View style={[
      styles.tierCard,
      {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      locked && { opacity: 0.55 },
    ]}>
      <View style={[styles.accent, { backgroundColor: locked ? colors.border : rank.metal }]} />
      <View style={styles.tierRow}>
        <View style={styles.titleBlock}>
          <RankMedal level={tier.id} rank={rank} size={36} dimmed={locked} />
          <View style={styles.titleText}>
            <Text style={[styles.rankName, { color: colors.textMuted }]}>{rankLabel}</Text>
            <Text style={[styles.tierTitle, { color: colors.text }]}>{tier.name}</Text>
          </View>
        </View>
        {locked ? (
          <Text style={[styles.metaBadge, { color: colors.textMuted }]}>{t('loanLockedBadge')}</Text>
        ) : (
          <Text style={[styles.metaBadge, { color: colors.success }]}>{t('loanUnlockedBadge')}</Text>
        )}
      </View>

      <Text style={[styles.tierAmount, { color: colors.text }]}>{formatUSD(tier.usdAmount)}</Text>
      <Text style={[styles.tierRate, { color: colors.text }]}>
        {t('interestRate', { rate: String(appliedBps / 100) })}
      </Text>
      {curveRaisesRate ? (
        <Text style={[styles.tierMeta, { color: colors.textMuted }]}>
          {t('interestRateCurveNote', { floor: String(tier.interestBps / 100) })}
        </Text>
      ) : null}
      <Text style={[styles.tierMeta, { color: colors.textMuted }]}>
        {t('interestAmount', { amount: formatUSD(interest) })}
      </Text>
      <Text style={[styles.tierTotal, { color: colors.text }]}>
        {t('totalRepay', { amount: formatUSD(totalRepay) })}
      </Text>
      {installments > 1 ? (
        <Text style={[styles.tierMeta, { color: colors.textMuted }]}>
          {t('installmentPlan', { count: installments, amount: cuotaPreview })}
        </Text>
      ) : (
        <Text style={[styles.tierMeta, { color: colors.textMuted }]}>{t('repayOnce')}</Text>
      )}
      <Text style={[styles.tierMeta, { color: colors.textMuted }]}>{t('term')}: {tier.term}</Text>
      {isMaxLevel ? (
        <Text style={[styles.tierMeta, { color: colors.textMuted }]}>{t('maxLevelNote')}</Text>
      ) : (
        <Text style={[styles.tierMeta, { color: colors.textMuted }]}>{t('payOnTimeToLevel', { count: tier.requiredCount })}</Text>
      )}
      <Text style={[styles.earnNote, { color: colors.textMuted }]}>
        {tier.id === 1
          ? t('referralEarnLevel1', {
              bonus: formatCommissionUSD(ACTIVATION_BONUS_USD),
              amount: referralEarn,
            })
          : t('referralEarnLevel', { amount: referralEarn })}
      </Text>

      <View style={styles.tierActions}>
        {isActiveTier && hasActiveLoan ? (
          <>
            {remainingLabel && remainingInstallments > 1 && (
              <Text style={[styles.tierMeta, { color: colors.textMuted }]}>{t('payChoiceLead')}</Text>
            )}
            {remainingLabel && remainingInstallments > 1 && (
              <Text style={[styles.tierMeta, { color: colors.textMuted }]}>{t('remainingDebt', { amount: remainingLabel })}</Text>
            )}
            <TouchableOpacity
              disabled={isLoading}
              onPress={onPayLoan}
              style={[styles.btn, { backgroundColor: colors.primary }]}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <View style={styles.btnRow}>
                  <AppIcon name="pay" size={16} color={colors.onPrimary} />
                  <Text style={[styles.btnText, { color: colors.onPrimary }]}>
                    {cuotasTotales > 1
                      ? t('payInstallment', {
                          current: cuotasPagadas + 1,
                          total: cuotasTotales,
                          amount: cuotaLabel || dueLabel || t('debt'),
                        })
                      : `${t('pay')} ${dueLabel || t('debt')}`}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {remainingInstallments > 2 && onPayCount ? (
              <TouchableOpacity
                disabled={isLoading}
                onPress={() => onPayCount(2)}
                style={[styles.btn, styles.btnSecond, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.btnText, { color: colors.text }]}>{t('payNInstallments', { count: 2 })}</Text>
              </TouchableOpacity>
            ) : null}
            {remainingInstallments > 1 && onPayAll ? (
              <TouchableOpacity
                disabled={isLoading}
                onPress={onPayAll}
                style={[styles.btn, styles.btnSecond, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.btnText, { color: colors.text }]}>
                  {t('payAllNow', { amount: remainingLabel || dueLabel || t('debt') })}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <TouchableOpacity
            disabled={isLoading || locked || hasActiveLoan || isDelinquent || paused}
            onPress={() => onRequestLoan(tier)}
            style={[
              styles.btn,
              locked || hasActiveLoan || isDelinquent || paused
                ? { backgroundColor: colors.chip }
                : { backgroundColor: colors.primary },
            ]}
          >
            {isLoading && unlocked && !hasActiveLoan ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <View style={styles.btnRow}>
                <AppIcon
                  name={locked || isDelinquent || paused ? 'lock' : 'bank'}
                  size={16}
                  color={locked || hasActiveLoan || isDelinquent || paused ? colors.textMuted : colors.onPrimary}
                />
                <Text
                  style={[
                    styles.btnText,
                    {
                      color:
                        locked || hasActiveLoan || isDelinquent || paused ? colors.textMuted : colors.onPrimary,
                    },
                  ]}
                >
                  {paused
                    ? t('actionPaused')
                    : isDelinquent
                      ? t('delinquent')
                      : hasActiveLoan && unlocked
                        ? t('loanBusy')
                        : t('requestUncollateralized')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tierCard: {
    borderRadius: 12,
    padding: 16,
    paddingLeft: 18,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
    gap: 10,
  },
  titleText: {
    flex: 1,
  },
  rankName: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  tierTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  metaBadge: {
    fontSize: 11,
    fontWeight: '500',
  },
  tierAmount: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  tierRate: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  tierTotal: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 6,
  },
  tierMeta: {
    fontSize: 13,
    marginBottom: 2,
  },
  earnNote: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 8,
    lineHeight: 17,
  },
  tierActions: {
    marginTop: 12,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecond: {
    marginTop: 8,
    borderWidth: 1,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
