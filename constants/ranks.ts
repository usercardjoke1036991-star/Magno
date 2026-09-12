import { MAX_LOAN_LEVEL } from './loanTiers';

export type RankNameKey =
  | 'rankBronze'
  | 'rankSilver'
  | 'rankGold'
  | 'rankAmber'
  | 'rankPearl'
  | 'rankJade'
  | 'rankEmerald'
  | 'rankSapphire'
  | 'rankRuby'
  | 'rankPlatinum'
  | 'rankDiamond'
  | 'rankMaster';

export type RankFamily =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'amber'
  | 'pearl'
  | 'jade'
  | 'emerald'
  | 'sapphire'
  | 'ruby'
  | 'platinum'
  | 'diamond'
  | 'master';

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

const FAMILY_STYLE: Record<RankFamily, Omit<RankStyle, 'level' | 'division'>> = {
  bronze: {
    family: 'bronze',
    nameKey: 'rankBronze',
    metal: '#C4793C',
    dark: '#7A4318',
    light: '#F0C090',
    tint: '#F8E6D4',
    text: '#6A3410',
  },
  silver: {
    family: 'silver',
    nameKey: 'rankSilver',
    metal: '#B8C0C8',
    dark: '#5E6A74',
    light: '#F4F7FA',
    tint: '#EEF2F6',
    text: '#3E4A54',
  },
  gold: {
    family: 'gold',
    nameKey: 'rankGold',
    metal: '#E0B43A',
    dark: '#8A6A12',
    light: '#FFE9A0',
    tint: '#FFF4D4',
    text: '#6E5208',
  },
  amber: {
    family: 'amber',
    nameKey: 'rankAmber',
    metal: '#E08A2A',
    dark: '#8A4A0C',
    light: '#FFD08A',
    tint: '#FFF0D4',
    text: '#6E3808',
  },
  pearl: {
    family: 'pearl',
    nameKey: 'rankPearl',
    metal: '#E8D8C8',
    dark: '#8A7464',
    light: '#FFF8F0',
    tint: '#FBF4EC',
    text: '#5A4638',
  },
  jade: {
    family: 'jade',
    nameKey: 'rankJade',
    metal: '#3CA87A',
    dark: '#14583C',
    light: '#B8F0D4',
    tint: '#E4F8EE',
    text: '#0C4A32',
  },
  emerald: {
    family: 'emerald',
    nameKey: 'rankEmerald',
    metal: '#1E9A5A',
    dark: '#0A4A28',
    light: '#8EF0B8',
    tint: '#D8F8E8',
    text: '#064020',
  },
  sapphire: {
    family: 'sapphire',
    nameKey: 'rankSapphire',
    metal: '#2F5FDE',
    dark: '#142A7A',
    light: '#A8C4FF',
    tint: '#E4ECFF',
    text: '#102060',
  },
  ruby: {
    family: 'ruby',
    nameKey: 'rankRuby',
    metal: '#D42848',
    dark: '#6E1024',
    light: '#FFB0C0',
    tint: '#FFE4EA',
    text: '#5A0C1C',
  },
  platinum: {
    family: 'platinum',
    nameKey: 'rankPlatinum',
    metal: '#7EC8E8',
    dark: '#2F6F8C',
    light: '#D8F3FF',
    tint: '#E7F6FC',
    text: '#1F5870',
  },
  diamond: {
    family: 'diamond',
    nameKey: 'rankDiamond',
    metal: '#64D4F0',
    dark: '#157A9A',
    light: '#E8FBFF',
    tint: '#E4F8FC',
    text: '#0B5C78',
  },
  master: {
    family: 'master',
    nameKey: 'rankMaster',
    metal: '#A78BFA',
    dark: '#5B21B6',
    light: '#EDE9FE',
    tint: '#F3E8FF',
    text: '#4C1D95',
  },
};

const FAMILY_BANDS: Array<{ family: RankFamily; from: number; to: number }> = [
  { family: 'bronze', from: 1, to: 83 },
  { family: 'silver', from: 84, to: 166 },
  { family: 'gold', from: 167, to: 249 },
  { family: 'amber', from: 250, to: 332 },
  { family: 'pearl', from: 333, to: 415 },
  { family: 'jade', from: 416, to: 498 },
  { family: 'emerald', from: 499, to: 581 },
  { family: 'sapphire', from: 582, to: 664 },
  { family: 'ruby', from: 665, to: 747 },
  { family: 'platinum', from: 748, to: 830 },
  { family: 'diamond', from: 831, to: 913 },
  { family: 'master', from: 914, to: 1000 },
];

export const RANK_MEDAL_ASSET: Record<RankFamily, 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  amber: 4,
  pearl: 5,
  jade: 6,
  emerald: 7,
  sapphire: 8,
  ruby: 9,
  platinum: 8,
  diamond: 9,
  master: 10,
};

export function clampLoanLevel(level: number): number {
  return Math.min(MAX_LOAN_LEVEL, Math.max(1, Math.floor(level) || 1));
}

export function getRankForLevel(level: number): RankStyle {
  const clamped = clampLoanLevel(level);
  const band = FAMILY_BANDS.find((item) => clamped >= item.from && clamped <= item.to) || FAMILY_BANDS[0];
  return {
    ...FAMILY_STYLE[band.family],
    level: clamped,
    division: 0,
  };
}

export function romanDivision(division: RankStyle['division']): string {
  if (division === 1) return 'I';
  if (division === 2) return 'II';
  return '';
}

export function formatRankLabel(rank: RankStyle, name: string): string {
  return `${name} ${rank.level}`;
}

export const RANK_LADDER = FAMILY_BANDS.map((band) => getRankForLevel(band.from));
