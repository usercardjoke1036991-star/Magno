import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon, type IconName } from './icons';
import { LockSettings } from './LockSettings';
import { KycSection } from './KycSection';
import { PhoneOtpSection } from './PhoneOtpSection';
import { useAppWallet } from '../wallet/AppWalletContext';
import { useWeb3Balances } from '../hooks/useWeb3Balances';
import { useWeb3Transactions } from '../hooks/useWeb3Transactions';
import { getSupportedTokens } from '../constants/tokens';
import { verifyPin, isPinSet, isPasswordSet, isBiometricEnabled, getBiometricStatus, checkPassword } from '../services/appLock';
import { BiometricLockSection } from './BiometricLockSection';
import { isFundsConfirmEnabled, setFundsConfirmEnabled } from '../services/fundsConfirm';
import { QuatriviumCreditService } from '../services/quatriviumCreditService';
import { SecretInput } from './SecretInput';
import { humanizeTxError } from '../utils/txErrors';
import {
  addressFromPhrase,
  getSecretPhrase,
  hasSecretPhrase,
  isPhraseBackedUp,
  isValidSecretPhrase,
  markPhraseBackedUp,
} from '../services/appWallet';
import { useAppMode } from '../wallet/AppModeContext';
import { isCreditReady } from '../constants/rpcConfig';
import type { TranslationKey } from '../i18n/translations';
import { AppText, AppTextInput } from './AppText';

type RowStatus = 'done' | 'todo' | 'warn';
type Panel = 'menu' | 'kyc' | 'password' | 'pin' | 'fingerprint' | 'access' | 'phrase' | 'phone' | 'replace';

export const SecuritySettings: React.FC = () => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { mode } = useAppMode();
  const demoAccount = mode === 'demo';
  const primaryToken = useMemo(() => getSupportedTokens()[0], [mode]);
  const { address, recreate, restore } = useAppWallet();
  const { userInfo, refetch } = useWeb3Balances(address, primaryToken);
  const accountBlocked = userInfo.hasActiveLoan || userInfo.isDelinquent;
  const { declararKyc, isLoading: kycBusy } = useWeb3Transactions();

  const [panel, setPanel] = useState<Panel>('menu');
  const [phrase, setPhrase] = useState<string | null>(null);
  const [backedUp, setBackedUp] = useState(false);
  const [hasPhrase, setHasPhrase] = useState(false);
  const [revealPin, setRevealPin] = useState('');
  const [revealPassword, setRevealPassword] = useState('');
  const [restorePhrase, setRestorePhrase] = useState('');
  const [restorePin, setRestorePin] = useState('');
  const [destroyWord, setDestroyWord] = useState('');
  const [destroyPin, setDestroyPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [pinSet, setPinSet] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  const [fundsOn, setFundsOn] = useState(false);

  const refreshPhrase = async () => {
    const [exists, ack, pin, password, bioStatus, bioEnabled, funds] = await Promise.all([
      hasSecretPhrase(),
      isPhraseBackedUp(),
      isPinSet(),
      isPasswordSet(),
      getBiometricStatus(),
      isBiometricEnabled(),
      isFundsConfirmEnabled(),
    ]);
    setHasPhrase(exists);
    setBackedUp(ack);
    setPinSet(pin);
    setPasswordSet(password);
    setBioOn(bioEnabled && bioStatus.available);
    setFundsOn(funds);
    setPhrase(null);
    setShown(false);
  };

  useEffect(() => {
    refreshPhrase().catch(() => {});
  }, [address]);

  const kycOk = userInfo.kycDeclarado;
  const phoneOk = userInfo.identityBound;

  const reveal = async () => {
    if (pinSet) {
      if (!(await verifyPin(revealPin))) {
        Alert.alert(t('error'), t('lockPinWrong'));
        return;
      }
    } else {
      const checked = await checkPassword(revealPassword);
      if (!checked.ok) {
        Alert.alert(t('error'), t('lockPasswordWrong'));
        return;
      }
    }
    const secret = await getSecretPhrase();
    if (!secret) {
      Alert.alert(t('seedTitle'), t('seedMissing'));
      return;
    }
    setPhrase(secret);
    setShown(true);
    setRevealPin('');
    setRevealPassword('');
  };

  const confirmBackup = async () => {
    await markPhraseBackedUp();
    setBackedUp(true);
    setShown(false);
    Alert.alert(t('ready'), t('seedSavedAck'));
  };

  const declareKyc = async () => {
    if (!address) return false;
    if (!userInfo.isRegistered) {
      Alert.alert(t('register'), t('activateBeforeLoan'));
      return false;
    }
    const result = await declararKyc();
    if (result.success) refetch();
    return result.success;
  };

  const restoreWallet = async () => {
    if (accountBlocked) {
      Alert.alert(t('activeLoan'), t('appWalletDestroyBlocked'));
      return;
    }
    if (pinSet && !(await verifyPin(restorePin))) {
      Alert.alert(t('error'), t('lockPinWrong'));
      return;
    }
    if (!isValidSecretPhrase(restorePhrase)) {
      Alert.alert(t('error'), t('seedInvalid'));
      return;
    }
    setBusy(true);
    try {
      const nextAddress = addressFromPhrase(restorePhrase);
      if (nextAddress !== address && userInfo.isRegistered) {
        if (userInfo.hasActiveLoan) {
          Alert.alert(t('activeLoan'), t('appWalletDestroyLoan'));
          return;
        }
        if (userInfo.isDelinquent) {
          Alert.alert(t('activeLoan'), t('destroyDelinquent'));
          return;
        }
        if (!isCreditReady()) {
          Alert.alert(t('error'), t('liveCreditNotReady'));
          return;
        }
        await QuatriviumCreditService.destruirCuenta(primaryToken.address);
      }
      await restore(restorePhrase);
      await refreshPhrase();
      refetch();
      setRestorePhrase('');
      setRestorePin('');
      setShown(false);
      Alert.alert(t('ready'), t('seedRestored'));
    } catch (error) {
      Alert.alert(t('error'), humanizeTxError(error));
    } finally {
      setBusy(false);
    }
  };

  const destroyAccount = async () => {
    if (accountBlocked) {
      Alert.alert(t('activeLoan'), t('appWalletDestroyBlocked'));
      return;
    }
    if (userInfo.hasActiveLoan) {
      Alert.alert(t('activeLoan'), t('appWalletDestroyLoan'));
      return;
    }
    if (userInfo.isDelinquent) {
      Alert.alert(t('activeLoan'), t('destroyDelinquent'));
      return;
    }
    if (destroyWord.trim().toUpperCase() !== 'DESTRUIR') {
      Alert.alert(t('error'), t('appWalletDestroyType'));
      return;
    }
    if (pinSet && !(await verifyPin(destroyPin))) {
      Alert.alert(t('error'), t('lockPinWrong'));
      return;
    }
    Alert.alert(t('appWalletDestroyTitle'), t('appWalletDestroyConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('appWalletDestroy'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            if (userInfo.isRegistered) {
              if (!isCreditReady()) {
                Alert.alert(t('error'), t('liveCreditNotReady'));
                return;
              }
              await QuatriviumCreditService.destruirCuenta(primaryToken.address);
            }
            await recreate();
            await refreshPhrase();
            refetch();
            setDestroyWord('');
            setDestroyPin('');
            Alert.alert(t('ready'), t('appWalletDestroyed'));
          } catch (error) {
            Alert.alert(t('error'), humanizeTxError(error));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const Row = ({
    label,
    hint,
    status,
    icon,
    onPress,
  }: {
    label: string;
    hint: string;
    status: RowStatus;
    icon: IconName;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <AppIcon
        name={status === 'done' ? 'check' : status === 'warn' ? 'warning' : icon}
        size={16}
        color={status === 'done' ? colors.success : status === 'warn' ? colors.danger : colors.primary}
      />
      <View style={styles.rowText}>
        <AppText style={[styles.rowLabel, { color: colors.text }]}>{label}</AppText>
        <AppText style={[styles.rowHint, { color: colors.textMuted }]}>{hint}</AppText>
      </View>
      <AppText style={[styles.chevron, { color: colors.textMuted }]}>›</AppText>
    </TouchableOpacity>
  );

  const panelTitle: Record<Exclude<Panel, 'menu'>, TranslationKey> = {
    kyc: 'securityKyc',
    password: 'lockPasswordTitle',
    pin: 'securityPin',
    fingerprint: 'securityFingerprint',
    access: 'securityAccessKey',
    phrase: 'seedTitle',
    phone: 'securityPhone',
    replace: 'oneAccountTitle',
  };

  if (panel !== 'menu') {
    return (
      <View>
        <TouchableOpacity
          onPress={() => {
            setPanel('menu');
            void refreshPhrase();
          }}
          accessibilityRole="button"
        >
          <AppText style={[styles.back, { color: colors.primary }]}>{t('settingsBack')}</AppText>
        </TouchableOpacity>
        <AppText style={[styles.section, { color: colors.text }]}>{t(panelTitle[panel])}</AppText>
        {panel === 'kyc' && !demoAccount ? (
          <KycSection
            walletAddress={address}
            isRegistered={userInfo.isRegistered}
            kycDeclarado={userInfo.kycDeclarado}
            isLoading={busy || kycBusy}
            paused={userInfo.paused}
            onDeclare={declareKyc}
          />
        ) : null}
        {panel === 'password' ? <LockSettings mode="password" onChanged={() => void refreshPhrase()} /> : null}
        {panel === 'pin' ? <LockSettings mode="pin" onChanged={() => void refreshPhrase()} /> : null}
        {panel === 'phone' && !demoAccount ? (
          <PhoneOtpSection
            walletAddress={address}
            isRegistered={userInfo.isRegistered}
            identityBound={userInfo.identityBound}
            isLoading={busy || kycBusy}
            paused={userInfo.paused}
            onBound={refetch}
          />
        ) : null}
        {panel === 'fingerprint' ? (
          <BiometricLockSection compact onChanged={setBioOn} />
        ) : null}
        {panel === 'access' ? (
          <BiometricLockSection compact onChanged={setBioOn} />
        ) : null}
        {panel === 'phrase' ? (
          <View>
            <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('seedLead')}</AppText>
            {!hasPhrase ? (
              <AppText style={[styles.lead, { color: colors.warnText }]}>{t('seedMissing')}</AppText>
            ) : shown && phrase ? (
              <View style={[styles.phraseBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <AppText style={[styles.phrase, { color: colors.text }]}>
                  {phrase}
                </AppText>
                <TouchableOpacity onPress={confirmBackup} style={[styles.button, { backgroundColor: colors.primary }]}>
                  <AppText style={styles.buttonText}>{t('seedConfirmSaved')}</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShown(false);
                    setPhrase(null);
                  }}
                  style={[styles.button, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                >
                  <AppText style={[styles.buttonText, { color: colors.text }]}>{t('seedHide')}</AppText>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {pinSet ? (
                  <SecretInput
                    value={revealPin}
                    onChangeText={(value) => setRevealPin(value.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder={t('lockCurrentPin')}
                  />
                ) : (
                  <SecretInput
                    value={revealPassword}
                    onChangeText={setRevealPassword}
                    placeholder={t('lockCurrentPassword')}
                  />
                )}
                <TouchableOpacity
                  disabled={pinSet ? revealPin.length !== 6 : !revealPassword}
                  onPress={reveal}
                  style={[
                    styles.button,
                    { backgroundColor: colors.connect },
                    (pinSet ? revealPin.length !== 6 : !revealPassword) && { backgroundColor: colors.chip },
                  ]}
                >
                  <AppText style={styles.buttonText}>{t('seedReveal')}</AppText>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}
        {panel === 'replace' ? (
          <View>
            <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('oneAccountLead')}</AppText>
            {accountBlocked ? (
              <AppText style={[styles.lead, { color: colors.danger }]}>{t('appWalletDestroyBlocked')}</AppText>
            ) : null}
            <AppTextInput
              value={destroyWord}
              onChangeText={setDestroyWord}
              autoCapitalize="characters"
              editable={!accountBlocked}
              placeholder="DESTRUIR"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            />
            {pinSet ? (
              <SecretInput
                value={destroyPin}
                onChangeText={(value) => setDestroyPin(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                editable={!accountBlocked}
                placeholder={t('lockCurrentPin')}
              />
            ) : null}
            <TouchableOpacity
              disabled={busy || accountBlocked}
              onPress={destroyAccount}
              accessibilityState={{ disabled: busy || accountBlocked }}
              style={[
                styles.button,
                styles.destroy,
                (busy || accountBlocked) && styles.destroyDisabled,
              ]}
            >
              <AppText style={[styles.buttonText, accountBlocked && styles.destroyDisabledText]}>
                {t('appWalletDestroy')}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={accountBlocked}
              onPress={() => setShowRestore((value) => !value)}
              accessibilityRole="button"
              accessibilityState={{ disabled: accountBlocked, expanded: showRestore }}
            >
              <AppText style={[styles.label, { color: accountBlocked ? colors.textMuted : colors.primary }]}>
                {t('seedRestoreToggle')}
              </AppText>
            </TouchableOpacity>
            {showRestore && !accountBlocked ? (
              <>
                <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('seedRestoreLead')}</AppText>
                <AppTextInput
                  value={restorePhrase}
                  onChangeText={setRestorePhrase}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  placeholder={t('seedRestorePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.multiline, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                />
                {pinSet ? (
                  <SecretInput
                    value={restorePin}
                    onChangeText={(value) => setRestorePin(value.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder={t('lockCurrentPin')}
                  />
                ) : null}
                <TouchableOpacity
                  disabled={busy || (pinSet && restorePin.length !== 6)}
                  onPress={() => void restoreWallet()}
                  style={[
                    styles.button,
                    { backgroundColor: colors.connect },
                    (busy || (pinSet && restorePin.length !== 6)) && styles.destroyDisabled,
                  ]}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <AppText style={styles.buttonText}>{t('seedRestoreAction')}</AppText>}
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <AppText style={[styles.lead, { color: colors.textMuted }]}>
        {demoAccount ? t('securityLeadDemo') : t('securityLead')}
      </AppText>
      {demoAccount ? null : (
      <Row
        icon="id"
        label={t('securityKyc')}
        hint={kycOk ? t('securityKycDone') : t('securityKycTodo')}
        status={kycOk ? 'done' : 'warn'}
        onPress={() => setPanel('kyc')}
      />
      )}
      <Row
        icon="lock"
        label={t('securityPassword')}
        hint={passwordSet ? t('securityPasswordDone') : t('securityPasswordTodo')}
        status={passwordSet ? 'done' : 'warn'}
        onPress={() => setPanel('password')}
      />
      <Row
        icon="lock"
        label={t('securityPin')}
        hint={pinSet ? t('securityPinHint') : t('securityPinTodo')}
        status={pinSet ? 'done' : 'todo'}
        onPress={() => setPanel('pin')}
      />
      <Row
        icon="unlock"
        label={t('securityFingerprint')}
        hint={bioOn ? t('securityFingerprintDone') : t('securityFingerprintTodo')}
        status={bioOn ? 'done' : 'todo'}
        onPress={() => setPanel('fingerprint')}
      />
      <Row
        icon="unlock"
        label={t('securityAccessKey')}
        hint={bioOn ? t('securityAccessKeyDone') : t('securityAccessKeyTodo')}
        status={bioOn ? 'done' : 'todo'}
        onPress={() => setPanel('access')}
      />
      <Row
        icon="shield"
        label={t('securityPhrase')}
        hint={backedUp ? t('securityPhraseDone') : t('securityPhraseTodo')}
        status={backedUp ? 'done' : 'todo'}
        onPress={() => setPanel('phrase')}
      />
      {demoAccount ? null : (
      <Row
        icon="phone"
        label={t('securityPhone')}
        hint={phoneOk ? t('securityPhoneDone') : t('securityPhoneTodo')}
        status={phoneOk ? 'done' : 'warn'}
        onPress={() => setPanel('phone')}
      />
      )}
      <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <AppIcon name="lock" size={16} color={colors.primary} />
        <View style={styles.rowText}>
          <AppText style={[styles.rowLabel, { color: colors.text }]}>{t('fundsConfirmTitle')}</AppText>
          <AppText style={[styles.rowHint, { color: colors.textMuted }]}>{t('fundsConfirmLead')}</AppText>
        </View>
        <Switch
          value={fundsOn}
          onValueChange={(value) => {
            setFundsOn(value);
            void setFundsConfirmEnabled(value);
          }}
        />
      </View>
      <Row
        icon="warning"
        label={t('oneAccountTitle')}
        hint={t('appWalletReplaceHint')}
        status="todo"
        onPress={() => setPanel('replace')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  lead: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  section: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 8,
  },
  back: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    lineHeight: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  phraseBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  phrase: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    marginBottom: 12,
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
  destroy: {
    backgroundColor: '#B42318',
  },
  destroyDisabled: {
    backgroundColor: '#9CA3AF',
  },
  destroyDisabledText: {
    color: '#F3F4F6',
  },
});
