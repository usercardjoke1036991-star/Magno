import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { useReferralNetwork } from '../hooks/useReferralNetwork';
import type { TranslationKey } from '../i18n/translations';
import { AppIcon } from './icons';
import { ProfileAvatar } from './ProfileAvatar';
import { useUserProfile } from '../profile/ProfileContext';
import { labelForProfile } from '../services/userProfile';
import { getRankForLevel } from '../constants/ranks';
import { AppText } from './AppText';

interface ReferralHistoryProps {
  walletAddress: string;
  enabled: boolean;
}

export const ReferralHistory: React.FC<ReferralHistoryProps> = ({
  walletAddress,
  enabled,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { data, isLoading, error, refetch } = useReferralNetwork(walletAddress, enabled);
  const { lookup, refreshDirectory } = useUserProfile();
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const wallets = [
      ...data.directs.map((node) => node.address),
      ...data.directs.flatMap((node) => node.children.map((child) => child.address)),
    ];
    if (wallets.length) refreshDirectory(wallets).catch(() => {});
  }, [data.directs, refreshDirectory]);

  return (
    <View>
      <AppText style={[styles.lead, { color: colors.text }]}>{t('referralHistoryLead')}</AppText>

      {isLoading && <ActivityIndicator color="#146C2E" style={styles.spinner} />}
      {error && <AppText style={styles.warn}>{t('referralLoadError')}</AppText>}

      {!isLoading && !error && (
        <>
          {data.partial ? (
            <AppText style={[styles.warn, { color: colors.warnText }]}>{t('referralHistoryPartial')}</AppText>
          ) : null}

          <AppText style={[styles.summary, { color: colors.primary }]}>
            {t('referralDirects', { count: data.directs.length })} · {t('earnedTotal', { amount: data.totalEarnedLabel })}
          </AppText>

          {data.directs.length === 0 ? (
            <AppText style={[styles.empty, { color: colors.textMuted }]}>{t('referralNone')}</AppText>
          ) : (
            data.directs.map((node) => {
              const expanded = open === node.address;
              const person = lookup(node.address);
              const name = labelForProfile(person, node.code);
              return (
                <View key={node.address} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <TouchableOpacity style={styles.personRow} onPress={() => setOpen(expanded ? null : node.address)}>
                    <ProfileAvatar
                      profile={person}
                      wallet={node.address}
                      size={40}
                      level={node.level || 1}
                      rankName={t(getRankForLevel(node.level || 1).nameKey)}
                    />
                    <View style={styles.personText}>
                      <AppText style={[styles.name, { color: colors.text }]}>{name}</AppText>
                      {name !== node.code ? (
                        <AppText style={[styles.code, { color: colors.textMuted }]}>{node.code}</AppText>
                      ) : null}
                      <AppText style={styles.earned}>{t('referralEarnedWith', { amount: node.earnedLabel })}</AppText>
                      <AppText style={styles.meta}>
                        {t('referralTheirCount', { count: node.children.length })}
                      </AppText>
                    </View>
                  </TouchableOpacity>
                  {expanded && node.children.length > 0 && (
                    <View style={styles.children}>
                      <AppText style={styles.childTitle}>{t('referralTheirNetwork')}</AppText>
                      {node.children.map((child) => {
                        const childProfile = lookup(child.address);
                        return (
                          <View key={child.address} style={styles.childRow}>
                            <ProfileAvatar
                              profile={childProfile}
                              wallet={child.address}
                              size={24}
                              level={child.level || 1}
                              showRankLabel={false}
                            />
                            <AppText style={styles.child}>
                              {labelForProfile(childProfile, child.code)}
                            </AppText>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}

          {data.activity.length > 0 && (
            <View style={styles.activity}>
              <AppText style={styles.childTitle}>{t('activityTitle')}</AppText>
              {data.activity.slice(0, 8).map((item) => {
                const fromCode = data.directs.find((node) => node.code === item.code)
                  || data.directs.flatMap((node) => node.children).find((child) => child.code === item.code);
                const person = fromCode ? lookup(fromCode.address) : undefined;
                const name = labelForProfile(person, item.code);
                return (
                  <AppText key={item.id} style={styles.activityLine}>
                    {t(item.titleKey as TranslationKey, {
                      code: name,
                      name,
                      amount: item.amountLabel || '',
                    })}
                  </AppText>
                );
              })}
            </View>
          )}

          <TouchableOpacity style={styles.refresh} onPress={refetch}>
            <AppIcon name="refresh" size={16} color="#146C2E" />
            <AppText style={styles.refreshText}>{t('referralRefresh')}</AppText>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  lead: {
    fontSize: 12,
    color: '#2d4a38',
    lineHeight: 18,
    marginBottom: 10,
  },
  spinner: {
    marginVertical: 12,
  },
  summary: {
    fontSize: 13,
    fontWeight: '700',
    color: '#146C2E',
    marginBottom: 10,
  },
  empty: {
    fontSize: 12,
    color: '#3d5c48',
  },
  card: {
    borderWidth: 1,
    borderColor: '#d7eadf',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  personText: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  earned: {
    marginTop: 4,
    fontSize: 13,
    color: '#146C2E',
    fontWeight: '700',
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    color: '#3d5c48',
  },
  children: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e6f3eb',
  },
  childTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#145c32',
    marginBottom: 4,
  },
  child: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  activity: {
    marginTop: 8,
  },
  activityLine: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
    marginBottom: 4,
  },
  warn: {
    fontSize: 12,
    color: '#b42318',
  },
  refresh: {
    marginTop: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  refreshText: {
    color: '#146C2E',
    fontWeight: '700',
    fontSize: 13,
  },
});
