import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AppText } from './AppText';
import { UserInfo } from '../hooks/useWeb3Balances';
import { formatCountdownClock, formatDueDate } from '../utils/formatters';
import { useLiveCooldown } from '../hooks/useLiveCooldown';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './icons';
import { formatRankLabel, getRankForLevel } from '../constants/ranks';
import { ProfileAvatar } from './ProfileAvatar';
import { useUserProfile } from '../profile/ProfileContext';
import type { DebtReminderKind } from '../utils/debtReminders';

interface UserMetricsProps {
  userInfo: UserInfo;
  reminder?: DebtReminderKind | null;
  showDebt?: boolean;
  showRank?: boolean;
  onPayLoan?: () => void;
  onPayAll?: () => void;
  onPayCount?: (count: number) => void;
  isPaying?: boolean;
}

export const UserMetrics: React.FC<UserMetricsProps> = ({
  userInfo,
  reminder = null,
  showDebt = true,
  showRank = true,
  onPayLoan,
  onPayAll,
  onPayCount,
  isPaying = false,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { profile, walletAddress } = useUserProfile();
  const rank = getRankForLevel(userInfo.userProgress.nivelActual);
  const rankLabel = formatRankLabel(rank, t(rank.nameKey));
  const remainingInstallments = userInfo.activeLoan
    ? Math.max(0, userInfo.activeLoan.cuotasTotales - userInfo.activeLoan.cuotasPagadas)
    : 0;
  const cooldownLeft = useLiveCooldown(userInfo.userProgress.ultimoPrestamoTimestamp);

  return (
    <View>
      {showRank ? (
        <>
          <View style={[styles.rankBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ProfileAvatar
              profile={profile}
              wallet={walletAddress}
              size={52}
              level={rank.level}
              rankName={t(rank.nameKey)}
              showRankLabel
            />
            <View style={styles.rankBannerText}>
              <AppText style={[styles.rankEyebrow, { color: colors.textMuted }]}>{t('rankYourRank')}</AppText>
              <AppText style={[styles.rankTitle, { color: colors.text }]}>{rankLabel}</AppText>
              <AppText style={[styles.rankMeta, { color: colors.textMuted }]}>
                {t('level')} {userInfo.userProgress.nivelActual}/10
              </AppText>
              <AppText style={[styles.rankHint, { color: colors.textMuted }]}>{t('rankFrameHint')}</AppText>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <View style={styles.metricLabelRow}>
                <AppIcon name="star" size={14} color={colors.textMuted} />
                <AppText style={[styles.metricLabel, { color: colors.textMuted }]}>{t('level')}</AppText>
              </View>
              <AppText style={[styles.metricValue, { color: colors.text }]}>{userInfo.userProgress.nivelActual}/10</AppText>
            </View>

            <View style={styles.metricItem}>
              <View style={styles.metricLabelRow}>
                <AppIcon name="shield" size={14} color={colors.textMuted} />
                <AppText style={[styles.metricLabel, { color: colors.textMuted }]}>{t('reputation')}</AppText>
              </View>
              <AppText style={[styles.metricValue, { color: userInfo.isDelinquent ? colors.danger : colors.success }]}>
                {userInfo.reputation}
              </AppText>
              <AppText style={[styles.rankHint, { color: colors.textMuted }]}>
                {t('referralRepScoreShort', { network: String(userInfo.networkPoints || 0) })}
              </AppText>
            </View>

            <View style={styles.metricItem}>
              <View style={styles.metricLabelRow}>
                <AppIcon name="chart" size={14} color={colors.textMuted} />
                <AppText style={[styles.metricLabel, { color: colors.textMuted }]}>{t('toLevelUp')}</AppText>
              </View>
              <AppText style={[styles.metricValue, { color: colors.text }]}>
                {userInfo.userProgress.nivelActual >= 10
                  ? t('maxLevelReached')
                  : `${userInfo.userProgress.solicitudesCompletadas}/${
                      userInfo.userProgress.nivelActual <= 1 ? 3 : 5
                    } ${t('onTimePayments')}`}
              </AppText>
            </View>

            <View style={styles.metricItem}>
              <View style={styles.metricLabelRow}>
                <AppIcon name="history" size={14} color={colors.textMuted} />
                <AppText style={[styles.metricLabel, { color: colors.textMuted }]}>{t('cooldown')}</AppText>
              </View>
              <AppText style={[styles.metricValue, { color: colors.text }]}>
                {cooldownLeft > 0 ? formatCountdownClock(cooldownLeft) : t('available')}
              </AppText>
            </View>
          </View>

          <View style={styles.statusBadges}>
            {userInfo.isRegistered && (
              <View style={[styles.badge, { borderColor: colors.border }]}>
                <AppIcon name="check" size={12} color={colors.success} />
                <AppText style={[styles.badgeText, { color: colors.text }]}>{t('registered')}</AppText>
              </View>
            )}
            {userInfo.hasActiveLoan && (
              <View style={[styles.badge, { borderColor: colors.border }]}>
                <AppIcon name="bank" size={12} color={colors.textMuted} />
                <AppText style={[styles.badgeText, { color: colors.text }]}>{t('activeLoan')}</AppText>
              </View>
            )}
            {userInfo.isDelinquent && (
              <View style={[styles.badge, { borderColor: colors.danger }]}>
                <AppIcon name="warning" size={12} color={colors.danger} />
                <AppText style={[styles.badgeText, { color: colors.danger }]}>{t('delinquent')}</AppText>
              </View>
            )}
          </View>
        </>
      ) : null}

      {showDebt && userInfo.activeLoan ? (
        <View style={[styles.loanBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {reminder ? (
            <View style={[styles.reminder, { backgroundColor: reminder === 'cutoff' ? colors.warnBg : colors.surface, borderColor: colors.border }]}>
              <AppIcon name="bell" size={14} color={reminder === 'cutoff' ? colors.danger : colors.textMuted} />
              <AppText style={[styles.reminderText, { color: reminder === 'cutoff' ? colors.danger : colors.text }]}>
                {reminder === 'cutoff' ? t('debtReminderCutoff') : t('debtReminderMid')}
              </AppText>
            </View>
          ) : null}
          <View style={styles.loanTitleRow}>
            <AppIcon name="warning" size={16} color={colors.textMuted} />
            <AppText style={[styles.loanTitle, { color: colors.textMuted }]}>{t('activeDebt')}</AppText>
          </View>
          <AppText style={[styles.loanLine, { color: colors.text }]}>{userInfo.activeLoan.totalDueLabel}</AppText>
          <AppText style={[styles.loanMeta, { color: colors.textMuted }]}>
            {t('due')}: {formatDueDate(userInfo.activeLoan.proximaCuota || userInfo.activeLoan.vencimiento)}
          </AppText>
          {remainingInstallments > 1 ? (
            <AppText style={[styles.loanMeta, { color: colors.textMuted }]}>{t('payChoiceLead')}</AppText>
          ) : null}
          {onPayLoan ? (
            <TouchableOpacity
              disabled={isPaying}
              onPress={onPayLoan}
              style={[styles.payBtn, { backgroundColor: colors.primary }]}
            >
              {isPaying ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <AppText style={[styles.payBtnText, { color: colors.onPrimary }]}>
                  {userInfo.activeLoan.cuotasTotales > 1
                    ? t('payInstallment', {
                        current: userInfo.activeLoan.cuotasPagadas + 1,
                        total: userInfo.activeLoan.cuotasTotales,
                        amount: userInfo.activeLoan.cuotaLabel,
                      })
                    : `${t('pay')} ${userInfo.activeLoan.remainingLabel || userInfo.activeLoan.totalDueLabel}`}
                </AppText>
              )}
            </TouchableOpacity>
          ) : null}
          {onPayCount && remainingInstallments > 2 ? (
            <TouchableOpacity
              disabled={isPaying}
              onPress={() => onPayCount(2)}
              style={[styles.payBtn, styles.payAll, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <AppText style={[styles.payBtnText, { color: colors.text }]}>{t('payNInstallments', { count: 2 })}</AppText>
            </TouchableOpacity>
          ) : null}
          {onPayAll && remainingInstallments > 1 ? (
            <TouchableOpacity
              disabled={isPaying}
              onPress={onPayAll}
              style={[styles.payBtn, styles.payAll, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <AppText style={[styles.payBtnText, { color: colors.text }]}>
                {t('payAllNow', { amount: userInfo.activeLoan.remainingLabel })}
              </AppText>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  rankBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 12,
  },
  rankBannerText: {
    flex: 1,
  },
  rankEyebrow: {
    fontSize: 11,
    fontWeight: '500',
  },
  rankTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 2,
  },
  rankHint: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  rankMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  reminder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  reminderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metricItem: {
    width: '50%',
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  loanBox: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  loanTitle: {
    fontSize: 12,
  },
  loanTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  loanLine: {
    fontSize: 18,
    fontWeight: '600',
  },
  loanMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  payBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  payAll: {
    borderWidth: 1,
  },
  payBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
