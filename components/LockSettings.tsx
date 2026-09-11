import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import {
  PASSWORD_LENGTH,
  changePassword,
  changePin,
  isPasswordSet,
  isPinSet,
  isValidMasterPassword,
  setPassword,
  setPin,
} from '../services/appLock';
import { isWeakPin } from '../utils/pinPolicy';
import { loadAppWallet } from '../services/appWallet';
import { storePasswordRecovery } from '../services/passwordRecovery';
import { BiometricLockSection } from './BiometricLockSection';
import { SecretInput } from './SecretInput';

export const LockSettings: React.FC<{ hideLead?: boolean }> = ({ hideLead = false }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  const refresh = () => {
    isPinSet().then(setHasPin).catch(() => {});
    isPasswordSet().then(setHasPassword).catch(() => {});
  };

  useEffect(() => {
    refresh();
  }, []);

  const savePin = async () => {
    if (next !== confirm) {
      setMessage(t('lockPinMismatch'));
      return;
    }
    if (isWeakPin(next)) {
      setMessage(t('lockPinWeak'));
      return;
    }
    setBusy(true);
    try {
      if (!hasPin) {
        await setPin(next);
        setHasPin(true);
      } else {
        const ok = await changePin(current, next);
        if (!ok) {
          setMessage(t('lockPinWrong'));
          return;
        }
      }
      setCurrent('');
      setNext('');
      setConfirm('');
      setMessage(t('lockPinChanged'));
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'weak-pin' ? t('lockPinWeak') : t('lockPinWrong'));
    } finally {
      setBusy(false);
    }
  };

  const passwordFail = (error: unknown) => {
    const code = error instanceof Error ? error.message : '';
    if (code === 'password-key') return t('lockPasswordPrivateKey');
    return t('lockPasswordWeak');
  };

  const savePassword = async () => {
    if (nextPassword !== confirmPassword) {
      setPasswordMessage(t('lockPasswordMismatch'));
      return;
    }
    setPasswordBusy(true);
    try {
      if (!hasPassword) {
        await setPassword(nextPassword, current || undefined);
        setHasPassword(true);
      } else {
        const ok = await changePassword(currentPassword, nextPassword, current || undefined);
        if (!ok) {
          setPasswordMessage(t('lockPasswordWrong'));
          return;
        }
      }
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      setPasswordMessage(t('lockPasswordChanged'));
      try {
        const wallet = await loadAppWallet();
        if (wallet?.address) await storePasswordRecovery(wallet.address);
      } catch {
        // La recuperación se actualizará al verificar el correo de nuevo.
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setPasswordMessage(code === 'wrong-pin' ? t('lockPinWrong') : passwordFail(error));
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <View>
      {hideLead ? null : <Text style={[styles.lead, { color: colors.textMuted }]}>{t('lockSettingsLead')}</Text>}
      {hasPin ? (
        <>
          <Text style={[styles.label, { color: colors.text }]}>{t('lockCurrentPin')}</Text>
          <SecretInput
            value={current}
            onChangeText={(value) => setCurrent(value.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="••••••"
          />
        </>
      ) : (
        <Text style={[styles.note, { color: colors.textMuted }]}>{t('lockCreateOptional')}</Text>
      )}
      <Text style={[styles.label, { color: colors.text }]}>{t('lockNewPin')}</Text>
      <SecretInput
        value={next}
        onChangeText={(value) => setNext(value.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="••••••"
      />
      <Text style={[styles.label, { color: colors.text }]}>{t('lockConfirmPin')}</Text>
      <SecretInput
        value={confirm}
        onChangeText={(value) => setConfirm(value.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="••••••"
      />
      <TouchableOpacity
        disabled={busy || (hasPin && current.length !== 6) || next.length !== 6 || confirm.length !== 6}
        onPress={savePin}
        style={[
          styles.button,
          { backgroundColor: colors.connect },
          (busy || (hasPin && current.length !== 6) || next.length !== 6) && { backgroundColor: colors.chip },
        ]}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{hasPin ? t('lockChangePin') : t('lockCreatePin')}</Text>}
      </TouchableOpacity>
      {message ? <Text style={[styles.note, { color: colors.textMuted }]}>{message}</Text> : null}

      <BiometricLockSection />

      <Text style={[styles.section, { color: colors.text }]}>{t('lockPasswordTitle')}</Text>
      <Text style={[styles.lead, { color: colors.textMuted }]}>{t('lockPasswordLead')}</Text>
      <Text style={[styles.note, { color: colors.textMuted }]}>{t('lockPasswordNotSeed')}</Text>
      <Text style={[styles.note, { color: colors.textMuted }]}>{t('lockPasswordNoEmail')}</Text>
      <Text style={[styles.note, { color: colors.textMuted }]}>{t('lockPasswordMin')}</Text>
      {hasPassword ? (
        <>
          <Text style={[styles.label, { color: colors.text }]}>{t('lockCurrentPassword')}</Text>
          <SecretInput
            value={currentPassword}
            onChangeText={(value) => setCurrentPassword(value.replace(/\s/g, '').slice(0, PASSWORD_LENGTH))}
            maxLength={PASSWORD_LENGTH}
          />
        </>
      ) : null}
      <Text style={[styles.label, { color: colors.text }]}>{t('lockNewPassword')}</Text>
      <SecretInput
        value={nextPassword}
        onChangeText={(value) => setNextPassword(value.replace(/\s/g, '').slice(0, PASSWORD_LENGTH))}
        maxLength={PASSWORD_LENGTH}
      />
      <Text style={[styles.counter, { color: colors.textMuted }]}>
        {t('lockPasswordCount', { count: nextPassword.length })}
      </Text>
      <Text style={[styles.label, { color: colors.text }]}>{t('lockPasswordConfirm')}</Text>
      <SecretInput
        value={confirmPassword}
        onChangeText={(value) => setConfirmPassword(value.replace(/\s/g, '').slice(0, PASSWORD_LENGTH))}
        maxLength={PASSWORD_LENGTH}
      />
      <TouchableOpacity
        disabled={
          passwordBusy ||
          !isValidMasterPassword(nextPassword) ||
          confirmPassword !== nextPassword ||
          (hasPassword && !currentPassword) ||
          (hasPin && current.length !== 6)
        }
        onPress={() => void savePassword()}
        style={[styles.button, { backgroundColor: colors.connect }]}
      >
        {passwordBusy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{hasPassword ? t('lockChangePassword') : t('lockPasswordTitle')}</Text>
        )}
      </TouchableOpacity>
      {passwordMessage ? <Text style={[styles.note, { color: colors.textMuted }]}>{passwordMessage}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  lead: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  section: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 16,
    letterSpacing: 4,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 13,
  },
  counter: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: -6,
    marginBottom: 10,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
