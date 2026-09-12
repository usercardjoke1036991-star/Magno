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

/** Color mineral real de cada metal o piedra. Ningún tono se reutiliza. */
const FAMILY_STYLE: Record<RankFamily, Omit<RankStyle, 'level' | 'division'>> = {
  bronze: {
    family: 'bronze',
    nameKey: 'rankBronze',
    metal: '#B87333',
    dark: '#6B3A18',
    light: '#E6B17A',
    tint: '#F6E4D0',
    text: '#5A2E12',
  },
  silver: {
    family: 'silver',
    nameKey: 'rankSilver',
    metal: '#A8B2BC',
    dark: '#4A545C',
    light: '#F3F5F7',
    tint: '#EEF1F4',
    text: '#3A4248',
  },
  gold: {
    family: 'gold',
    nameKey: 'rankGold',
    metal: '#D4AF37',
    dark: '#7A5E10',
    light: '#F6E392',
    tint: '#FFF6D6',
    text: '#5C4708',
  },
  amber: {
    family: 'amber',
    nameKey: 'rankAmber',
    metal: '#FF8C1A',
    dark: '#9A4300',
    light: '#FFD08A',
    tint: '#FFE8C8',
    text: '#7A3400',
  },
  pearl: {
    family: 'pearl',
    nameKey: 'rankPearl',
    metal: '#EDD5C8',
    dark: '#8E6B5C',
    light: '#FFF8F4',
    tint: '#FBF3EE',
    text: '#5C4338',
  },
  jade: {
    family: 'jade',
    nameKey: 'rankJade',
    metal: '#5C9A5F',
    dark: '#2A4F2C',
    light: '#C5E0C4',
    tint: '#E6F2E5',
    text: '#1E3A20',
  },
  emerald: {
    family: 'emerald',
    nameKey: 'rankEmerald',
    metal: '#028A52',
    dark: '#013D24',
    light: '#6FCF97',
    tint: '#D4F3E4',
    text: '#012816',
  },
  sapphire: {
    family: 'sapphire',
    nameKey: 'rankSapphire',
    metal: '#0F52BA',
    dark: '#0A2A6E',
    light: '#8BB4FF',
    tint: '#DCE8FF',
    text: '#081F52',
  },
  ruby: {
    family: 'ruby',
    nameKey: 'rankRuby',
    metal: '#9B111E',
    dark: '#4A0810',
    light: '#F07180',
    tint: '#FAD6DA',
    text: '#3D0610',
  },
  platinum: {
    family: 'platinum',
    nameKey: 'rankPlatinum',
    metal: '#E5E4E2',
    dark: '#6A6966',
    light: '#FAFAF8',
    tint: '#F4F3F0',
    text: '#3F3E3C',
  },
  diamond: {
    family: 'diamond',
    nameKey: 'rankDiamond',
    metal: '#D6EEF5',
    dark: '#5A6E78',
    light: '#FFFFFF',
    tint: '#F4FBFD',
    text: '#3D4F58',
  },
  master: {
    family: 'master',
    nameKey: 'rankMaster',
    metal: '#9966CC',
    dark: '#4A1F7A',
    light: '#E0C8F5',
    tint: '#F3E8FF',
    text: '#3B1463',
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

/** Convierte el emblema a escala de gris y lo pinta con el color mineral, sin aplastar el relieve. */
export function colorizeTextureFilters(hex: string): Array<{
  name: 'feColorMatrix';
  type: 'saturate' | 'matrix';
  values: string;
}> {
  const raw = hex.replace('#', '');
  if (raw.length < 6) return [];
  const r = Number.parseInt(raw.slice(0, 2), 16) / 255;
  const g = Number.parseInt(raw.slice(2, 4), 16) / 255;
  const b = Number.parseInt(raw.slice(4, 6), 16) / 255;
  if (![r, g, b].every((value) => Number.isFinite(value))) return [];
  return [
    { name: 'feColorMatrix', type: 'saturate', values: '0' },
    {
      name: 'feColorMatrix',
      type: 'matrix',
      values: `${r} ${r} ${r} 0 0 ${g} ${g} ${g} 0 0 ${b} ${b} ${b} 0 0 0 0 0 1 0`,
    },
  ];
}

/** Textura 3D original del emblema. El color del rango lo da el tinte mineral + la piedra. */
export const RANK_MEDAL_ASSET: Record<RankFamily, 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10> = {
  bronze: 1,
  silver: 3,
  gold: 5,
  amber: 2,
  pearl: 4,
  jade: 6,
  emerald: 6,
  sapphire: 8,
  ruby: 1,
  platinum: 3,
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
