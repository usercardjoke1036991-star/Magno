import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { TELEGRAM_BOT, NOTIFY_API } from '../constants/appLinks';
import { loadAppWallet } from '../services/appWallet';
import { signedAuthBody } from '../services/walletAuth';
import { readJsonLimited, safeJsonFetch } from '../utils/safeFetch';
import { openSafeUrl } from '../utils/safeOpenUrl';
import { AppIcon } from './icons';
import {
  isValidPhone,
  loadNotificationProfile,
  saveNotificationProfile,
  type NotificationPrefs,
  type NotificationProfile,
} from '../services/notificationProfile';
import { loadVerifiedEmail } from '../services/accountEmail';
import { AppText, AppTextInput } from './AppText';

interface NotificationChannelsProps {
  walletAddress: string;
}

export const NotificationChannels: React.FC<NotificationChannelsProps> = ({
  walletAddress,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [email, setEmail] = useState('');
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    debt: true,
    commission: false,
    signup: false,
    email: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotificationProfile()
      .then((profile) => {
        setPhone(profile.phone);
        setWhatsapp(profile.whatsapp);
        setTelegramUsername(profile.telegramUsername);
        setPrefs(profile.prefs);
      })
      .catch(() => {});
    loadVerifiedEmail().then(setEmail).catch(() => {});
  }, []);

  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!walletAddress) {
      Alert.alert(t('connect'), t('connectFirst'));
      return;
    }
    if (!isValidPhone(phone) || !isValidPhone(whatsapp)) {
      Alert.alert(t('error'), t('notificationInvalidPhone'));
      return;
    }
    setSaving(true);
    try {
      const profile: NotificationProfile = {
        phone,
        whatsapp,
        telegramUsername,
        prefs: { ...prefs, debt: true },
      };
      const saved = await saveNotificationProfile(walletAddress, profile);
      setPhone(saved.phone);
      setWhatsapp(saved.whatsapp);
      setTelegramUsername(saved.telegramUsername);
      Alert.alert(t('ready'), t('notificationSaved'));
    } catch {
      Alert.alert(t('error'), t('notificationSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleTelegram = async () => {
    const bot = TELEGRAM_BOT.replace(/[^a-zA-Z0-9_]/g, '');
    if (!bot) {
      Alert.alert(t('notificationTelegram'), t('notificationTelegramHint'));
      return;
    }
    if (!walletAddress) {
      Alert.alert(t('connect'), t('connectFirst'));
      return;
    }
    if (!NOTIFY_API) {
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
      const response = await safeJsonFetch(`${NOTIFY_API}/telegram/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auth),
      });
      if (!response.ok) {
        throw new Error('prepare');
      }
      const data = await readJsonLimited<{ code?: string }>(response);
      if (!data.code || !/^[a-z0-9]{8,12}$/.test(data.code)) throw new Error('code');
      const opened = await openSafeUrl(`https://t.me/${bot}?start=${data.code}`);
      if (!opened) throw new Error('open');
    } catch {
      Alert.alert(t('error'), t('notificationTelegramHint'));
    }
  };

  return (
    <View>
      <AppText style={[styles.lead, { color: colors.text }]}>{t('notificationLead')}</AppText>
      {email ? (
        <View style={[styles.alwaysOn, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelRow}>
              <AppIcon name="bell" size={16} color={colors.textMuted} />
              <AppText style={[styles.switchLabel, { color: colors.text }]}>{t('notificationEmail')}</AppText>
            </View>
            <Switch value={prefs.email} onValueChange={() => toggle('email')} />
          </View>
          <AppText selectable style={[styles.switchLabel, { color: colors.text }]}>{email}</AppText>
          <AppText style={[styles.alwaysHint, { color: colors.textMuted }]}>{t('notificationEmailHint')}</AppText>
        </View>
      ) : (
        <View style={[styles.alwaysOn, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <AppText style={[styles.switchLabel, { color: colors.text }]}>{t('notificationEmail')}</AppText>
          <AppText style={[styles.alwaysHint, { color: colors.textMuted }]}>{t('notificationEmailLink')}</AppText>
        </View>
      )}

      <View style={styles.labelRow}>
        <AppIcon name="phone" size={15} color={colors.textMuted} />
        <AppText style={[styles.label, { color: colors.textMuted }]}>{t('notificationPhone')}</AppText>
      </View>
      <AppTextInput
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+58412..."
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
      />

      <View style={styles.labelRow}>
        <AppIcon name="whatsapp" size={15} color={colors.textMuted} />
        <AppText style={[styles.label, { color: colors.textMuted }]}>{t('notificationWhatsApp')}</AppText>
      </View>
      <AppTextInput
        value={whatsapp}
        onChangeText={setWhatsapp}
        keyboardType="phone-pad"
        placeholder="+58412..."
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
      />

      <View style={styles.labelRow}>
        <AppIcon name="telegram" size={15} color={colors.textMuted} />
        <AppText style={[styles.label, { color: colors.textMuted }]}>{t('notificationTelegram')}</AppText>
      </View>
      <AppTextInput
        value={telegramUsername}
        onChangeText={setTelegramUsername}
        autoCapitalize="none"
        placeholder="@usuario"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
      />

      <TouchableOpacity style={[styles.secondary, { borderColor: colors.border }]} onPress={handleTelegram}>
        <View style={styles.btnRow}>
          <AppIcon name="telegram" size={16} color={colors.text} />
          <AppText style={[styles.secondaryText, { color: colors.text }]}>{t('notificationOpenTelegram')}</AppText>
        </View>
      </TouchableOpacity>

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
        <Switch value={prefs.commission} onValueChange={() => toggle('commission')} />
      </View>
      <View style={styles.switchRow}>
        <View style={styles.switchLabelRow}>
          <AppIcon name="people" size={16} color={colors.text} />
          <AppText style={[styles.switchLabel, { color: colors.text }]}>{t('notificationSignup')}</AppText>
        </View>
        <Switch value={prefs.signup} onValueChange={() => toggle('signup')} />
      </View>

      <TouchableOpacity
        style={[styles.save, { backgroundColor: colors.primary }, saving && styles.disabled]}
        onPress={handleSave}
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
    color: '#2d4a38',
    lineHeight: 18,
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#145c32',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  secondary: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
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
  },
  alwaysHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
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
    color: '#333',
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
