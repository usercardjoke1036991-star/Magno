import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './icons';
import { BrandLogo } from './BrandLogo';
import {
  PASSWORD_LENGTH,
  PIN_LENGTH,
  biometricAvailable,
  checkPassword,
  checkPin,
  getPinLockRemaining,
  isBiometricEnabled,
  isPasswordSet,
  isPinSet,
  loadWrapFromBiometric,
  lockNow,
  setPassword,
  setPin,
  shouldRelockAfterBackground,
} from '../services/appLock';
import { isValidMasterPassword } from '../utils/passwordPolicy';
import { requestPasswordRecovery, resetPasswordWithEmail } from '../services/passwordRecovery';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const;

type SetupStage = 'welcome' | 'passwordEnter';
type UnlockMode = 'pin' | 'password';

interface AppLockGateProps {
  children: React.ReactNode;
}

export const AppLockGate: React.FC<AppLockGateProps> = ({ children }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pin, setPinDigits] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  const [bioReady, setBioReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupStage, setSetupStage] = useState<SetupStage>('welcome');
  const [setupDraft, setSetupDraft] = useState('');
  const [pendingPin, setPendingPin] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [unlockMode, setUnlockMode] = useState<UnlockMode>('password');
  const [hasPassword, setHasPassword] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [lockMs, setLockMs] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverCode, setRecoverCode] = useState('');
  const [recoverSent, setRecoverSent] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  const boot = useCallback(async () => {
    const pinSet = await isPinSet();
    const passwordSet = await isPasswordSet();
    const enrolled = await biometricAvailable();
    const enabled = passwordSet || pinSet ? await isBiometricEnabled() : false;
    setBioReady(enrolled);
    setBioOn(enabled);
    setHasPassword(passwordSet);
    setHasPin(pinSet);
    if (!passwordSet && !pinSet) {
      setNeedsSetup(true);
      setSetupStage('passwordEnter');
      setLocked(false);
      setReady(true);
      return;
    }
    if (!passwordSet && pinSet) {
      setNeedsSetup(false);
      lockNow();
      setLocked(true);
      setUnlockMode('pin');
      setReady(true);
      setLockMs(await getPinLockRemaining());
      return;
    }
    setNeedsSetup(false);
    lockNow();
    setLocked(true);
    setUnlockMode('password');
    setReady(true);
    const remaining = await getPinLockRemaining();
    setLockMs(remaining);
    if (enabled && enrolled && remaining <= 0) {
      const wrap = await loadWrapFromBiometric();
      if (wrap) {
        setLocked(false);
      }
    }
  }, []);

  const beginPasswordSetup = async (pinValue: string) => {
    setPendingPin(pinValue);
    setPasswordInput('');
    setPasswordConfirm('');
    setSetupStage('passwordEnter');
    setNeedsSetup(true);
    setLocked(false);
    setError('');
  };

  useEffect(() => {
    boot().catch(() => {
      lockNow();
      setNeedsSetup(false);
      setLocked(true);
      setReady(true);
    });
  }, [boot]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundAt.current = Date.now();
        return;
      }
      if (next === 'active' && shouldRelockAfterBackground(backgroundAt.current)) {
        Promise.all([isPasswordSet(), isPinSet()])
          .then(([passwordSet, pinSet]) => {
            if (passwordSet || pinSet) {
              lockNow();
              setLocked(true);
              setNeedsSetup(false);
              setRecovering(false);
              setPinDigits('');
              setPasswordInput('');
              setError('');
            }
          })
          .catch(() => {
            lockNow();
            setLocked(true);
            setPinDigits('');
          });
      }
      backgroundAt.current = null;
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (lockMs <= 0) return undefined;
    const timer = setInterval(() => {
      setLockMs((value) => Math.max(0, value - 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockMs]);

  const tryBiometric = async () => {
    if (!bioOn || !bioReady || lockMs > 0) return;
    setBusy(true);
    const wrap = await loadWrapFromBiometric();
    setBusy(false);
    if (wrap) {
      if (!(await isPasswordSet())) {
        lockNow();
        setError(t('lockUnlockLead'));
        return;
      }
      setLocked(false);
      setPinDigits('');
      setError('');
      return;
    }
    setError(t('lockPinWrong'));
  };

  const finishUnlock = async (usedPin: string) => {
    if (await isPasswordSet()) {
      setHasPassword(true);
      setLocked(false);
      setPinDigits('');
      setPasswordInput('');
      setError('');
      setLockMs(0);
      setRecovering(false);
      return;
    }
    await beginPasswordSetup(usedPin);
  };

  const pressKey = async (key: string) => {
    if (!key || busy || lockMs > 0) return;
    if (key === '⌫') {
      setPinDigits((value) => value.slice(0, -1));
      setError('');
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPinDigits(next);
    if (next.length < PIN_LENGTH) return;

    setBusy(true);
    const result = await checkPin(next);
    setBusy(false);
    if (result.ok) {
      await finishUnlock(next);
      return;
    }
    setLockMs(result.remainingMs);
    setError(result.locked ? t('lockCooldown', { seconds: Math.ceil(result.remainingMs / 1000) }) : t('lockPinWrong'));
    setPinDigits('');
  };

  const submitUnlockPassword = async () => {
    if (busy || lockMs > 0 || !passwordInput) return;
    setBusy(true);
    const result = await checkPassword(passwordInput);
    setBusy(false);
    if (result.ok) {
      await finishUnlock(pendingPin);
      return;
    }
    setLockMs(result.remainingMs);
    setError(
      result.locked ? t('lockCooldown', { seconds: Math.ceil(result.remainingMs / 1000) }) : t('lockPasswordWrong')
    );
    setPasswordInput('');
  };

  const pressSetupKey = async (key: string) => {
    if (!key || busy) return;
    if (key === '⌫') {
      setPinDigits((value) => value.slice(0, -1));
      setError('');
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPinDigits(next);
    if (next.length < PIN_LENGTH) return;
    if (!setupDraft) {
      setSetupDraft(next);
      setPinDigits('');
      setError('');
      return;
    }
    if (next !== setupDraft) {
      setError(t('lockPinMismatch'));
      setSetupDraft('');
      setPinDigits('');
      return;
    }
    setBusy(true);
    try {
      await setPin(next);
      await beginPasswordSetup(next);
      setSetupDraft('');
      setPinDigits('');
    } catch (err) {
      setError(err instanceof Error && err.message === 'weak-pin' ? t('lockPinWeak') : t('lockPinWrong'));
      setSetupDraft('');
      setPinDigits('');
    } finally {
      setBusy(false);
    }
  };

  const saveUserPassword = async () => {
    if (!isValidMasterPassword(passwordInput)) {
      setError(t('lockPasswordWeak'));
      return;
    }
    if (passwordInput !== passwordConfirm) {
      setError(t('lockPasswordMismatch'));
      setPasswordConfirm('');
      return;
    }
    setBusy(true);
    try {
      await setPassword(passwordInput, pendingPin || undefined);
      setHasPassword(true);
      setNeedsSetup(false);
      setLocked(false);
      setPasswordInput('');
      setPasswordConfirm('');
      setPendingPin('');
      setError('');
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setError(
        code === 'password-key'
          ? t('lockPasswordPrivateKey')
          : code === 'wrong-pin'
            ? t('lockPinWrong')
            : t('lockPasswordWeak')
      );
    } finally {
      setBusy(false);
    }
  };

  const sendRecover = async () => {
    setBusy(true);
    setError('');
    try {
      await requestPasswordRecovery(recoverEmail);
      setRecoverSent(true);
    } catch (caught) {
      const reason = String((caught as Error)?.message || '');
      if (reason.includes('rate')) setError(t('otpRate'));
      else if (reason.includes('email')) setError(t('emailNotAllowed'));
      else if (reason.includes('notify')) setError(t('emailNeedApi'));
      else setError(t('lockRecoverFail'));
    } finally {
      setBusy(false);
    }
  };

  const submitRecover = async () => {
    if (!isValidMasterPassword(passwordInput) || passwordInput !== passwordConfirm) {
      setError(passwordInput !== passwordConfirm ? t('lockPasswordMismatch') : t('lockPasswordWeak'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await resetPasswordWithEmail(recoverEmail, recoverCode, passwordInput);
      setHasPassword(true);
      setLocked(false);
      setRecovering(false);
      setRecoverSent(false);
      setRecoverCode('');
      setPasswordInput('');
      setPasswordConfirm('');
    } catch (caught) {
      const reason = String((caught as Error)?.message || '');
      if (reason.includes('code')) setError(t('emailCodeWrong'));
      else if (reason.includes('expired')) setError(t('emailExpired'));
      else setError(t('lockRecoverFail'));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg, justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!needsSetup && !locked) {
    return <>{children}</>;
  }

  const setup = needsSetup;
  const welcomeStage = setup && setupStage === 'welcome';
  const passwordStage = setup && setupStage === 'passwordEnter';
  const passwordOk = isValidMasterPassword(passwordInput) && passwordInput === passwordConfirm;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            {welcomeStage ? <BrandLogo size={72} /> : <AppIcon name="lock" size={28} color={colors.primary} />}
            <Text style={[styles.title, { color: colors.text }]}>
              {welcomeStage
                ? t('createAccount')
                : recovering
                  ? t('lockRecoverTitle')
                  : passwordStage
                    ? t('lockPasswordTitle')
                    : setup
                      ? setupDraft
                        ? t('lockConfirmPin')
                        : t('lockCreatePin')
                      : t('lockUnlock')}
            </Text>
            <Text style={[styles.lead, { color: colors.textMuted }]}>
              {welcomeStage
                ? t('createAccountLead')
                : recovering
                  ? t('lockRecoverLead')
                  : passwordStage
                    ? t('lockPasswordTypeLead')
                    : setup
                      ? t('lockSetupLead')
                      : lockMs > 0
                        ? t('lockCooldown', { seconds: Math.ceil(lockMs / 1000) })
                        : unlockMode === 'password'
                          ? t('lockUnlockLeadPassword')
                          : t('lockUnlockLead')}
            </Text>
            {passwordStage ? (
              <>
                <Text style={[styles.emailNote, { color: colors.textMuted }]}>{t('lockPasswordNotSeed')}</Text>
                <Text style={[styles.emailNote, { color: colors.textMuted }]}>{t('lockPasswordNoEmail')}</Text>
                <Text style={[styles.emailNote, { color: colors.textMuted }]}>{t('lockPasswordMin')}</Text>
              </>
            ) : null}
            {!passwordStage && !welcomeStage && !recovering && setup ? (
              <View style={styles.dots}>
                {Array.from({ length: PIN_LENGTH }).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      { borderColor: colors.border },
                      index < pin.length && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  />
                ))}
              </View>
            ) : null}
            {!setup && !recovering && unlockMode === 'pin' ? (
              <View style={styles.dots}>
                {Array.from({ length: PIN_LENGTH }).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      { borderColor: colors.border },
                      index < pin.length && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  />
                ))}
              </View>
            ) : null}
            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          </View>

          {welcomeStage ? (
            <View style={styles.passwordBlock}>
              <TouchableOpacity
                onPress={() => {
                  setSetupStage('passwordEnter');
                  setError('');
                }}
                style={[styles.primary, { backgroundColor: colors.connect }]}
              >
                <Text style={styles.primaryText}>{t('createAccount')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {passwordStage ? (
            <View style={styles.passwordBlock}>
              <TextInput
                value={passwordInput}
                onChangeText={(value) => setPasswordInput(value.replace(/\s/g, '').slice(0, PASSWORD_LENGTH))}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                secureTextEntry
                maxLength={PASSWORD_LENGTH}
                placeholder={t('lockNewPassword')}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.passwordInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },
                ]}
              />
              <Text style={[styles.counter, { color: colors.textMuted }]}>
                {t('lockPasswordCount', { count: passwordInput.length })}
              </Text>
              <TextInput
                value={passwordConfirm}
                onChangeText={(value) => setPasswordConfirm(value.replace(/\s/g, '').slice(0, PASSWORD_LENGTH))}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                secureTextEntry
                maxLength={PASSWORD_LENGTH}
                placeholder={t('lockPasswordConfirm')}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.passwordInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },
                ]}
              />
              <TouchableOpacity
                disabled={busy || !passwordOk}
                onPress={() => void saveUserPassword()}
                style={[
                  styles.primary,
                  { backgroundColor: colors.connect },
                  !passwordOk && { backgroundColor: colors.chip },
                ]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('ready')}</Text>}
              </TouchableOpacity>
            </View>
          ) : null}

          {recovering && !setup ? (
            <View style={styles.passwordBlock}>
              <TextInput
                value={recoverEmail}
                onChangeText={(value) => setRecoverEmail(value.trim().toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder={t('emailField')}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.passwordInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },
                ]}
              />
              <TouchableOpacity
                disabled={busy || !recoverEmail}
                onPress={() => void sendRecover()}
                style={[styles.primary, { backgroundColor: colors.connect }]}
              >
                {busy && !recoverSent ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryText}>{t('lockRecoverSend')}</Text>
                )}
              </TouchableOpacity>
              {recoverSent ? (
                <>
                  <TextInput
                    value={recoverCode}
                    onChangeText={(value) => setRecoverCode(value.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder={t('lockRecoverCode')}
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.passwordInput,
                      { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },
                    ]}
                  />
                  <TextInput
                    value={passwordInput}
                    onChangeText={(value) => setPasswordInput(value.replace(/\s/g, '').slice(0, PASSWORD_LENGTH))}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    maxLength={PASSWORD_LENGTH}
                    placeholder={t('lockNewPassword')}
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.passwordInput,
                      { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },
                    ]}
                  />
                  <TextInput
                    value={passwordConfirm}
                    onChangeText={(value) => setPasswordConfirm(value.replace(/\s/g, '').slice(0, PASSWORD_LENGTH))}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    maxLength={PASSWORD_LENGTH}
                    placeholder={t('lockPasswordConfirm')}
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.passwordInput,
                      { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },
                    ]}
                  />
                  <TouchableOpacity
                    disabled={busy || recoverCode.length !== 6 || !passwordOk}
                    onPress={() => void submitRecover()}
                    style={[styles.primary, { backgroundColor: colors.connect }]}
                  >
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('lockRecoverSubmit')}</Text>}
                  </TouchableOpacity>
                </>
              ) : null}
              <TouchableOpacity
                onPress={() => {
                  setRecovering(false);
                  setError('');
                  setRecoverSent(false);
                  setPasswordInput('');
                  setPasswordConfirm('');
                }}
                style={styles.switchMode}
              >
                <Text style={[styles.switchText, { color: colors.primary }]}>{t('lockRecoverBack')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!setup && !recovering && unlockMode === 'password' ? (
            <View style={styles.passwordBlock}>
              <TextInput
                value={passwordInput}
                onChangeText={(value) => setPasswordInput(value.replace(/\s/g, '').slice(0, PASSWORD_LENGTH))}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                secureTextEntry
                maxLength={PASSWORD_LENGTH}
                editable={lockMs <= 0}
                placeholder={t('lockPasswordGenerated')}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.passwordInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },
                ]}
              />
              <TouchableOpacity
                disabled={busy || lockMs > 0 || !passwordInput}
                onPress={() => void submitUnlockPassword()}
                style={[styles.primary, { backgroundColor: colors.connect }]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('lockUnlock')}</Text>}
              </TouchableOpacity>
            </View>
          ) : null}

          {bioOn && bioReady && !setup && !recovering ? (
            <TouchableOpacity
              onPress={tryBiometric}
              disabled={busy || lockMs > 0}
              style={[styles.bio, { borderColor: colors.border, backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel={t('lockBiometric')}
            >
              <AppIcon name="shield" size={18} color={colors.primary} />
              <Text style={[styles.bioText, { color: colors.text }]}>{t('lockBiometric')}</Text>
            </TouchableOpacity>
          ) : null}

          {!setup && !recovering && hasPassword && hasPin ? (
            <TouchableOpacity
              onPress={() => {
                setUnlockMode((mode) => (mode === 'pin' ? 'password' : 'pin'));
                setError('');
                setPinDigits('');
                setPasswordInput('');
              }}
              style={styles.switchMode}
            >
              <Text style={[styles.switchText, { color: colors.primary }]}>
                {unlockMode === 'pin' ? t('lockPasswordUse') : t('lockPasswordUsePin')}
              </Text>
            </TouchableOpacity>
          ) : null}

          {!setup && !recovering && hasPassword ? (
            <TouchableOpacity
              onPress={() => {
                setRecovering(true);
                setError('');
                setPasswordInput('');
                setPasswordConfirm('');
              }}
              style={styles.switchMode}
            >
              <Text style={[styles.switchText, { color: colors.primary }]}>{t('lockForgotPassword')}</Text>
            </TouchableOpacity>
          ) : null}

          {(setup && setupStage !== 'welcome' && setupStage !== 'passwordEnter') ||
          (!setup && !recovering && unlockMode === 'pin') ? (
            <View style={styles.pad}>
              {KEYS.map((key, index) => (
                <TouchableOpacity
                  key={`${key}-${index}`}
                  disabled={!key || busy || (!setup && lockMs > 0)}
                  onPress={() => (setup ? pressSetupKey(key) : pressKey(key))}
                  style={[styles.key, !key && styles.keyGhost]}
                  accessibilityRole={key ? 'button' : undefined}
                  accessibilityLabel={key === '⌫' ? t('lockBackspace') : key}
                >
                  <Text style={[styles.keyText, { color: colors.text }]}>{key}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 32,
  },
  hero: {
    paddingHorizontal: 28,
    paddingTop: 36,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  lead: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  emailNote: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  error: {
    marginTop: 14,
    fontSize: 13,
    textAlign: 'center',
  },
  bio: {
    marginHorizontal: 28,
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  bioText: {
    fontSize: 15,
    fontWeight: '600',
  },
  pad: {
    marginTop: 28,
    paddingHorizontal: 36,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  key: {
    width: '30%',
    aspectRatio: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyGhost: {
    opacity: 0,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '500',
  },
  passwordBlock: {
    paddingHorizontal: 24,
    marginTop: 20,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 8,
  },
  counter: {
    marginTop: 0,
    marginBottom: 8,
    fontSize: 12,
    textAlign: 'right',
  },
  primary: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  switchMode: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
