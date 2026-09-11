import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  avatarColorForWallet,
  initialsFromName,
  type UserProfile,
} from '../services/userProfile';
import { formatRankLabel, getRankForLevel } from '../constants/ranks';
import { AppIcon } from './icons';
import { RankFrame } from './RankFrame';
import { AppText } from './AppText';

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

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  profile,
  wallet = '',
  size = 44,
  onPress,
  badge = false,
  accessibilityLabel,
  level,
  rankName,
  showRankLabel,
}) => {
  const colors = avatarColorForWallet(wallet, profile?.avatarId);
  const initials = initialsFromName(profile?.displayName || '', wallet ? wallet.slice(2, 4).toUpperCase() : 'QC');
  const localPhoto = Boolean(profile?.photoUri && !/^https?:/i.test(profile.photoUri));
  const rank = level ? getRankForLevel(level) : null;
  const caption = rank && rankName ? formatRankLabel(rank, rankName) : '';

  const photo = (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.bg,
        },
      ]}
    >
      {localPhoto ? (
        <Image
          key={`${profile?.photoUri || ''}-${profile?.updatedAt || 0}`}
          source={{ uri: profile?.photoUri || '' }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : profile?.displayName ? (
        <AppText style={[styles.initials, { color: colors.fg, fontSize: Math.round(size * 0.36) }]}>{initials}</AppText>
      ) : (
        <AppIcon name="user" size={Math.round(size * 0.48)} color={colors.fg} />
      )}
    </View>
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
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontWeight: '800',
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
