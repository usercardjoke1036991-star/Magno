import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { type UserProfile } from '../services/userProfile';
import { formatRankLabel, getRankForLevel } from '../constants/ranks';
import { AppIcon } from './icons';
import { RankFrame } from './RankFrame';

interface ProfileAvatarProps {
  profile?: UserProfile | null;
  wallet?: string;
  size?: number;
  onPress?: () => void;
  badge?: boolean;
  accessibilityLabel?: string;
  level?: number;
  rankName?: string;
  showRankLabel?: boolean;
}

const FACEBOOK_BG = '#E4E6EB';
const FACEBOOK_FG = '#B0B3B8';

const DefaultPhoto: React.FC<{ size: number }> = ({ size }) => (
  <View
    style={[
      styles.circle,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: FACEBOOK_BG,
      },
    ]}
  >
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="9.1" r="4.15" fill={FACEBOOK_FG} />
      <Path d="M3.8 21.4c.5-4.8 3.6-7.3 8.2-7.3s7.7 2.5 8.2 7.3" fill={FACEBOOK_FG} />
    </Svg>
  </View>
);

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  profile,
  size = 44,
  onPress,
  badge = false,
  accessibilityLabel,
  level,
  rankName,
  showRankLabel,
}) => {
  const localPhoto = Boolean(profile?.photoUri && !/^https?:/i.test(profile.photoUri));
  const rank = level ? getRankForLevel(level) : null;
  const caption = rank && rankName ? formatRankLabel(rank, rankName) : '';

  const photo = localPhoto ? (
    <Image
      key={`${profile?.photoUri || ''}-${profile?.updatedAt || 0}`}
      source={{ uri: profile?.photoUri || '' }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <DefaultPhoto size={size} />
  );

  const framed = rank ? (
    <View>
      <RankFrame level={rank.level} size={size} label={caption} showLabel={showRankLabel ?? size >= 36}>
        {photo}
      </RankFrame>
      {badge ? (
        <View style={styles.badge}>
          <AppIcon name="gear" size={10} color="#fff" />
        </View>
      ) : null}
    </View>
  ) : (
    <View style={{ width: size, height: size }}>
      {photo}
      {badge ? (
        <View style={styles.badge}>
          <AppIcon name="gear" size={10} color="#fff" />
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return framed;
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {framed}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 10,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#146C2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
    zIndex: 2,
  },
});
