import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { getRankForLevel, type RankStyle } from '../constants/ranks';
import { AppText } from './AppText';

const RANK_LOGOS = {
  1: require('../assets/ranks/1.png'),
  2: require('../assets/ranks/2.png'),
  3: require('../assets/ranks/3.png'),
  4: require('../assets/ranks/4.png'),
  5: require('../assets/ranks/5.png'),
  6: require('../assets/ranks/6.png'),
  7: require('../assets/ranks/7.png'),
  8: require('../assets/ranks/8.png'),
  9: require('../assets/ranks/9.png'),
  10: require('../assets/ranks/10.png'),
} as const;

interface RankMedalProps {
  level: number;
  size?: number;
  rank?: RankStyle;
  dimmed?: boolean;
  showLabel?: boolean;
  label?: string;
}

export const RankMedal: React.FC<RankMedalProps> = ({
  level,
  size = 44,
  rank,
  dimmed = false,
  showLabel = false,
  label,
}) => {
  const style = rank || getRankForLevel(level);
  const logoByFamily = {
    bronze: 1,
    silver: 3,
    gold: 5,
    platinum: 7,
    diamond: 9,
    master: 10,
  } as const;
  const clamped = logoByFamily[style.family];
  return (
    <View style={[styles.wrap, { opacity: dimmed ? 0.38 : 1 }]}>
      <Image source={RANK_LOGOS[clamped]} style={{ width: size, height: size }} resizeMode="contain" />
      {showLabel && label ? (
        <AppText style={[styles.label, { color: style.text }]} numberOfLines={1}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  label: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '800',
    maxWidth: 64,
    textAlign: 'center',
  },
});
