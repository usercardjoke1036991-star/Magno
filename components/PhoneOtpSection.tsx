import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './icons';
import { notifyApiConfigured, requestPhoneOtp, verifyPhoneOtp } from '../services/phoneOtp';
import { isValidPhone, normalizePhone } from '../services/notificationProfile';
import { QuatriviumCreditService } from '../services/quatriviumCreditService';
import { isCreditReady } from '../constants/rpcConfig';
import { humanizeTxError } from '../utils/txErrors';
import { AppText, AppTextInput } from './AppText';

interface PhoneOtpSectionProps {
  walletAddress: string;
  isRegistered: boolean;
  identityBound: boolean;
  deviceMatches?: boolean;
  isLoading: boolean;
  paused?: boolean;
  onBound: () => void;
}

export const PhoneOtpSection: React.FC<PhoneOtpSectionProps> = ({
  walletAddress,
  isRegistered,
  identityBound,
  deviceMatches = false,
  isLoading,
  paused = false,
  onBound,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  const done = identityBound && deviceMatches && !editing;
  const needsThisDevice = identityBound && !deviceMatches;
  const chainReady = isCreditReady();
  const blocked = isLoading || paused || !chainReady || !isRegistered || !walletAddress || busy;
  const apiReady = notifyApiConfigured();
  const phoneOk = isValidPhone(normalizePhone(phone)) && Boolean(normalizePhone(phone));

  const requestCode = async () => {
    if (!phoneOk) return;
    setBusy(true);
    setError('');
    try {
      await requestPhoneOtp(walletAddress, phone);
      setSent(true);
    } catch (caught) {
      const reason = String((caught as Error)?.message || '');
      if (reason.includes('delivery')) setError(t('otpDeliveryFailed'));
      else if (reason.includes('notify')) setError(t('otpNeedApi'));
      else if (reason.includes('phone taken')) setError(t('otpPhoneTaken'));
      else if (reason.includes('rate')) setError(t('otpRate'));
      else setError(t('otpRequestFailed'));
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    setBusy(true);
    setError('');
    try {
      const attestation = await verifyPhoneOtp(walletAddress, phone, code);
      await QuatriviumCreditService.vincularIdentidad(
        attestation.phoneHash,
        attestation.deviceHash,
        attestation.deadline,
        attestation.v,
        attestation.r,
        attestation.s
      );
      Alert.alert(t('ready'), t('otpDone'));
      setEditing(false);
      setSent(false);
      setCode('');
      onBound();
    } catch (caught) {
      const reason = String((caught as Error)?.message || '');
      if (reason.includes('code')) setError(t('otpCodeWrong'));
      else if (reason.includes('expired')) setError(t('otpExpired'));
      else if (reason.includes('phone taken')) setError(t('otpPhoneTaken'));
      else if (reason.includes('device taken')) setError(t('otpDeviceTaken'));
      else setError(humanizeTxError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('otpLead')}</AppText>
      {needsThisDevice ? (
        <AppText style={[styles.warn, { color: colors.warnText }]}>{t('seedNeedDevice')}</AppText>
      ) : null}
      {done ? (
        <View style={[styles.done, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppIcon name="check" size={16} color={colors.success} />
          <AppText style={[styles.doneText, { color: colors.text }]}>
            {t('otpDone')}
          </AppText>
          <TouchableOpacity onPress={() => setEditing(true)}>
            <AppText style={[styles.change, { color: colors.primary }]}>{t('otpChange')}</AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          {!chainReady ? (
            <AppText style={[styles.warn, { color: colors.warnText }]}>{t('liveCreditNotReady')}</AppText>
          ) : !isRegistered ? (
            <AppText style={[styles.warn, { color: colors.warnText }]}>{t('activateBeforeLoan')}</AppText>
          ) : null}
          {!apiReady ? (
            <AppText style={[styles.warn, { color: colors.warnText }]}>{t('otpNeedApi')}</AppText>
          ) : null}
          <AppText style={[styles.label, { color: colors.text }]}>{t('otpPhone')}</AppText>
          <AppTextInput
            value={phone}
            onChangeText={setPhone}
            editable={!blocked}
            keyboardType="phone-pad"
            placeholder="+58412..."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          />
          <TouchableOpacity
            disabled={blocked || !phoneOk || !apiReady}
            onPress={requestCode}
            style={[
              styles.button,
              { backgroundColor: colors.connect },
              (blocked || !phoneOk || !apiReady) && { backgroundColor: colors.chip },
            ]}
          >
            {busy && !sent ? (
              <ActivityIndicator color="#111" />
            ) : (
              <AppText style={styles.buttonText}>{sent ? t('otpResend') : t('otpSend')}</AppText>
            )}
          </TouchableOpacity>
          {sent ? (
            <>
              <AppText style={[styles.label, { color: colors.text }]}>{t('otpCode')}</AppText>
              <AppTextInput
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                editable={!blocked}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              />
              <TouchableOpacity
                disabled={blocked || code.length !== 6}
                onPress={confirmCode}
                style={[
                  styles.button,
                  { backgroundColor: colors.primary },
                  (blocked || code.length !== 6) && { backgroundColor: colors.chip },
                ]}
              >
                {busy && sent ? (
                  <ActivityIndicator color="#111" />
                ) : (
                  <AppText style={styles.buttonText}>{paused ? t('actionPaused') : t('otpConfirm')}</AppText>
                )}
              </TouchableOpacity>
            </>
          ) : null}
          {error ? <AppText style={[styles.warn, { color: colors.danger }]}>{error}</AppText> : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  lead: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  warn: {
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
  },
  done: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  doneText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  change: {
    fontSize: 13,
    fontWeight: '600',
  },
});
