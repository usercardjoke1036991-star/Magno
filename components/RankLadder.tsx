import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { formatRankLabel, RANK_LADDER } from '../constants/ranks';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { RankMedal } from './RankMedal';
import { AppText } from './AppText';

interface RankLadderProps {
  userLevel: number;
}

export const RankLadder: React.FC<RankLadderProps> = ({ userLevel }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const current = Math.min(10, Math.max(1, userLevel || 1));

  return (
    <View style={styles.wrap}>
      <AppText style={[styles.title, { color: colors.text }]}>{t('rankLadderTitle')}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {RANK_LADDER.map((rank) => {
          const reached = rank.level <= current;
          const active = rank.level === current;
          const label = formatRankLabel(rank, t(rank.nameKey));
          return (
            <View
              key={rank.level}
              style={[
                styles.item,
                { borderColor: 'transparent' },
                active && { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <RankMedal level={rank.level} rank={rank} size={36} dimmed={!reached} />
              <AppText
                style={[
                  styles.caption,
                  { color: reached ? colors.text : colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {label}
              </AppText>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    paddingHorizontal: 0,
  },
  row: {
    paddingHorizontal: 2,
    gap: 6,
  },
  item: {
    width: 72,
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  caption: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
});
