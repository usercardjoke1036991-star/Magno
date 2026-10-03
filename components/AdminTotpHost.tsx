import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { Signer } from 'ethers';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { notifyApiConfigured } from '../services/notifyClient';
import { isDemoAccount, isDemoMode } from '../constants/rpcConfig';
import {
  adminTotpStatus,
  confirmAdminTotp,
  enrollAdminTotp,
  verifyAdminTotp,
} from '../services/adminTotp';
import { AppText, AppTextInput } from './AppText';

type AdminTotpValue = {
  confirmAdminStep: (signer: Signer, wallet: string) => Promise<boolean>;
};

const AdminTotpContext = createContext<AdminTotpValue | null>(null);

export const AdminTotpHost: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const job = useRef<{ signer: Signer; wallet: string; mode: 'enroll' | 'verify' } | null>(null);

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    job.current = null;
    setOpen(false);
    setSecret('');
    setCode('');
    setBusy(false);
    setError('');
  }, []);

  const submit = async () => {
    if (busy || code.replace(/\D/g, '').length !== 6 || !job.current) return;
    setBusy(true);
    setError('');
    try {
      const { signer, wallet, mode } = job.current;
      const ok =
        mode === 'enroll'
          ? await confirmAdminTotp(signer, wallet, code)
          : await verifyAdminTotp(signer, wallet, code);
      if (!ok) {
        setError(t('adminTotpWrong'));
        setCode('');
        setBusy(false);
        return;
      }
      finish(true);
    } catch {
      setError(t('adminTotpWrong'));
      setBusy(false);
    }
  };

  const confirmAdminStep = useCallback(async (signer: Signer, wallet: string) => {
    if (!notifyApiConfigured()) {
      return isDemoAccount() || isDemoMode();
    }
    try {
      const status = await adminTotpStatus(signer, wallet);
      if (status.enrolled) {
        job.current = { signer, wallet, mode: 'verify' };
        setSecret('');
      } else {
        const enrolled = await enrollAdminTotp(signer, wallet);
        if (enrolled.enrolled) {
          job.current = { signer, wallet, mode: 'verify' };
          setSecret('');
        } else {
          job.current = { signer, wallet, mode: 'enroll' };
          setSecret(String(enrolled.secret || ''));
        }
      }
    } catch {
      return false;
    }
    setCode('');
    setError('');
    setOpen(true);
    return await new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const value = useMemo(() => ({ confirmAdminStep }), [confirmAdminStep]);

  return (
    <AdminTotpContext.Provider value={value}>
      {children}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => finish(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <AppText style={[styles.title, { color: colors.text }]}>{t('adminTotpTitle')}</AppText>
            <AppText style={[styles.lead, { color: colors.textMuted }]}>
              {secret ? t('adminTotpSecret') : t('adminTotpNeed')}
            </AppText>
            {secret ? <AppText selectable style={[styles.secret, { color: colors.text }]}>{secret}</AppText> : null}
            <AppTextInput
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder={t('adminTotpCode')}
            />
            {error ? <AppText style={[styles.err, { color: colors.danger }]}>{error}</AppText> : null}
            <TouchableOpacity onPress={() => void submit()} disabled={busy}>
              {busy ? <ActivityIndicator /> : <AppText style={{ color: colors.accent }}>{t('adminTotpConfirm')}</AppText>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => finish(false)}>
              <AppText style={{ color: colors.textMuted }}>{t('fundsConfirmCancel')}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AdminTotpContext.Provider>
  );
};

export function useAdminTotp(): AdminTotpValue {
  const ctx = useContext(AdminTotpContext);
  if (!ctx) throw new Error('useAdminTotp must be used inside AdminTotpHost');
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  lead: { fontSize: 14 },
  secret: { fontSize: 16, letterSpacing: 1 },
  err: { fontSize: 14 },
});
