import { Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

/**
 * MIUI reemplaza sans-serif por MiSans (variable). Fabric mide y pinta
 * con anchos distintos y duplica letras. Una sola cara embebida, sin peso.
 */
const ANDROID_FACE = 'Inter';

/**
 * MIUI sintetiza pesos 500/600 y duplica letras. Inter ya está cargada
 * antes del primer frame (App espera useFonts).
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
    && family !== 'Inter_400Regular'
    && family !== 'Inter_500Medium'
    && family !== 'Inter_600SemiBold'
    && family !== 'Inter_700Bold'
    && family !== ANDROID_FACE
  );

  const next: TextStyle = { ...flat };

  if (!isCustom) {
    next.fontFamily = ANDROID_FACE;
    next.fontWeight = '400';
  }

  if (typeof next.letterSpacing === 'number' && Math.abs(next.letterSpacing) < 2) {
    next.letterSpacing = 0;
  }
  if (next.textTransform === 'uppercase' || next.textTransform === 'lowercase') {
    next.textTransform = 'none';
  }

  return next;
}

/** @deprecated Las fuentes se esperan en App.js; se mantiene por imports viejos. */
export function setInterReady(_ready: boolean) {}
