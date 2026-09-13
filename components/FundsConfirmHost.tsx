import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { authenticateBiometric, matchPassword, matchPin } from '../services/appLock';
import { verifyAuthenticator } from '../services/authenticator';
import { getAuthMethods, isAuthEnabled, isMethodReady, type AuthMethod, type AuthPurpose } from '../services/authPrefs';
import { loadVerifiedEmail } from '../services/accountEmail';
import { requestEmailOtp, verifyEmailOtp } from '../services/emailOtp';
import { ensureAppWallet } from '../services/appWallet';
import type { FundsConfirmPurpose } from '../services/fundsConfirm';
import { SecretInput } from './SecretInput';
import { AppText } from './AppText';
import type { TranslationKey } from '../i18n/translations';

interface FundsConfirmValue {
  confirmFunds: (purpose?: FundsConfirmPurpose) => Promise<boolean>;
}

const FundsConfirmContext = createContext<FundsConfirmValue | null>(null);

export const FundsConfirmHost: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [method, setMethod] = useState<AuthMethod>('password');
  const [purpose, setPurpose] = useState<FundsConfirmPurpose>('transfer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
    setPin('');
    setPassword('');
    setCode('');
    setBusy(false);
    setError('');
  }, []);

  const sendEmailCode = async () => {
    try {
      const [wallet, email] = await Promise.all([ensureAppWallet(), loadVerifiedEmail()]);
      if (!email) throw new Error('email');
      await requestEmailOtp(wallet.address, email);
    } catch (caught) {
      const reason = String((caught as Error)?.message || '');
      if (reason.includes('rate')) setError(t('otpRate'));
      else if (reason.includes('notify')) setError(t('emailNeedApi'));
      else setError(t('otpRequestFailed'));
    }
  };

  const askSecret = (next: AuthMethod) =>
    new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setMethod(next);
      setOpen(true);
      if (next === 'email') void sendEmailCode();
    });

  const confirmFunds = useCallback(async (nextPurpose: FundsConfirmPurpose = 'transfer') => {
    if (inflight.current) return inflight.current;
    const run = (async () => {
      const slot: AuthPurpose = nextPurpose === 'transfer' ? 'funds' : nextPurpose;
      if (!(await isAuthEnabled(slot))) return true;
      setPurpose(nextPurpose);
      const preferred = await getAuthMethods(slot);
      const queue: AuthMethod[] = [];
      for (const method of preferred) {
        if (await isMethodReady(method)) queue.push(method);
      }
      if (!queue.length) return true;
      for (const chosen of queue) {
        if (chosen === 'biometric') {
          const bio = await authenticateBiometric();
          if (!bio) return false;
          continue;
        }
        const ok = await askSecret(chosen);
        if (!ok) return false;
      }
      return true;
    })();
    inflight.current = run;
    try {
      return await run;
    } finally {
      inflight.current = null;
    }
  }, []);

  const submitSecret = async () => {
    if (busy) return;
    if (method === 'pin') {
      if (pin.length !== 6) return;
      setBusy(true);
      const ok = await matchPin(pin);
      if (!ok) {
        setError(t('lockPinWrong'));
        setPin('');
        setBusy(false);
        return;
      }
      finish(true);
      return;
    }
    if (method === 'authenticator') {
      if (code.length !== 6) return;
      setBusy(true);
      const ok = await verifyAuthenticator(code);
      if (!ok) {
        setError(t('authenticatorWrong'));
        setCode('');
        setBusy(false);
        return;
      }
      finish(true);
      return;
    }
    if (method === 'email') {
      if (code.length !== 6) return;
      setBusy(true);
      try {
        const [wallet, email] = await Promise.all([ensureAppWallet(), loadVerifiedEmail()]);
        if (!email) throw new Error('email');
        await verifyEmailOtp(wallet.address, email, code);
        finish(true);
      } catch {
        setError(t('emailCodeWrong'));
        setCode('');
        setBusy(false);
      }
      return;
    }
    if (!password) return;
    setBusy(true);
    const ok = await matchPassword(password);
    if (!ok) {
      setError(t('lockPasswordWrong'));
      setPassword('');
      setBusy(false);
      return;
    }
    finish(true);
  };

  const value = useMemo(() => ({ confirmFunds }), [confirmFunds]);
  const titleKey: TranslationKey =
    purpose === 'loanRequest'
      ? 'loanConfirmRequestTitle'
      : purpose === 'loanPay'
        ? 'loanConfirmPayTitle'
        : 'fundsConfirmTitle';
  const prompt =
    method === 'pin'
      ? t('fundsConfirmPrompt')
      : method === 'authenticator'
        ? t('fundsConfirmPromptAuth')
        : method === 'email'
          ? t('fundsConfirmPromptEmail')
          : t('fundsConfirmPromptPassword');
  const canSubmit =
    method === 'pin'
      ? pin.length === 6
      : method === 'authenticator' || method === 'email'
        ? code.length === 6
        : Boolean(password);

  return (
    <FundsConfirmContext.Provider value={value}>
      {children}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => finish(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <AppText style={[styles.title, { color: colors.text }]}>{t(titleKey)}</AppText>
            <AppText style={[styles.lead, { color: colors.textMuted }]}>{prompt}</AppText>
            {method === 'pin' ? (
              <SecretInput
                value={pin}
                onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="••••••"
              />
            ) : method === 'authenticator' || method === 'email' ? (
              <SecretInput
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder={method === 'email' ? t('emailCode') : t('authenticatorCode')}
              />
            ) : (
              <SecretInput
                value={password}
                onChangeText={setPassword}
                placeholder={t('lockCurrentPassword')}
              />
            )}
            {error ? <AppText style={[styles.error, { color: colors.danger }]}>{error}</AppText> : null}
            <TouchableOpacity
              disabled={busy || !canSubmit}
              onPress={() => void submitSecret()}
              style={[styles.button, { backgroundColor: colors.connect }]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <AppText style={styles.buttonText}>{t('ready')}</AppText>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => finish(false)}>
              <AppText style={[styles.cancel, { color: colors.textMuted }]}>{t('fundsConfirmCancel')}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </FundsConfirmContext.Provider>
  );
};

export function useFundsConfirm(): FundsConfirmValue {
  const ctx = useContext(FundsConfirmContext);
  if (!ctx) {
    throw new Error('useFundsConfirm must be used inside FundsConfirmHost');
  }
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  lead: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  error: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cancel: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
});
