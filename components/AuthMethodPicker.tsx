import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import type { TranslationKey } from '../i18n/translations';
import {
  AUTH_PURPOSES,
  getAvailableMethods,
  loadAuthPrefs,
  saveAuthPrefs,
  type AuthMethod,
  type AuthPrefs,
  type AuthPurpose,
} from '../services/authPrefs';
import { AppText } from './AppText';

function methodKey(method: AuthMethod): TranslationKey {
  if (method === 'email') return 'authMethodEmail';
  if (method === 'pin') return 'authMethodPin';
  if (method === 'biometric') return 'authMethodBiometric';
  if (method === 'authenticator') return 'authMethodAuthenticator';
  return 'authMethodPassword';
}

function purposeKey(purpose: AuthPurpose): TranslationKey {
  if (purpose === 'unlock') return 'authUnlock';
  if (purpose === 'funds') return 'authFunds';
  if (purpose === 'loanRequest') return 'loanConfirmRequest';
  return 'loanConfirmPay';
}

export const AuthMethodPicker: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const empty = useMemo(
    () => ({
      unlock: { on: false, method: 'password' as const },
      funds: { on: true, method: 'password' as const },
      loanRequest: { on: false, method: 'password' as const },
      loanPay: { on: false, method: 'password' as const },
    }),
    []
  );
  const [draft, setDraft] = useState<AuthPrefs>(empty);
  const [available, setAvailable] = useState<AuthMethod[]>(['password']);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([loadAuthPrefs(), getAvailableMethods()])
      .then(([prefs, methods]) => {
        setDraft(prefs);
        setAvailable(methods);
      })
      .catch(() => {});
  }, []);

  const setOn = (purpose: AuthPurpose, on: boolean) => {
    setDraft((current) => {
      const method = available.includes(current[purpose].method) ? current[purpose].method : 'password';
      return { ...current, [purpose]: { ...current[purpose], on, method } };
    });
  };

  const setMethod = (purpose: AuthPurpose, method: AuthMethod) => {
    if (!available.includes(method)) return;
    setDraft((current) => ({ ...current, [purpose]: { ...current[purpose], method, on: true } }));
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await saveAuthPrefs(draft);
      setDraft(next);
      onChanged?.();
      Alert.alert(t('ready'), t('settingsSaved'));
    } catch {
      Alert.alert(t('error'), t('authNeedSetup'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <View style={[styles.block, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <AppText style={[styles.title, { color: colors.text }]}>{t('authSignIn')}</AppText>
        <AppText style={[styles.required, { color: colors.textMuted }]}>{t('authSignInRequired')}</AppText>
      </View>
      {AUTH_PURPOSES.map((purpose) => {
        const slot = draft[purpose];
        return (
          <View key={purpose} style={[styles.block, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.header}>
              <AppText style={[styles.title, { color: colors.text }]}>{t(purposeKey(purpose))}</AppText>
              <Switch
                value={slot.on}
                onValueChange={(value) => setOn(purpose, value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
                accessibilityLabel={t(purposeKey(purpose))}
              />
            </View>
            {slot.on ? (
              <View style={styles.row}>
                {available.map((method) => {
                  const selected = slot.method === method;
                  return (
                    <TouchableOpacity
                      key={method}
                      onPress={() => setMethod(purpose, method)}
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
            ) : null}
          </View>
        );
      })}
      <TouchableOpacity
        disabled={busy}
        onPress={() => void save()}
        style={[styles.save, { backgroundColor: colors.connect }, busy && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel={t('settingsSave')}
      >
        <AppText style={styles.saveText}>{t('settingsSave')}</AppText>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  required: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
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
  save: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  saveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
