import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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
import { verifyPin, isPinSet, biometricAvailable, isBiometricEnabled, setBiometricEnabled, authenticateBiometric } from '../services/appLock';
import { isFundsConfirmEnabled, setFundsConfirmEnabled } from '../services/fundsConfirm';
import { QuatriviumCreditService } from '../services/quatriviumCreditService';
import { humanizeTxError } from '../utils/txErrors';
import {
  addressFromPhrase,
  getSecretPhrase,
  hasSecretPhrase,
  isPhraseBackedUp,
  isValidSecretPhrase,
  markPhraseBackedUp,
} from '../services/appWallet';
import type { TranslationKey } from '../i18n/translations';

type RowStatus = 'done' | 'todo' | 'warn';
type Panel = 'menu' | 'kyc' | 'pin' | 'access' | 'phrase' | 'phone' | 'replace';

export const SecuritySettings: React.FC = () => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { address, recreate, restore } = useAppWallet();
  const { userInfo, refetch } = useWeb3Balances(address, getSupportedTokens()[0]);
  const { declararKyc, isLoading: kycBusy } = useWeb3Transactions();

  const [panel, setPanel] = useState<Panel>('menu');
  const [phrase, setPhrase] = useState<string | null>(null);
  const [backedUp, setBackedUp] = useState(false);
  const [hasPhrase, setHasPhrase] = useState(false);
  const [revealPin, setRevealPin] = useState('');
  const [restorePhrase, setRestorePhrase] = useState('');
  const [restorePin, setRestorePin] = useState('');
  const [rotatePin, setRotatePin] = useState('');
  const [destroyWord, setDestroyWord] = useState('');
  const [destroyPin, setDestroyPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);
  const [pinSet, setPinSet] = useState(false);
  const [bioReady, setBioReady] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  const [fundsOn, setFundsOn] = useState(false);

  const refreshPhrase = async () => {
    const [exists, ack, pin, bioAvail, bioEnabled, funds] = await Promise.all([
      hasSecretPhrase(),
      isPhraseBackedUp(),
      isPinSet(),
      biometricAvailable(),
      isBiometricEnabled(),
      isFundsConfirmEnabled(),
    ]);
    setHasPhrase(exists);
    setBackedUp(ack);
    setPinSet(pin);
    setBioReady(bioAvail);
    setBioOn(bioEnabled);
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
    if (!(await verifyPin(revealPin))) {
      Alert.alert(t('error'), t('lockPinWrong'));
      return;
    }
    const secret = await getSecretPhrase();
    if (!secret) {
      Alert.alert(t('seedTitle'), t('seedMissing'));
      return;
    }
    setPhrase(secret);
    setShown(true);
    setRevealPin('');
  };

  const toggleFingerprint = async () => {
    if (!bioReady) {
      Alert.alert(t('securityAccessKey'), t('lockBiometricUnavailable'));
      return;
    }
    // Requiere autenticación biométrica tanto para activar como para desactivar
    const ok = await authenticateBiometric();
    if (!ok) {
      Alert.alert(t('securityAccessKey'), t('securityAccessKeyFailed'));
      return;
    }
    if (bioOn) {
      await setBiometricEnabled(false);
      setBioOn(false);
      return;
    }
    const enabled = await setBiometricEnabled(true);
    if (!enabled) {
      Alert.alert(t('securityAccessKey'), t('lockBiometricUnavailable'));
      return;
    }
    setBioOn(true);
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
        await QuatriviumCreditService.destruirCuenta(getSupportedTokens()[0].address);
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

  const rotatePhrase = async () => {
    if (userInfo.hasActiveLoan) {
      Alert.alert(t('activeLoan'), t('appWalletDestroyLoan'));
      return;
    }
    if (userInfo.isDelinquent) {
      Alert.alert(t('activeLoan'), t('destroyDelinquent'));
      return;
    }
    if (pinSet && !(await verifyPin(rotatePin))) {
      Alert.alert(t('error'), t('lockPinWrong'));
      return;
    }
    Alert.alert(t('seedRotate'), t('seedRotateConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('seedRotate'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            if (userInfo.isRegistered) {
              await QuatriviumCreditService.destruirCuenta(getSupportedTokens()[0].address);
            }
            await recreate();
            await refreshPhrase();
            refetch();
            setRotatePin('');
            setShown(false);
            Alert.alert(t('ready'), t('seedRotated'));
          } catch (error) {
            Alert.alert(t('error'), humanizeTxError(error));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const destroyAccount = async () => {
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
              await QuatriviumCreditService.destruirCuenta(getSupportedTokens()[0].address);
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
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.rowHint, { color: colors.textMuted }]}>{hint}</Text>
      </View>
      <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
    </TouchableOpacity>
  );

  const panelTitle: Record<Exclude<Panel, 'menu'>, TranslationKey> = {
    kyc: 'securityKyc',
    pin: 'securityPin',
    access: 'securityAccessKey',
    phrase: 'seedTitle',
    phone: 'securityPhone',
    replace: 'oneAccountTitle',
  };

  if (panel !== 'menu') {
    return (
      <View>
        <TouchableOpacity onPress={() => setPanel('menu')} accessibilityRole="button">
          <Text style={[styles.back, { color: colors.primary }]}>{t('settingsBack')}</Text>
        </TouchableOpacity>
        <Text style={[styles.section, { color: colors.text }]}>{t(panelTitle[panel])}</Text>
        {panel === 'kyc' ? (
          <KycSection
            walletAddress={address}
            isRegistered={userInfo.isRegistered}
            kycDeclarado={userInfo.kycDeclarado}
            isLoading={busy || kycBusy}
            paused={userInfo.paused}
            onDeclare={declareKyc}
          />
        ) : null}
        {panel === 'pin' ? <LockSettings hideLead /> : null}
        {panel === 'phone' ? (
          <PhoneOtpSection
            walletAddress={address}
            isRegistered={userInfo.isRegistered}
            identityBound={userInfo.identityBound}
            isLoading={busy || kycBusy}
            paused={userInfo.paused}
            onBound={refetch}
          />
        ) : null}
        {panel === 'access' ? (
          <View>
            <Text style={[styles.lead, { color: colors.textMuted }]}>{t('securityAccessKeyLead')}</Text>
            {!bioReady ? (
              <Text style={[styles.lead, { color: colors.warnText }]}>{t('lockBiometricUnavailable')}</Text>
            ) : (
              <TouchableOpacity
                onPress={toggleFingerprint}
                style={[styles.button, { backgroundColor: bioOn ? colors.surface : colors.connect, borderWidth: bioOn ? 1 : 0, borderColor: colors.border }]}
              >
                <Text style={[styles.buttonText, bioOn && { color: colors.text }]}>
                  {bioOn ? t('securityAccessKeyDisable') : t('securityAccessKeyEnable')}
                </Text>
              </TouchableOpacity>
            )}
            {bioOn ? (
              <Text style={[styles.rowHint, { color: colors.success }]}>{t('securityAccessKeyDone')}</Text>
            ) : null}
          </View>
        ) : null}
        {panel === 'phrase' ? (
          <View>
            <Text style={[styles.lead, { color: colors.textMuted }]}>{t('seedLead')}</Text>
            {!hasPhrase ? (
              <Text style={[styles.lead, { color: colors.warnText }]}>{t('seedMissing')}</Text>
            ) : shown && phrase ? (
              <View style={[styles.phraseBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.phrase, { color: colors.text }]}>
                  {phrase}
                </Text>
                <TouchableOpacity onPress={confirmBackup} style={[styles.button, { backgroundColor: colors.primary }]}>
                  <Text style={styles.buttonText}>{t('seedConfirmSaved')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                    value={revealPin}
                    onChangeText={(value) => setRevealPin(value.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                    placeholder={t('lockCurrentPin')}
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                  />
                <TouchableOpacity
                  disabled={revealPin.length !== 6}
                  onPress={reveal}
                  style={[styles.button, { backgroundColor: colors.connect }, revealPin.length !== 6 && { backgroundColor: colors.chip }]}
                >
                  <Text style={styles.buttonText}>{t('seedReveal')}</Text>
                </TouchableOpacity>
              </>
            )}
            <Text style={[styles.label, { color: colors.text }]}>{t('seedRotate')}</Text>
            <Text style={[styles.lead, { color: colors.textMuted }]}>{t('seedRotateLead')}</Text>
            {pinSet ? (
              <TextInput
                value={rotatePin}
                onChangeText={(value) => setRotatePin(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder={t('seedRotatePinRequired')}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              />
            ) : null}
            <TouchableOpacity
              disabled={busy || (pinSet && rotatePin.length !== 6)}
              onPress={() => void rotatePhrase()}
              style={[styles.button, styles.destroy, (busy || (pinSet && rotatePin.length !== 6)) && { opacity: 0.6 }]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('seedRotate')}</Text>}
            </TouchableOpacity>
            <Text style={[styles.label, { color: colors.text }]}>{t('seedRestore')}</Text>
            <TextInput
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
              <TextInput
                value={restorePin}
                onChangeText={(value) => setRestorePin(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder={t('lockCurrentPin')}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              />
            ) : null}
            <TouchableOpacity
              disabled={busy || (pinSet && restorePin.length !== 6)}
              onPress={restoreWallet}
              style={[styles.button, { backgroundColor: colors.connect }, (busy || (pinSet && restorePin.length !== 6)) && { backgroundColor: colors.chip }]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('seedRestoreAction')}</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
        {panel === 'replace' ? (
          <View>
            <Text style={[styles.lead, { color: colors.textMuted }]}>{t('oneAccountLead')}</Text>
            {userInfo.hasActiveLoan ? (
              <Text style={[styles.lead, { color: colors.danger }]}>{t('appWalletDestroyLoan')}</Text>
            ) : null}
            <TextInput
              value={destroyWord}
              onChangeText={setDestroyWord}
              autoCapitalize="characters"
              placeholder="DESTRUIR"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            />
            {pinSet ? (
              <TextInput
                value={destroyPin}
                onChangeText={(value) => setDestroyPin(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder={t('lockCurrentPin')}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              />
            ) : null}
            <TouchableOpacity
              disabled={busy}
              onPress={destroyAccount}
              style={[styles.button, styles.destroy, busy && { opacity: 0.6 }]}
            >
              <Text style={styles.buttonText}>{t('appWalletDestroy')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <Text style={[styles.lead, { color: colors.textMuted }]}>{t('securityLead')}</Text>
      <Row
        icon="id"
        label={t('securityKyc')}
        hint={kycOk ? t('securityKycDone') : t('securityKycTodo')}
        status={kycOk ? 'done' : 'warn'}
        onPress={() => setPanel('kyc')}
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
      <Row
        icon="phone"
        label={t('securityPhone')}
        hint={phoneOk ? t('securityPhoneDone') : t('securityPhoneTodo')}
        status={phoneOk ? 'done' : 'warn'}
        onPress={() => setPanel('phone')}
      />
      <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <AppIcon name="lock" size={16} color={colors.primary} />
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('fundsConfirmTitle')}</Text>
          <Text style={[styles.rowHint, { color: colors.textMuted }]}>{t('fundsConfirmLead')}</Text>
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
});
