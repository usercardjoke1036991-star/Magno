import { MAX_LOAN_LEVEL } from './loanTiers';

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
  { family: 'bronze', from: 1, to: 16 },
  { family: 'silver', from: 17, to: 33 },
  { family: 'gold', from: 34, to: 50 },
  { family: 'platinum', from: 51, to: 66 },
  { family: 'diamond', from: 67, to: 83 },
  { family: 'master', from: 84, to: 100 },
];

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
