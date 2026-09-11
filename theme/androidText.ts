import { Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

const INTER: Record<string, string> = {
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  medium: 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  bold: 'Inter_700Bold',
  '800': 'Inter_700Bold',
  '900': 'Inter_700Bold',
};

let interReady = false;

export function setInterReady(ready: boolean) {
  interReady = ready;
}

/**
 * MIUI dibuja dos veces los glifos si el peso no tiene archivo de fuente.
 * Con Inter cargada se usa el TTF; si no, sans-serif-medium / bold nativos.
 */
export function remapAndroidTextStyle(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  if (Platform.OS !== 'android') return style;
  const flat = StyleSheet.flatten(style) || {};
  const family = flat.fontFamily;
  const isCustom = Boolean(
    family
    && family !== 'System'
    && family !== 'sans-serif'
    && family !== 'sans-serif-medium'
    && !String(family).startsWith('Inter_')
  );

  const next: TextStyle = { ...flat, includeFontPadding: false };

  if (!isCustom) {
    const weight = String(flat.fontWeight ?? '400');
    if (interReady) {
      next.fontFamily = INTER[weight] || INTER['400'];
      next.fontWeight = 'normal';
    } else if (weight === '500' || weight === '600' || weight === 'medium') {
      next.fontFamily = 'sans-serif-medium';
      next.fontWeight = 'normal';
    } else if (weight === '700' || weight === '800' || weight === '900' || weight === 'bold') {
      next.fontFamily = 'sans-serif';
      next.fontWeight = 'bold';
    } else {
      next.fontFamily = 'sans-serif';
      next.fontWeight = 'normal';
    }
  }

  if (typeof next.letterSpacing === 'number' && Math.abs(next.letterSpacing) < 2) {
    next.letterSpacing = 0;
  }
  if (next.textTransform === 'uppercase' || next.textTransform === 'lowercase') {
    next.textTransform = 'none';
  }

  return next;
}
