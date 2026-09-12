import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import type { TranslationKey } from '../i18n/translations';
import type { BiometricKind } from '../utils/biometricStatus';
import {
  getBiometricStatus,
  isBiometricEnabled,
  toggleBiometric,
  type BiometricToggleReason,
} from '../services/appLock';
import { AppText } from './AppText';

function unlockLabel(kinds: BiometricKind[]): TranslationKey {
  const face = kinds.includes('facial');
  const finger = kinds.includes('fingerprint') || kinds.includes('iris');
  if (face && !finger) return 'lockBiometricFace';
  return 'lockBiometric';
}

function statusReasonKey(
  reason: 'ok' | 'native-missing' | 'no-hardware' | 'not-enrolled',
  enabled: boolean,
): TranslationKey {
  if (enabled) return 'securityAccessKeyDone';
  if (reason === 'no-hardware') return 'lockBiometricNoHardware';
  if (reason === 'not-enrolled') return 'lockBiometricNotEnrolled';
  if (reason === 'native-missing') return 'lockBiometricNativeMissing';
  return 'lockBiometricLead';
}

function toggleErrorKey(reason: BiometricToggleReason): TranslationKey {
  if (reason === 'no-hardware') return 'lockBiometricNoHardware';
  if (reason === 'not-enrolled') return 'lockBiometricNotEnrolled';
  if (reason === 'native-missing') return 'lockBiometricNativeMissing';
  if (reason === 'no-session') return 'lockBiometricNoSession';
  if (reason === 'store-failed') return 'lockBiometricStoreFailed';
  return 'securityAccessKeyFailed';
}

async function openPhoneSecuritySettings(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent('android.settings.BIOMETRIC_ENROLL');
      return;
    } catch {
      try {
        await Linking.sendIntent('android.settings.SECURITY_SETTINGS');
        return;
      } catch {
        // Continúa a los ajustes de la app.
      }
    }
  }
  await Linking.openSettings();
}

export const BiometricLockSection: React.FC<{
  onChanged?: (enabled: boolean) => void;
  compact?: boolean;
}> = ({ onChanged, compact = false }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [bioOn, setBioOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kinds, setKinds] = useState<BiometricKind[]>([]);
  const [reason, setReason] = useState<'ok' | 'native-missing' | 'no-hardware' | 'not-enrolled'>('ok');
  const [available, setAvailable] = useState(false);

  const refresh = useCallback(async () => {
    const [status, enabled] = await Promise.all([getBiometricStatus(), isBiometricEnabled()]);
    setKinds(status.kinds);
    setReason(status.reason);
    setAvailable(status.available);
    setBioOn(enabled);
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh().catch(() => {});
    });
    return () => sub.remove();
  }, [refresh]);

  const onToggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await toggleBiometric(!bioOn);
      if (!result.ok) {
        Alert.alert(t('securityAccessKey'), t(toggleErrorKey(result.reason)));
        await refresh();
        return;
      }
      const next = !bioOn;
      setBioOn(next);
      onChanged?.(next);
    } finally {
      setBusy(false);
    }
  };

  const hint = t(statusReasonKey(reason, bioOn));

  return (
    <View>
      {compact ? null : (
        <AppText style={[styles.section, { color: colors.text }]}>{t('lockBiometricSection')}</AppText>
      )}
      {compact ? null : (
        <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('lockBiometricLead')}</AppText>
      )}
      {reason === 'ok' ? null : (
        <AppText style={[styles.note, { color: colors.warnText }]}>{hint}</AppText>
      )}
      {available || bioOn ? (
        <TouchableOpacity
          disabled={busy}
          onPress={() => void onToggle()}
          style={[
            styles.button,
            { backgroundColor: bioOn ? colors.surface : colors.connect, borderWidth: bioOn ? 1 : 0, borderColor: colors.border },
            busy && { opacity: 0.6 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t(unlockLabel(kinds))}
        >
          <AppText style={[styles.buttonText, bioOn && { color: colors.text }]}>
            {bioOn ? t('securityAccessKeyDisable') : t('securityAccessKeyEnable')}
          </AppText>
        </TouchableOpacity>
      ) : reason === 'not-enrolled' ? (
        <TouchableOpacity
          onPress={() => void openPhoneSecuritySettings()}
          style={[styles.button, { backgroundColor: colors.connect }]}
          accessibilityRole="button"
          accessibilityLabel={t('lockBiometricOpenSettings')}
        >
          <AppText style={styles.buttonText}>{t('lockBiometricOpenSettings')}</AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 8,
  },
  lead: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
