import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import type { TranslationKey } from '../i18n/translations';
import {
  getAvailableMethods,
  loadAuthPrefs,
  setAuthMethod,
  type AuthMethod,
  type AuthPrefs,
  type AuthPurpose,
} from '../services/authPrefs';
import { AppText } from './AppText';

const PURPOSES: Array<{ id: AuthPurpose; title: TranslationKey }> = [
  { id: 'unlock', title: 'authUnlock' },
  { id: 'funds', title: 'authFunds' },
  { id: 'signin', title: 'authSignIn' },
];

function methodKey(method: AuthMethod): TranslationKey {
  if (method === 'pin') return 'authMethodPin';
  if (method === 'biometric') return 'authMethodBiometric';
  if (method === 'authenticator') return 'authMethodAuthenticator';
  return 'authMethodPassword';
}

export const AuthMethodPicker: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [prefs, setPrefs] = useState<AuthPrefs>({ unlock: 'password', funds: 'password', signin: 'password' });
  const [available, setAvailable] = useState<AuthMethod[]>(['password']);

  const refresh = async () => {
    const [nextPrefs, methods] = await Promise.all([loadAuthPrefs(), getAvailableMethods()]);
    setPrefs(nextPrefs);
    setAvailable(methods);
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const pick = async (purpose: AuthPurpose, method: AuthMethod) => {
    try {
      await setAuthMethod(purpose, method);
      setPrefs((current) => ({ ...current, [purpose]: method }));
      onChanged?.();
    } catch {
      Alert.alert(t('error'), t('authNeedSetup'));
    }
  };

  return (
    <View>
      <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('authMethodsLead')}</AppText>
      {PURPOSES.map((purpose) => (
        <View key={purpose.id} style={[styles.block, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <AppText style={[styles.title, { color: colors.text }]}>{t(purpose.title)}</AppText>
          <View style={styles.row}>
            {available.map((method) => {
              const selected = prefs[purpose.id] === method;
              return (
                <TouchableOpacity
                  key={method}
                  onPress={() => void pick(purpose.id, method)}
                  style={[
                    styles.chip,
                    { borderColor: colors.border, backgroundColor: colors.card },
                    selected && { borderColor: colors.primary, backgroundColor: colors.chip },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <AppText style={[styles.chipText, { color: colors.text }]}>{t(methodKey(method))}</AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  lead: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  block: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
