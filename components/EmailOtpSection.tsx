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
import { notifyApiConfigured } from '../services/phoneOtp';
import { requestEmailOtp, verifyEmailOtp } from '../services/emailOtp';
import { storePasswordRecovery } from '../services/passwordRecovery';
import { isAllowedEmailProvider, isValidEmail, normalizeEmail } from '../utils/emailPolicy';
import { AppText, AppTextInput } from './AppText';

interface EmailOtpSectionProps {
  walletAddress: string;
  verifiedEmail: string;
  onVerified: (email: string) => void;
  changeLabel?: string;
}

export const EmailOtpSection: React.FC<EmailOtpSectionProps> = ({
  walletAddress,
  verifiedEmail,
  onVerified,
  changeLabel,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [email, setEmail] = useState(verifiedEmail);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(!verifiedEmail);
  const apiReady = notifyApiConfigured();
  const emailOk = isValidEmail(email);
  const allowed = isAllowedEmailProvider(email);
  const done = Boolean(verifiedEmail) && !editing;

  const requestCode = async () => {
    if (!emailOk || !walletAddress) return;
    setBusy(true);
    setError('');
    try {
      await requestEmailOtp(walletAddress, email);
      setSent(true);
    } catch (caught) {
      const reason = String((caught as Error)?.message || '');
      if (reason.includes('delivery')) setError(t('emailDeliveryFailed'));
      else if (reason.includes('notify')) setError(t('emailNeedApi'));
      else if (reason.includes('taken')) setError(t('emailTaken'));
      else if (reason.includes('rate')) setError(t('otpRate'));
      else if (reason.includes('appWallet') || reason.includes('locked')) setError(t('appWalletFailed'));
      else if (reason.includes('email')) setError(t('emailNotAllowed'));
      else setError(t('otpRequestFailed'));
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    setBusy(true);
    setError('');
    try {
      const saved = await verifyEmailOtp(walletAddress, email, code);
      await storePasswordRecovery(walletAddress);
      onVerified(saved);
      setEditing(false);
      setSent(false);
      setCode('');
      Alert.alert(t('ready'), t('settingsSaved'));
    } catch (caught) {
      const reason = String((caught as Error)?.message || '');
      if (reason.includes('code')) setError(t('emailCodeWrong'));
      else if (reason.includes('expired')) setError(t('emailExpired'));
      else if (reason.includes('taken')) setError(t('emailTaken'));
      else setError(t('otpVerifyFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      {done ? (
        <View style={[styles.done, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppIcon name="check" size={16} color={colors.success} />
          <AppText style={[styles.doneText, { color: colors.text }]}>{verifiedEmail}</AppText>
          <TouchableOpacity onPress={() => setEditing(true)}>
            <AppText style={[styles.change, { color: colors.primary }]}>{changeLabel || t('emailChange')}</AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          {!apiReady ? <AppText style={[styles.warn, { color: colors.warnText }]}>{t('emailNeedApi')}</AppText> : null}
          <AppText style={[styles.label, { color: colors.text }]}>{t('emailField')}</AppText>
          <AppTextInput
            value={email}
            onChangeText={(value) => {
              setEmail(normalizeEmail(value));
              setError('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="nombre@correo.com"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          />
          <TouchableOpacity
            disabled={busy || !emailOk || !apiReady || !walletAddress}
            onPress={() => void requestCode()}
            style={[styles.button, { backgroundColor: colors.connect }, (busy || !emailOk) && { backgroundColor: colors.chip }]}
          >
            {busy && !sent ? <ActivityIndicator color="#fff" /> : <AppText style={styles.buttonText}>{sent ? t('emailResend') : t('emailSend')}</AppText>}
          </TouchableOpacity>
          {sent ? (
            <>
              <AppText style={[styles.label, { color: colors.text }]}>{t('emailCode')}</AppText>
              <AppTextInput
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              />
              <TouchableOpacity
                disabled={busy || code.length !== 6}
                onPress={() => void confirmCode()}
                style={[styles.button, { backgroundColor: colors.connect }]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <AppText style={styles.buttonText}>{t('settingsSave')}</AppText>}
              </TouchableOpacity>
            </>
          ) : null}
          {email.length > 0 && !allowed ? (
            <AppText style={[styles.warn, { color: colors.danger }]}>{t('emailNotAllowed')}</AppText>
          ) : null}
          {error ? <AppText style={[styles.warn, { color: colors.danger }]}>{error}</AppText> : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
    fontSize: 15,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  warn: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  done: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doneText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  change: {
    fontSize: 13,
    fontWeight: '600',
  },
});
