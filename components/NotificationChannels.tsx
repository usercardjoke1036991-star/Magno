import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { loadAppWallet } from '../services/appWallet';
import { notifyApiConfigured, notifyJsonBody } from '../services/notifyClient';
import { resolveTelegramBot } from '../services/telegramBot';
import { signedAuthBody } from '../services/walletAuth';
import { openSafeUrl } from '../utils/safeOpenUrl';
import { AppIcon } from './icons';
import {
  loadNotificationProfile,
  saveNotificationProfile,
  type NotificationPrefs,
  type NotificationProfile,
} from '../services/notificationProfile';
import { AppText } from './AppText';

interface NotificationChannelsProps {
  walletAddress: string;
}

export const NotificationChannels: React.FC<NotificationChannelsProps> = ({
  walletAddress,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    debt: true,
    commission: false,
    signup: false,
    email: false,
  });
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [botName, setBotName] = useState('');

  React.useEffect(() => {
    loadNotificationProfile()
      .then((profile) => {
        setPrefs({ ...profile.prefs, debt: true, email: false });
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  React.useEffect(() => {
    let live = true;
    resolveTelegramBot()
      .then((bot) => {
        if (live) setBotName(bot);
      })
      .catch(() => {
        if (live) setBotName('');
      });
    return () => {
      live = false;
    };
  }, []);

  const toggle = (key: keyof NotificationPrefs) => {
    if (key === 'email' || key === 'debt') return;
    setPrefs((prev) => ({ ...prev, [key]: !prev[key], email: false, debt: true }));
  };

  const persistPrefs = async (nextPrefs: NotificationPrefs) => {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('connectFirst'));
      return;
    }
    const profile: NotificationProfile = {
      phone: '',
      whatsapp: '',
      telegramUsername: '',
      prefs: { ...nextPrefs, debt: true, email: false },
    };
    const saved = await saveNotificationProfile(walletAddress, profile);
    setPrefs({ ...saved.prefs, debt: true, email: false });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistPrefs(prefs);
      Alert.alert(t('ready'), t('notificationSaved'));
    } catch {
      Alert.alert(t('error'), t('notificationSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleTelegram = async () => {
    const bot = botName || (await resolveTelegramBot());
    if (!bot) {
      Alert.alert(t('notificationTelegram'), t('notificationTelegramHint'));
      return;
    }
    if (!walletAddress) {
      Alert.alert(t('connect'), t('connectFirst'));
      return;
    }
    if (!notifyApiConfigured()) {
      Alert.alert(t('notificationTelegram'), t('telegramNeedApi'));
      return;
    }
    try {
      const signer = await loadAppWallet();
      if (!signer) {
        Alert.alert(t('connect'), t('appWalletNotReady'));
        return;
      }
      const auth = await signedAuthBody(signer, walletAddress, 'vincular-avisos');
      const { response, body } = await notifyJsonBody<{ code?: string }>('/telegram/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auth),
      });
      if (!response.ok) {
        throw new Error('prepare');
      }
      if (!body.code || !/^[a-z0-9]{8,12}$/.test(body.code)) throw new Error('code');
      const opened = await openSafeUrl(`https://t.me/${bot}?start=${body.code}`);
      if (!opened) throw new Error('open');
    } catch {
      Alert.alert(t('error'), t('notificationTelegramHint'));
    }
  };

  return (
    <View>
      <AppText style={[styles.lead, { color: colors.text }]}>{t('notificationLead')}</AppText>

      <TouchableOpacity style={[styles.secondary, { borderColor: colors.border }]} onPress={handleTelegram}>
        <View style={styles.btnRow}>
          <AppIcon name="telegram" size={16} color={colors.text} />
          <AppText style={[styles.secondaryText, { color: colors.text }]}>{t('notificationOpenTelegram')}</AppText>
        </View>
      </TouchableOpacity>
      <AppText style={[styles.alwaysHint, { color: colors.textMuted }]}>{t('notificationTelegramHint')}</AppText>

      <View style={[styles.alwaysOn, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.switchLabelRow}>
          <AppIcon name="bell" size={16} color={colors.textMuted} />
          <AppText style={[styles.switchLabel, { color: colors.text }]}>{t('notificationDebt')}</AppText>
        </View>
        <AppText style={[styles.alwaysHint, { color: colors.textMuted }]}>{t('notificationDebtAlways')}</AppText>
      </View>

      <AppText style={[styles.optionalTitle, { color: colors.textMuted }]}>{t('notificationOptional')}</AppText>
      <View style={styles.switchRow}>
        <View style={styles.switchLabelRow}>
          <AppIcon name="pay" size={16} color={colors.text} />
          <AppText style={[styles.switchLabel, { color: colors.text }]}>{t('notificationCommission')}</AppText>
        </View>
        <Switch value={prefs.commission} onValueChange={() => toggle('commission')} disabled={!ready} />
      </View>
      <View style={styles.switchRow}>
        <View style={styles.switchLabelRow}>
          <AppIcon name="people" size={16} color={colors.text} />
          <AppText style={[styles.switchLabel, { color: colors.text }]}>{t('notificationSignup')}</AppText>
        </View>
        <Switch value={prefs.signup} onValueChange={() => toggle('signup')} disabled={!ready} />
      </View>

      <TouchableOpacity
        style={[styles.save, { backgroundColor: colors.primary }, saving && styles.disabled]}
        onPress={() => void handleSave()}
        disabled={saving}
      >
        <View style={styles.btnRow}>
          <AppIcon name="save" size={16} color={colors.onPrimary} />
          <AppText style={[styles.saveText, { color: colors.onPrimary }]}>{t('notificationSave')}</AppText>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  lead: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondary: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryText: {
    fontWeight: '500',
    fontSize: 13,
  },
  alwaysOn: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    marginTop: 8,
  },
  alwaysHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  optionalTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  switchLabel: {
    flex: 1,
    fontSize: 12,
    paddingRight: 8,
  },
  switchLabelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  save: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveText: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
});
