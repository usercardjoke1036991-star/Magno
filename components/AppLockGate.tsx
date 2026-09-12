import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './icons';
import { AppText, AppTextInput } from './AppText';
import { EmailOtpSection } from './EmailOtpSection';
import { BrandLogo } from './BrandLogo';
import { SecretInput } from './SecretInput';
import {
  PASSWORD_LENGTH,
  PIN_LENGTH,
  getBiometricStatus,
  checkPassword,
  checkPin,
  getPinLockRemaining,
  isBiometricEnabled,
  isPasswordSet,
  isPinSet,
  loadWrapFromBiometric,
  lockNow,
  setPassword,
  shouldRelockAfterBackground,
} from '../services/appLock';
import { isValidMasterPassword } from '../utils/passwordPolicy';
import { requestPasswordRecovery, resetPasswordWithEmail } from '../services/passwordRecovery';
import { ensureAppWallet } from '../services/appWallet';
import { loadVerifiedEmail } from '../services/accountEmail';
import { requestEmailOtp, verifyEmailOtp } from '../services/emailOtp';
import { isAuthenticatorEnabled, unlockWithAuthenticator } from '../services/authenticator';
import { getAuthMethod, isAuthEnabled, type AuthMethod } from '../services/authPrefs';
import type { BiometricKind } from '../utils/biometricStatus';

type UnlockMode = 'pin' | 'password' | 'authenticator' | 'email';

function modeFromMethod(
  method: AuthMethod,
  passwordSet: boolean,
  pinSet: boolean,
  authOn: boolean,
  hasEmail = false
): UnlockMode {
  if (method === 'email' && hasEmail) return 'email';
  if (method === 'pin' && pinSet) return 'pin';
  if (method === 'authenticator' && authOn) return 'authenticator';
  if (passwordSet) return 'password';
  if (pinSet) return 'pin';
  if (authOn) return 'authenticator';
  return 'password';
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const;

type SetupStage = 'welcome' | 'passwordEnter' | 'emailEnter' | 'signIn';

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
  const [bioKinds, setBioKinds] = useState<BiometricKind[]>([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupStage, setSetupStage] = useState<SetupStage>('welcome');
  const [pendingPin, setPendingPin] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [unlockMode, setUnlockMode] = useState<UnlockMode>('password');
  const [hasPassword, setHasPassword] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [hasAuth, setHasAuth] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [lockMs, setLockMs] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverCode, setRecoverCode] = useState('');
  const [recoverSent, setRecoverSent] = useState(false);
  const [setupWallet, setSetupWallet] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const backgroundAt = useRef<number | null>(null);
  const boot = useCallback(async () => {
    const pinSet = await isPinSet();
    const passwordSet = await isPasswordSet();
    const authOn = await isAuthenticatorEnabled();
    const verifiedEmail = await loadVerifiedEmail();
    const bioStatus = await getBiometricStatus();
    const enrolled = bioStatus.available;
    const enabled = passwordSet || pinSet ? await isBiometricEnabled() : false;
    setBioReady(enrolled);
    setBioKinds(bioStatus.kinds);
    setBioOn(enabled);
    setHasPassword(passwordSet);
    setHasPin(pinSet);
    setHasAuth(authOn);
    setHasEmail(Boolean(verifiedEmail));
    if (!passwordSet && !pinSet) {
      setNeedsSetup(true);
      setSetupStage('welcome');
      setLocked(false);
      setReady(true);
      return;
    }
    const unlockOn = await isAuthEnabled('unlock');
    const method = await getAuthMethod('unlock');
    const nextMode = modeFromMethod(method, passwordSet, pinSet, authOn, Boolean(verifiedEmail));
    setNeedsSetup(false);
    setUnlockMode(nextMode);
    setBioOn(enabled && method === 'biometric');
    if (unlockOn && nextMode === 'email' && verifiedEmail) {
      try {
        const wallet = await ensureAppWallet();
        await requestEmailOtp(wallet.address, verifiedEmail);
      } catch {
        // El usuario puede reenviar.
      }
    }
    if (unlockOn) {
      lockNow();
      setLocked(true);
    } else {
      setLocked(false);
    }
    setReady(true);
    setLockMs(await getPinLockRemaining());
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
    boot().catch(async () => {
      const unlockOn = await isAuthEnabled('unlock').catch(() => false);
      setNeedsSetup(false);
      if (unlockOn) {
        lockNow();
        setLocked(true);
      } else {
        setLocked(false);
      }
      setReady(true);
    });
  }, [boot]);

  // En Xiaomi/MIUI el diálogo de huella al abrir falla. Solo se pide si el usuario pulsa el botón.

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundAt.current = Date.now();
        return;
      }
      if (next === 'active' && shouldRelockAfterBackground(backgroundAt.current)) {
        Promise.all([
          isPasswordSet(),
          isPinSet(),
          isAuthenticatorEnabled(),
          isAuthEnabled('unlock'),
          getAuthMethod('unlock'),
          isBiometricEnabled(),
          loadVerifiedEmail(),
        ])
          .then(([passwordSet, pinSet, authOn, unlockOn, method, bioEnabled, verifiedEmail]) => {
            if (!(passwordSet || pinSet)) return;
            setNeedsSetup(false);
            setRecovering(false);
            setPinDigits('');
            setPasswordInput('');
            setAuthCode('');
            setHasAuth(authOn);
            setHasEmail(Boolean(verifiedEmail));
            setUnlockMode(modeFromMethod(method, passwordSet, pinSet, authOn, Boolean(verifiedEmail)));
            setBioOn(bioEnabled && method === 'biometric');
            setError('');
            if (unlockOn) {
              lockNow();
              setLocked(true);
            }
          })
          .catch(() => {
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
      setLocked(false);
      setNeedsSetup(!(await isPasswordSet()));
      setPinDigits('');
      setError('');
      return;
    }
    setError(t('securityAccessKeyFailed'));
  };

  const finishUnlock = async (usedPin: string) => {
    if (await isPasswordSet()) {
      setHasPassword(true);
      setNeedsSetup(false);
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

  const submitUnlockEmail = async () => {
    if (busy || lockMs > 0 || authCode.length !== 6) return;
    setBusy(true);
    try {
      const [wallet, email] = await Promise.all([ensureAppWallet(), loadVerifiedEmail()]);
      if (!email) throw new Error('email');
      await verifyEmailOtp(wallet.address, email, authCode);
      setNeedsSetup(false);
      setLocked(false);
      setAuthCode('');
      setError('');
      setLockMs(0);
      setRecovering(false);
    } catch {
      setError(t('emailCodeWrong'));
      setAuthCode('');
    } finally {
      setBusy(false);
    }
  };

  const sendUnlockEmail = async () => {
    if (busy || lockMs > 0) return;
    setBusy(true);
    setError('');
    try {
      const [wallet, email] = await Promise.all([ensureAppWallet(), loadVerifiedEmail()]);
      if (!email) throw new Error('email');
      await requestEmailOtp(wallet.address, email);
    } catch (caught) {
      const reason = String((caught as Error)?.message || '');
      if (reason.includes('rate')) setError(t('otpRate'));
      else if (reason.includes('notify')) setError(t('emailNeedApi'));
      else setError(t('otpRequestFailed'));
    } finally {
      setBusy(false);
    }
  };

  const submitUnlockAuthenticator = async () => {
    if (busy || lockMs > 0 || authCode.length !== 6) return;
    setBusy(true);
    const ok = await unlockWithAuthenticator(authCode);
    setBusy(false);
    if (ok) {
      setNeedsSetup(false);
      setLocked(false);
      setAuthCode('');
      setError('');
      setLockMs(0);
      setRecovering(false);
      return;
    }
    setError(t('authenticatorWrong'));
    setAuthCode('');
  };

  const submitUnlockPassword = async () => {
    if (busy || lockMs > 0 || !passwordInput) return;
    setBusy(true);
    const result = await checkPassword(passwordInput);
    setBusy(false);
    if (result.ok) {
      setHasPassword(true);
      setNeedsSetup(false);
      setLocked(false);
      setPinDigits('');
      setPasswordInput('');
      setError('');
      setLockMs(0);
      setRecovering(false);
      return;
    }
    setLockMs(result.remainingMs);
    setError(
      result.locked ? t('lockCooldown', { seconds: Math.ceil(result.remainingMs / 1000) }) : t('lockPasswordWrong')
    );
    setPasswordInput('');
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
      const wallet = await ensureAppWallet();
      const verified = await loadVerifiedEmail();
      setHasPassword(true);
      setPasswordInput('');
      setPasswordConfirm('');
      setPendingPin('');
      setError('');
      if (verified) {
        setSetupWallet('');
        setSessionReady(true);
        return;
      }
      setSetupWallet(wallet.address.toLowerCase());
      setSetupStage('emailEnter');
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setError(
        code === 'password-key'
          ? t('lockPasswordPrivateKey')
          : code === 'wrong-pin'
            ? t('lockPinWrong')
            : code === 'device-bound'
              ? t('errDeviceBound')
              : code === 'locked'
                ? t('appWalletFailed')
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
      setRecovering(false);
      setRecoverSent(false);
      setRecoverCode('');
      setPasswordInput('');
      setPasswordConfirm('');
      setSessionReady(true);
    } catch (caught) {
      const reason = String((caught as Error)?.message || '');
      if (reason.includes('code')) setError(t('emailCodeWrong'));
      else if (reason.includes('expired')) setError(t('emailExpired'));
      else setError(t('lockRecoverFail'));
    } finally {
      setBusy(false);
    }
  };

  const keepSession = () => {
    setHasPassword(true);
    setNeedsSetup(false);
    setLocked(false);
    setRecovering(false);
    setSessionReady(false);
    setPendingPin('');
    setSetupWallet('');
    setPasswordInput('');
    setPasswordConfirm('');
    setAuthCode('');
    setError('');
  };

  useEffect(() => {
    if (!recovering) return;
    loadVerifiedEmail()
      .then((saved) => {
        if (saved) setRecoverEmail((current) => current || saved);
      })
      .catch(() => {});
  }, [recovering]);

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
  const welcomeStage = setup && setupStage === 'welcome' && !recovering && !sessionReady;
  const passwordStage = setup && setupStage === 'passwordEnter' && !recovering && !sessionReady;
  const emailStage = setup && setupStage === 'emailEnter' && !recovering && !sessionReady;
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
            <AppText style={[styles.title, { color: colors.text }]}>
              {sessionReady
                ? t('saveSession')
                : welcomeStage
                ? t('createAccount')
                : recovering
                  ? setup
                    ? t('signIn')
                    : t('lockRecoverTitle')
                  : emailStage
                    ? t('onboardStepEmail')
                    : passwordStage
                      ? t('lockPasswordTitle')
                      : t('lockUnlock')}
            </AppText>
            <AppText style={[styles.lead, { color: colors.textMuted }]}>
              {sessionReady
                ? t('saveSessionLead')
                : welcomeStage
                ? t('createAccountLead')
                : recovering
                  ? setup
                    ? t('signInLead')
                    : t('lockRecoverLead')
                  : emailStage
                    ? t('emailField')
                    : passwordStage
                      ? t('lockPasswordTypeLead')
                      : lockMs > 0
                          ? t('lockCooldown', { seconds: Math.ceil(lockMs / 1000) })
                          : unlockMode === 'password'
                            ? t('lockUnlockLeadPassword')
                            : unlockMode === 'authenticator'
                              ? t('lockUnlockLeadAuth')
                              : unlockMode === 'email'
                                ? t('lockUnlockLeadEmail')
                                : t('lockUnlockLead')}
            </AppText>
            {passwordStage ? (
              <AppText style={[styles.emailNote, { color: colors.textMuted }]}>{t('lockPasswordMin')}</AppText>
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
            {!setup && !recovering && !sessionReady && unlockMode === 'pin' ? (
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
            {error ? <AppText style={[styles.error, { color: colors.danger }]}>{error}</AppText> : null}
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
                <AppText style={styles.primaryText}>{t('createAccount')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setRecovering(true);
                  setSetupStage('signIn');
                  setError('');
                }}
                style={styles.switchMode}
              >
                <AppText style={[styles.switchText, { color: colors.primary }]}>{t('signIn')}</AppText>
              </TouchableOpacity>
            </View>
          ) : null}

          {passwordStage ? (
            <View style={styles.passwordBlock}>
              <SecretInput
                value={passwordInput}
                onChangeText={(value) => setPasswordInput(value.replace(/\s/g, '').slice(0, PASSWORD_LENGTH))}
                maxLength={PASSWORD_LENGTH}
                placeholder={t('lockNewPassword')}
              />
              <AppText style={[styles.counter, { color: colors.textMuted }]}>
                {t('lockPasswordCount', { count: passwordInput.length })}
              </AppText>
              <SecretInput
                value={passwordConfirm}
                onChangeText={(value) => setPasswordConfirm(value.replace(/\s/g, '').slice(0, PASSWORD_LENGTH))}
                maxLength={PASSWORD_LENGTH}
                placeholder={t('lockPasswordConfirm')}
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
                {busy ? <ActivityIndicator color="#fff" /> : <AppText style={styles.primaryText}>{t('ready')}</AppText>}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setSetupStage('welcome');
                  setPasswordInput('');
                  setPasswordConfirm('');
                  setError('');
                }}
                style={styles.switchMode}
              >
                <AppText style={[styles.switchText, { color: colors.primary }]}>{t('lockRecoverBack')}</AppText>
              </TouchableOpacity>
            </View>
          ) : null}

          {emailStage && setupWallet ? (
            <View style={styles.passwordBlock}>
              <EmailOtpSection
                walletAddress={setupWallet}
                verifiedEmail=""
                onVerified={() => {
                  setSessionReady(true);
                  setError('');
                }}
              />
            </View>
          ) : null}

          {sessionReady ? (
            <View style={styles.passwordBlock}>
              <TouchableOpacity
                onPress={keepSession}
                style={[styles.primary, { backgroundColor: colors.connect }]}
              >
                <AppText style={styles.primaryText}>{t('saveSession')}</AppText>
              </TouchableOpacity>
            </View>
          ) : null}

          {recovering ? (
            <View style={styles.passwordBlock}>
              <AppTextInput
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
                  <AppText style={styles.primaryText}>{t('lockRecoverSend')}</AppText>
                )}
              </TouchableOpacity>
              {recoverSent ? (
                <>
                  <AppTextInput
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
                  <SecretInput
                    value={passwordInput}
                    onChangeText={(value) => setPasswordInput(value.replace(/\s/g, '').slice(0, PASSWORD_LENGTH))}
                    maxLength={PASSWORD_LENGTH}
                    placeholder={t('lockNewPassword')}
                  />
                  <SecretInput
                    value={passwordConfirm}
                    onChangeText={(value) => setPasswordConfirm(value.replace(/\s/g, '').slice(0, PASSWORD_LENGTH))}
                    maxLength={PASSWORD_LENGTH}
                    placeholder={t('lockPasswordConfirm')}
                  />
                  <TouchableOpacity
                    disabled={busy || recoverCode.length !== 6 || !passwordOk}
                    onPress={() => void submitRecover()}
                    style={[styles.primary, { backgroundColor: colors.connect }]}
                  >
                    {busy ? <ActivityIndicator color="#fff" /> : <AppText style={styles.primaryText}>{t('saveSession')}</AppText>}
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
                  if (setup) setSetupStage('welcome');
                }}
                style={styles.switchMode}
              >
                <AppText style={[styles.switchText, { color: colors.primary }]}>{t('lockRecoverBack')}</AppText>
              </TouchableOpacity>
            </View>
          ) : null}

          {!setup && !recovering && !sessionReady && unlockMode === 'email' ? (
            <View style={styles.passwordBlock}>
              <SecretInput
                value={authCode}
                onChangeText={(value) => setAuthCode(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                editable={lockMs <= 0}
                placeholder={t('emailCode')}
              />
              <TouchableOpacity
                disabled={busy || lockMs > 0 || authCode.length !== 6}
                onPress={() => void submitUnlockEmail()}
                style={[styles.primary, { backgroundColor: colors.connect }]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <AppText style={styles.primaryText}>{t('lockUnlock')}</AppText>}
              </TouchableOpacity>
              <TouchableOpacity disabled={busy || lockMs > 0} onPress={() => void sendUnlockEmail()} style={styles.switchMode}>
                <AppText style={[styles.switchText, { color: colors.primary }]}>{t('emailResend')}</AppText>
              </TouchableOpacity>
            </View>
          ) : null}

          {!setup && !recovering && !sessionReady && unlockMode === 'authenticator' ? (
            <View style={styles.passwordBlock}>
              <SecretInput
                value={authCode}
                onChangeText={(value) => setAuthCode(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                editable={lockMs <= 0}
                placeholder={t('authenticatorCode')}
              />
              <TouchableOpacity
                disabled={busy || lockMs > 0 || authCode.length !== 6}
                onPress={() => void submitUnlockAuthenticator()}
                style={[styles.primary, { backgroundColor: colors.connect }]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <AppText style={styles.primaryText}>{t('lockUnlock')}</AppText>}
              </TouchableOpacity>
            </View>
          ) : null}

          {!setup && !recovering && !sessionReady && unlockMode === 'password' ? (
            <View style={styles.passwordBlock}>
              <SecretInput
                value={passwordInput}
                onChangeText={(value) => setPasswordInput(value.replace(/\s/g, '').slice(0, PASSWORD_LENGTH))}
                maxLength={PASSWORD_LENGTH}
                editable={lockMs <= 0}
                placeholder={t('lockPasswordGenerated')}
              />
              <TouchableOpacity
                disabled={busy || lockMs > 0 || !passwordInput}
                onPress={() => void submitUnlockPassword()}
                style={[styles.primary, { backgroundColor: colors.connect }]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <AppText style={styles.primaryText}>{t('lockUnlock')}</AppText>}
              </TouchableOpacity>
            </View>
          ) : null}

          {bioOn && bioReady && !setup && !recovering && !sessionReady ? (
            <TouchableOpacity
              onPress={tryBiometric}
              disabled={busy || lockMs > 0}
              style={[styles.bio, { borderColor: colors.border, backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel={t(
                bioKinds.includes('facial') && !bioKinds.includes('fingerprint') && !bioKinds.includes('iris')
                  ? 'lockBiometricFace'
                  : 'lockBiometric'
              )}
            >
              <AppIcon name="shield" size={18} color={colors.primary} />
              <AppText style={[styles.bioText, { color: colors.text }]}>
                {t(
                  bioKinds.includes('facial') && !bioKinds.includes('fingerprint') && !bioKinds.includes('iris')
                    ? 'lockBiometricFace'
                    : 'lockBiometric'
                )}
              </AppText>
            </TouchableOpacity>
          ) : null}

          {!setup && !recovering && !sessionReady && hasPassword && unlockMode !== 'password' ? (
            <TouchableOpacity
              onPress={() => {
                setUnlockMode('password');
                setError('');
                setPinDigits('');
                setAuthCode('');
              }}
              style={styles.switchMode}
            >
              <AppText style={[styles.switchText, { color: colors.primary }]}>{t('lockPasswordUse')}</AppText>
            </TouchableOpacity>
          ) : null}
          {!setup && !recovering && !sessionReady && hasPin && unlockMode !== 'pin' ? (
            <TouchableOpacity
              onPress={() => {
                setUnlockMode('pin');
                setError('');
                setPasswordInput('');
                setAuthCode('');
              }}
              style={styles.switchMode}
            >
              <AppText style={[styles.switchText, { color: colors.primary }]}>{t('lockPasswordUsePin')}</AppText>
            </TouchableOpacity>
          ) : null}
          {!setup && !recovering && !sessionReady && hasAuth && unlockMode !== 'authenticator' ? (
            <TouchableOpacity
              onPress={() => {
                setUnlockMode('authenticator');
                setError('');
                setPinDigits('');
                setPasswordInput('');
              }}
              style={styles.switchMode}
            >
              <AppText style={[styles.switchText, { color: colors.primary }]}>{t('lockPasswordUseAuth')}</AppText>
            </TouchableOpacity>
          ) : null}
          {!setup && !recovering && !sessionReady && hasEmail && unlockMode !== 'email' ? (
            <TouchableOpacity
              onPress={() => {
                setUnlockMode('email');
                setError('');
                setPinDigits('');
                setPasswordInput('');
                setAuthCode('');
                void sendUnlockEmail();
              }}
              style={styles.switchMode}
            >
              <AppText style={[styles.switchText, { color: colors.primary }]}>{t('lockPasswordUseEmail')}</AppText>
            </TouchableOpacity>
          ) : null}

          {!setup && !recovering && !sessionReady && hasPassword ? (
            <TouchableOpacity
              onPress={() => {
                setRecovering(true);
                setError('');
                setPasswordInput('');
                setPasswordConfirm('');
              }}
              style={styles.switchMode}
            >
              <AppText style={[styles.switchText, { color: colors.primary }]}>{t('lockForgotPassword')}</AppText>
            </TouchableOpacity>
          ) : null}

          {!setup && !recovering && !sessionReady && unlockMode === 'pin' ? (
            <View style={styles.pad}>
              {KEYS.map((key, index) => (
                <TouchableOpacity
                  key={`${key}-${index}`}
                  disabled={!key || busy || (!setup && lockMs > 0)}
                  onPress={() => (pressKey(key))}
                  style={[styles.key, !key && styles.keyGhost]}
                  accessibilityRole={key ? 'button' : undefined}
                  accessibilityLabel={key === '⌫' ? t('lockBackspace') : key}
                >
                  <AppText style={[styles.keyText, { color: colors.text }]}>{key}</AppText>
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
