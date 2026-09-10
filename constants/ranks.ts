export type RankNameKey =
  | 'rankBronze'
  | 'rankSilver'
  | 'rankGold'
  | 'rankPlatinum'
  | 'rankDiamond'
  | 'rankMaster';

export type RankFamily = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';

export interface RankStyle {
  family: RankFamily;
  level: number;
  nameKey: RankNameKey;
  metal: string;
  dark: string;
  light: string;
  tint: string;
  text: string;
  division: 0 | 1 | 2;
}

export const LEVEL_RANKS: Record<number, RankStyle> = {
  1: {
    family: 'bronze',
    level: 1,
    nameKey: 'rankBronze',
    metal: '#C4793C',
    dark: '#7A4318',
    light: '#F0C090',
    tint: '#F8E6D4',
    text: '#6A3410',
    division: 1,
  },
  2: {
    family: 'bronze',
    level: 2,
    nameKey: 'rankBronze',
    metal: '#B86B2E',
    dark: '#6E3A12',
    light: '#E8B078',
    tint: '#F3DCC4',
    text: '#6A3410',
    division: 2,
  },
  3: {
    family: 'silver',
    level: 3,
    nameKey: 'rankSilver',
    metal: '#B8C0C8',
    dark: '#5E6A74',
    light: '#F4F7FA',
    tint: '#EEF2F6',
    text: '#3E4A54',
    division: 1,
  },
  4: {
    family: 'silver',
    level: 4,
    nameKey: 'rankSilver',
    metal: '#9AA6B2',
    dark: '#4A5660',
    light: '#E8EEF4',
    tint: '#E4EAEF',
    text: '#3E4A54',
    division: 2,
  },
  5: {
    family: 'gold',
    level: 5,
    nameKey: 'rankGold',
    metal: '#E0B43A',
    dark: '#8A6A12',
    light: '#FFE9A0',
    tint: '#FFF4D4',
    text: '#6E5208',
    division: 1,
  },
  6: {
    family: 'gold',
    level: 6,
    nameKey: 'rankGold',
    metal: '#D4A017',
    dark: '#7A5A0A',
    light: '#F8D56A',
    tint: '#FBEBC0',
    text: '#6E5208',
    division: 2,
  },
  7: {
    family: 'platinum',
    level: 7,
    nameKey: 'rankPlatinum',
    metal: '#7EC8E8',
    dark: '#2F6F8C',
    light: '#D8F3FF',
    tint: '#E7F6FC',
    text: '#1F5870',
    division: 1,
  },
  8: {
    family: 'platinum',
    level: 8,
    nameKey: 'rankPlatinum',
    metal: '#5AB0D6',
    dark: '#1E5A74',
    light: '#C4ECFA',
    tint: '#D8F0F8',
    text: '#1F5870',
    division: 2,
  },
  9: {
    family: 'diamond',
    level: 9,
    nameKey: 'rankDiamond',
    metal: '#64D4F0',
    dark: '#157A9A',
    light: '#E8FBFF',
    tint: '#E4F8FC',
    text: '#0B5C78',
    division: 0,
  },
  10: {
    family: 'master',
    level: 10,
    nameKey: 'rankMaster',
    metal: '#A78BFA',
    dark: '#5B21B6',
    light: '#EDE9FE',
    tint: '#F3E8FF',
    text: '#4C1D95',
    division: 0,
  },
};

export function getRankForLevel(level: number): RankStyle {
  const clamped = Math.min(10, Math.max(1, Math.floor(level) || 1));
  return LEVEL_RANKS[clamped];
}

export function romanDivision(division: RankStyle['division']): string {
  if (division === 1) return 'I';
  if (division === 2) return 'II';
  return '';
}

export function formatRankLabel(rank: RankStyle, name: string): string {
  const roman = romanDivision(rank.division);
  return roman ? `${name} ${roman}` : name;
}

export const RANK_LADDER = Object.values(LEVEL_RANKS);
