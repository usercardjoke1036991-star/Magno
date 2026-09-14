import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  clampLoanLevel,
  FAMILY_BANDS,
  formatRankLabel,
  getRankForLevel,
  rankGalleryRow,
  romanDivision,
  type RankFamily,
} from '../constants/ranks';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { AnonymousFace } from './ProfileAvatar';
import { RankFrame } from './RankFrame';
import { RankMedal } from './RankMedal';
import { AppText } from './AppText';

interface RankLadderProps {
  userLevel: number;
}

export const RankLadder: React.FC<RankLadderProps> = ({ userLevel }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const current = getRankForLevel(clampLoanLevel(userLevel || 1));
  const [family, setFamily] = useState<RankFamily>(current.family);
  const row = useMemo(() => rankGalleryRow(family), [family]);

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FAMILY_BANDS.map((band) => {
          const sample = getRankForLevel(band.from);
          const active = band.family === family;
          const reached = band.from <= current.level;
          return (
            <TouchableOpacity
              key={band.family}
              onPress={() => setFamily(band.family)}
              style={[
                styles.chip,
                { borderColor: active ? sample.metal : colors.border, backgroundColor: colors.surface },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t(sample.nameKey)}
            >
              <RankMedal level={band.from} rank={sample} size={28} dimmed={!reached} />
              <AppText
                style={[styles.chipText, { color: reached ? sample.text : colors.textMuted }]}
                numberOfLines={1}
              >
                {t(sample.nameKey)}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.stage}>
        {row.map((rank) => {
          const reached = rank.level <= current.level;
          const mine = rank.family === current.family && rank.division === current.division;
          const caption = formatRankLabel(rank, t(rank.nameKey));
          return (
            <View
              key={`${rank.family}-${rank.division}`}
              style={[
                styles.card,
                { borderColor: mine ? rank.metal : colors.border, backgroundColor: colors.surface },
                !reached && styles.dim,
              ]}
            >
              <RankFrame level={rank.level} size={42} label={caption} showLabel>
                <AnonymousFace size={42} square />
              </RankFrame>
              <AppText style={[styles.roman, { color: rank.text }]}>{romanDivision(rank.division)}</AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 4,
    gap: 10,
  },
  chips: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    width: 72,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 4,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  stage: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 4,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 2,
    minHeight: 188,
  },
  dim: {
    opacity: 0.46,
  },
  roman: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
  },
});
