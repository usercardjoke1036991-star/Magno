import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import {
  authenticatorUri,
  clearAuthenticator,
  confirmAuthenticator,
  createAuthenticatorSecret,
  isAuthenticatorEnabled,
  verifyAuthenticator,
} from '../services/authenticator';
import { fallbackAuthIfNeeded } from '../services/authPrefs';
import { copyText } from '../utils/copyText';
import { SecretInput } from './SecretInput';
import { AppText } from './AppText';

export const AuthenticatorSetup: React.FC<{
  account: string;
  onChanged?: () => void;
}> = ({ account, onChanged }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const uri = secret ? authenticatorUri(secret, account) : '';

  const refresh = async () => {
    setEnabled(await isAuthenticatorEnabled());
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      setSecret(await createAuthenticatorSecret());
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!secret || code.length !== 6) return;
    setBusy(true);
    try {
      const ok = await confirmAuthenticator(secret, code);
      if (!ok) {
        Alert.alert(t('error'), t('authenticatorWrong'));
        setCode('');
        return;
      }
      setEnabled(true);
      setSecret('');
      setCode('');
      onChanged?.();
      Alert.alert(t('ready'), t('settingsSaved'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (code.length !== 6) {
      Alert.alert(t('error'), t('authenticatorWrong'));
      return;
    }
    setBusy(true);
    try {
      if (!(await verifyAuthenticator(code))) {
        Alert.alert(t('error'), t('authenticatorWrong'));
        setCode('');
        return;
      }
      await clearAuthenticator();
      await fallbackAuthIfNeeded('authenticator');
      setEnabled(false);
      setCode('');
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    const result = await copyText(secret);
    if (result === 'copied') Alert.alert(t('ready'), t('authenticatorCopied'));
  };

  return (
    <View>
      <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('authenticatorLead')}</AppText>
      <AppText style={[styles.status, { color: colors.text }]}>
        {enabled ? t('authenticatorOn') : t('authenticatorOff')}
      </AppText>
      {secret && uri ? (
        <>
          <AppText style={[styles.label, { color: colors.text }]}>{t('authenticatorQr')}</AppText>
          <View style={styles.qrWrap} accessibilityLabel={t('authenticatorQr')}>
            <QRCode value={uri} size={200} backgroundColor="#fff" color="#111" />
          </View>
          <AppText style={[styles.label, { color: colors.text }]}>{t('authenticatorSecret')}</AppText>
          <AppText selectable style={[styles.secret, { color: colors.text, backgroundColor: colors.surface }]}>
            {secret}
          </AppText>
          <TouchableOpacity onPress={() => void copySecret()} style={[styles.button, { backgroundColor: colors.primary }]}>
            <AppText style={styles.buttonText}>{t('copyAddress')}</AppText>
          </TouchableOpacity>
        </>
      ) : null}
      <SecretInput
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder={t('authenticatorCode')}
      />
      {!enabled ? (
        <TouchableOpacity
          disabled={busy}
          onPress={() => void (secret ? confirm() : start())}
          style={[styles.button, { backgroundColor: colors.connect }]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <AppText style={styles.buttonText}>{secret ? t('settingsSave') : t('authenticatorActivate')}</AppText>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          disabled={busy || code.length !== 6}
          onPress={() => void remove()}
          style={[styles.button, styles.remove, (busy || code.length !== 6) && styles.removeDisabled]}
        >
          <AppText style={styles.buttonText}>{t('authenticatorRemove')}</AppText>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  lead: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  status: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  qrWrap: {
    alignSelf: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
  },
  secret: {
    fontSize: 16,
    letterSpacing: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    fontWeight: '700',
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
  remove: {
    backgroundColor: '#B42318',
  },
  removeDisabled: {
    backgroundColor: '#9CA3AF',
  },
});
