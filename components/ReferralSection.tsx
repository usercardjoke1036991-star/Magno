import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { addressToInviteCode, buildInviteLink } from '../utils/inviteCode';
import { AppIcon } from './icons';
import { ProfileAvatar } from './ProfileAvatar';
import { useUserProfile } from '../profile/ProfileContext';
import { labelForProfile } from '../services/userProfile';
import { formatRankLabel, getRankForLevel } from '../constants/ranks';
import { useWalletLevel } from '../hooks/useWalletLevel';
import { LOAN_TIERS } from '../constants/loanTiers';
import {
  ACTIVATION_BONUS_USD,
  directCommissionFromLoan,
  formatCommissionUSD,
} from '../constants/commissions';
import {
  REFERRAL_BONUS_THRESHOLD,
  REFERRAL_NETWORK_POINTS,
  REFERRAL_REPUTATION_POINTS,
  formatPoolBonus,
  referralsForNextBonus,
} from '../constants/reputation';
import { formatUSD } from '../utils/formatters';
import { openSafeUrl } from '../utils/safeOpenUrl';
import { AppSubsection } from './AppSection';

export interface ReferralInfo {
  padre: string;
  fundador: string;
  isFundador: boolean;
  bonoActivacionCobrado: boolean;
  royaltiesCongeladas: boolean;
}

interface ReferralSectionProps {
  walletAddress: string;
  isRegistered: boolean;
  isRestricted?: boolean;
  curveRateBps?: number;
  referral?: ReferralInfo;
  reputation?: number;
  networkPoints?: number;
  networkBonusThreshold?: number;
  children?: React.ReactNode;
}

const ZERO = '0x0000000000000000000000000000000000000000';

export const ReferralSection: React.FC<ReferralSectionProps> = ({
  walletAddress,
  isRegistered,
  isRestricted = false,
  curveRateBps = 0,
  referral,
  reputation = 0,
  networkPoints = 0,
  networkBonusThreshold = REFERRAL_BONUS_THRESHOLD,
  children,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { profile, lookup } = useUserProfile();
  const padre = referral?.padre || '';
  const isFundador = Boolean(referral?.isFundador);
  const bonoActivacionCobrado = Boolean(referral?.bonoActivacionCobrado);
  const royaltiesCongeladas = Boolean(referral?.royaltiesCongeladas);

  const hasPadre = Boolean(padre) && padre.toLowerCase() !== ZERO;
  const myCode = walletAddress ? addressToInviteCode(walletAddress) : '';
  const inviteLink = myCode ? buildInviteLink(myCode, profile.displayName) : '';
  const padreCode = hasPadre ? addressToInviteCode(padre) : '';
  const padreProfile = hasPadre ? lookup(padre) : undefined;
  const padreLabel = hasPadre
    ? labelForProfile(padreProfile, padreCode)
    : '';
  const padreLevel = useWalletLevel(hasPadre ? padre : '');

  const shareName = profile.displayName || t('profileSomeone');
  const shareText = t('shareMessage', { code: myCode, link: inviteLink, name: shareName });

  const guardShare = () => {
    if (isRestricted) {
      Alert.alert(t('delinquent'), t('shareDisabledMora'));
      return false;
    }
    if (!walletAddress || !myCode) {
      Alert.alert(t('connect'), t('connectForInvite'));
      return false;
    }
    return true;
  };

  const handleShare = async () => {
    if (!guardShare()) return;
    try {
      await Share.share({
        title: t('shareTitle'),
        message: shareText,
      });
    } catch {
      Alert.alert(t('invite'), myCode);
    }
  };

  const handleWhatsApp = async () => {
    if (!guardShare()) return;
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    try {
      const opened = await openSafeUrl(url);
      if (!opened) await handleShare();
    } catch {
      await handleShare();
    }
  };

  return (
    <View style={styles.stack}>
      {isRestricted && (
        <Text style={styles.warn}>{t('moraBlocked')}</Text>
      )}

      <AppSubsection title={t('subsectionInvite')} defaultOpen icon="share">
          {isFundador && (
        <View style={[styles.founderBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppIcon name="star" size={16} color={colors.text} />
          <Text style={[styles.founderBadgeText, { color: colors.text }]}>{t('youAreFounder')}</Text>
        </View>
      )}

          <View style={styles.labelRow}>
            <AppIcon name="copy" size={14} color={colors.textMuted} />
            <Text style={[styles.label, { color: colors.textMuted }]}>{t('inviteCode')}</Text>
          </View>
      <Text selectable style={[styles.code, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}>
        {myCode || t('connectForCode')}
      </Text>
      {Boolean(inviteLink) && (
        <Text selectable style={[styles.link, { color: colors.primary }]}>
          {inviteLink}
        </Text>
      )}
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('inviteLinkHint')}</Text>
      <TouchableOpacity
        style={[styles.shareButton, { backgroundColor: colors.primary }, isRestricted && styles.shareDisabled]}
        onPress={handleShare}
        disabled={!myCode || isRestricted}
      >
        <View style={styles.btnRow}>
          <AppIcon name="share" size={16} color={colors.onPrimary} />
          <Text style={[styles.shareButtonText, { color: colors.onPrimary }]}>{t('shareInvite')}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.whatsappButton, isRestricted && styles.shareDisabled]}
        onPress={handleWhatsApp}
        disabled={!myCode || isRestricted}
      >
        <View style={styles.btnRow}>
          <AppIcon name="whatsapp" size={18} color="#fff" />
          <Text style={styles.shareButtonText}>{t('shareInviteWhatsApp')}</Text>
        </View>
      </TouchableOpacity>

      {isRegistered ? (
        <View style={[styles.meta, { backgroundColor: colors.card }]}>
          {hasPadre && !isFundador ? (
            <View style={styles.invitedBy}>
              <ProfileAvatar
                profile={padreProfile}
                wallet={padre}
                size={32}
                level={padreLevel}
                rankName={t(getRankForLevel(padreLevel).nameKey)}
                showRankLabel={false}
              />
              <Text style={[styles.metaLine, { color: colors.text, flex: 1 }]}>
                {t('invitedBy')}: {padreLabel}
              </Text>
            </View>
          ) : (
            <Text style={[styles.metaLine, { color: colors.text }]}>
              {t('invitedBy')}: {isFundador ? t('nobodyRoot') : t('pending')}
            </Text>
          )}
          <Text style={[styles.metaLine, { color: colors.text }]}>
            {t('activationBonus')}:{' '}
            {isFundador
              ? t('notApplicable')
              : bonoActivacionCobrado
                ? t('bonusPaid')
                : t('bonusPending')}
          </Text>
          {royaltiesCongeladas && (
            <Text style={styles.warn}>{t('royaltiesFrozen')}</Text>
          )}
        </View>
      ) : (
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('referralHint')}</Text>
      )}
      </AppSubsection>

      <AppSubsection title={t('referralRepTitle')} defaultOpen icon="star">
        <Text style={[styles.earnHint, { color: colors.textMuted }]}>
          {t('referralRepLead', {
            points: String(REFERRAL_REPUTATION_POINTS),
            network: String(REFERRAL_NETWORK_POINTS),
            threshold: String(networkBonusThreshold),
            bonus: formatPoolBonus(),
          })}
        </Text>
        <Text style={[styles.metaLine, { color: colors.text }]}>
          {t('referralRepScore', { score: String(reputation), network: String(networkPoints) })}
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('referralRepNext', {
            left: String(referralsForNextBonus(networkPoints, networkBonusThreshold)),
            bonus: formatPoolBonus(),
          })}
        </Text>
      </AppSubsection>

      <AppSubsection title={t('referralEarnTitle')} defaultOpen={false} icon="pay">
        <Text style={[styles.earnHint, { color: colors.textMuted }]}>{t('referralLead')}</Text>
        <View style={styles.earnHead}>
          <Text style={[styles.earnHeadCell, { color: colors.textMuted, flex: 1.2 }]}>{t('referralEarnColRank')}</Text>
          <Text style={[styles.earnHeadCell, { color: colors.textMuted, flex: 1 }]}>{t('referralEarnColLoan')}</Text>
          <Text style={[styles.earnHeadCell, { color: colors.textMuted, flex: 1.4 }]}>{t('referralEarnColPay')}</Text>
        </View>
        {LOAN_TIERS.map((tier) => {
          const rank = getRankForLevel(tier.id);
          const rankLabel = formatRankLabel(rank, t(rank.nameKey));
          const appliedBps = Math.max(tier.interestBps, curveRateBps || 0);
          const earn = formatCommissionUSD(directCommissionFromLoan(tier.usdAmount, appliedBps));
          return (
            <View key={tier.id} style={[styles.earnRow, { borderColor: colors.border }]}>
              <Text style={[styles.earnCell, { color: colors.text, flex: 1.2 }]}>{rankLabel}</Text>
              <Text style={[styles.earnCell, { color: colors.text, flex: 1 }]}>{formatUSD(tier.usdAmount)}</Text>
              <Text style={[styles.earnCell, { color: colors.primary, flex: 1.4 }]}>
                {tier.id === 1
                  ? `${t('referralEarnFirst', { bonus: formatCommissionUSD(ACTIVATION_BONUS_USD) })} · ${t('referralEarnNext', { amount: earn })}`
                  : earn}
              </Text>
            </View>
          );
        })}
      </AppSubsection>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  stack: {
    gap: 10,
  },
  lead: {
    fontSize: 13,
    color: '#2d4a38',
    lineHeight: 19,
    marginBottom: 12,
  },
  earnBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  earnTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  earnHint: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  earnHead: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  earnHeadCell: {
    fontSize: 10,
    fontWeight: '700',
  },
  earnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderTopWidth: 1,
  },
  earnCell: {
    fontSize: 11,
    fontWeight: '700',
  },
  founderBadge: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  founderBadgeText: {
    fontWeight: '500',
    textAlign: 'center',
    fontSize: 13,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 15,
    letterSpacing: 0.4,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    fontWeight: '500',
  },
  link: {
    fontSize: 12,
    color: '#146C2E',
    marginBottom: 8,
  },
  shareButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  whatsappButton: {
    backgroundColor: '#128C7E',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  shareDisabled: {
    opacity: 0.45,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meta: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
  },
  invitedBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  metaLine: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
    marginBottom: 4,
  },
  warn: {
    fontSize: 12,
    color: '#b42318',
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: '#3d5c48',
    lineHeight: 18,
  },
});
