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
import { authenticateBiometric, isBiometricEnabled, verifyPin } from '../services/appLock';
import { isFundsConfirmEnabled } from '../services/fundsConfirm';
import { SecretInput } from './SecretInput';
import { AppText } from './AppText';

interface FundsConfirmValue {
  confirmFunds: () => Promise<boolean>;
}

const FundsConfirmContext = createContext<FundsConfirmValue | null>(null);

export const FundsConfirmHost: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
    setPin('');
    setBusy(false);
    setError('');
  }, []);

  const confirmFunds = useCallback(async () => {
    if (!(await isFundsConfirmEnabled())) return true;
    if (await isBiometricEnabled()) {
      const bio = await authenticateBiometric();
      if (bio) return true;
    }
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpen(true);
    });
  }, []);

  const submitPin = async () => {
    if (pin.length !== 6 || busy) return;
    setBusy(true);
    const ok = await verifyPin(pin);
    if (!ok) {
      setError(t('lockPinWrong'));
      setPin('');
      setBusy(false);
      return;
    }
    finish(true);
  };

  const value = useMemo(() => ({ confirmFunds }), [confirmFunds]);

  return (
    <FundsConfirmContext.Provider value={value}>
      {children}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => finish(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <AppText style={[styles.title, { color: colors.text }]}>{t('fundsConfirmTitle')}</AppText>
            <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('fundsConfirmPrompt')}</AppText>
            <SecretInput
              value={pin}
              onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="••••••"
            />
            {error ? <AppText style={[styles.error, { color: colors.danger }]}>{error}</AppText> : null}
            <TouchableOpacity
              disabled={busy || pin.length !== 6}
              onPress={() => void submitPin()}
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
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    letterSpacing: 6,
    textAlign: 'center',
    marginBottom: 12,
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
