export type ThemeName = 'light' | 'dark';
export type ThemePreference = ThemeName | 'system';

export interface SectionTone {
  border: string;
  header: string;
  bg: string;
  description: string;
}

export interface ThemeColors {
  bg: string;
  surface: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  connect: string;
  disconnect: string;
  inputBg: string;
  inputBorder: string;
  warnBg: string;
  warnText: string;
  success: string;
  danger: string;
  chip: string;
  chipText: string;
  modalBg: string;
  overlay: string;
  section: {
    default: SectionTone;
    green: SectionTone;
    blue: SectionTone;
    gold: SectionTone;
  };
}

export const layout = {
  radius: 12,
  radiusSm: 8,
  hairline: 1,
};

function section(border: string, header: string, bg: string, description: string): SectionTone {
  return { border, header, bg, description };
}

export const palettes: Record<ThemeName, ThemeColors> = {
  light: {
    bg: '#F4F4F1',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1A1A18',
    textMuted: '#6F6F69',
    border: '#E4E4DE',
    primary: '#1B6B3A',
    onPrimary: '#FFFFFF',
    connect: '#007AFF',
    disconnect: '#146C2E',
    inputBg: '#FFFFFF',
    inputBorder: '#D8D8D2',
    warnBg: '#F4EFE6',
    warnText: '#6B5420',
    success: '#1B6B3A',
    danger: '#B42318',
    chip: '#EFEFEA',
    chipText: '#3F3F3A',
    modalBg: '#FFFFFF',
    overlay: 'rgba(18,18,16,0.4)',
    section: {
      default: section('#E4E4DE', '#1A1A18', '#FFFFFF', '#6F6F69'),
      green: section('#E4E4DE', '#1A1A18', '#FFFFFF', '#6F6F69'),
      blue: section('#E4E4DE', '#1A1A18', '#FFFFFF', '#6F6F69'),
      gold: section('#E4E4DE', '#1A1A18', '#FFFFFF', '#6F6F69'),
    },
  },
  dark: {
    bg: '#0E0E0D',
    surface: '#161615',
    card: '#171716',
    text: '#F3F3EE',
    textMuted: '#9A9A93',
    border: '#2C2C28',
    primary: '#5DCF86',
    onPrimary: '#0E0E0D',
    connect: '#3D8BFD',
    disconnect: '#2FB862',
    inputBg: '#121211',
    inputBorder: '#33332E',
    warnBg: '#2A2418',
    warnText: '#E4C98A',
    success: '#5DCF86',
    danger: '#F0A8A0',
    chip: '#22221F',
    chipText: '#D4D4CC',
    modalBg: '#171716',
    overlay: 'rgba(0,0,0,0.62)',
    section: {
      default: section('#2C2C28', '#F3F3EE', '#171716', '#9A9A93'),
      green: section('#2C2C28', '#F3F3EE', '#171716', '#9A9A93'),
      blue: section('#2C2C28', '#F3F3EE', '#171716', '#9A9A93'),
      gold: section('#2C2C28', '#F3F3EE', '#171716', '#9A9A93'),
    },
  },
};
