import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { LanguageSelector } from './LanguageSelector';
import { ThemeToggle } from './ThemeToggle';
import { ModeToggle } from './ModeToggle';
import { ProfileSettings } from './ProfileSettings';
import { SecuritySettings } from './SecuritySettings';
import { AdminAccess } from './AdminAccess';
import { ProfileAvatar } from './ProfileAvatar';
import { AppIcon } from './icons';
import { BrandLogo } from './BrandLogo';
import { useUserProfile } from '../profile/ProfileContext';
import { useWalletLevel } from '../hooks/useWalletLevel';
import { isPhraseBackedUp } from '../services/appWallet';
import { useAccount } from '@reown/appkit-react-native';
import { useAppMode } from '../wallet/AppModeContext';
import { useWeb3Balances } from '../hooks/useWeb3Balances';
import { getSupportedTokens } from '../constants/tokens';
import type { TranslationKey } from '../i18n/translations';
import { AppText } from './AppText';

type Panel = 'home' | 'security' | 'profile' | 'appearance' | 'language' | 'mode' | 'admin';

export const SettingsButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>('home');
  const [phraseWarning, setPhraseWarning] = useState(false);
  const { t } = useI18n();
  const { colors } = useTheme();
  const { profile, walletAddress } = useUserProfile();
  const level = useWalletLevel(walletAddress);
  const { mode } = useAppMode();
  const primaryToken = useMemo(() => getSupportedTokens()[0], [mode]);
  const { address: adminAddress, isConnected: adminConnected } = useAccount();
  const { userInfo: adminInfo } = useWeb3Balances(
    adminConnected && adminAddress ? adminAddress.toLowerCase() : '',
    primaryToken
  );
  const founderReady = Boolean(adminConnected && (adminInfo.isAdmin || adminInfo.isOwner));

  useEffect(() => {
    isPhraseBackedUp()
      .then((backed) => setPhraseWarning(!backed))
      .catch(() => {});
  }, [open]); // re-check when settings modal closes

  const close = () => {
    setOpen(false);
    setPanel('home');
  };

  const titles: Record<Panel, TranslationKey> = {
    home: 'settings',
    security: 'securityTitle',
    profile: 'profile',
    appearance: 'appearance',
    language: 'language',
    mode: 'appModeTitle',
    admin: 'settingsAdminTitle',
  };

  const MenuRow = ({
    icon,
    label,
    onPress,
  }: {
    icon: 'shield' | 'user' | 'sun' | 'globe' | 'bank';
    label: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.menuRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <AppIcon name={icon} size={18} color={colors.primary} />
      <AppText style={[styles.menuLabel, { color: colors.text }]}>{label}</AppText>
      <AppText style={[styles.chevron, { color: colors.textMuted }]}>›</AppText>
    </TouchableOpacity>
  );

  return (
    <>
      <View>
        <ProfileAvatar
          profile={profile}
          wallet={walletAddress}
          size={40}
          badge
          level={walletAddress ? level : undefined}
          showRankLabel={false}
          onPress={() => setOpen(true)}
          accessibilityLabel={t('settings')}
        />
        {phraseWarning && (
          <View
            style={[styles.phraseBadge, { backgroundColor: colors.danger }]}
            accessibilityLabel={t('securityPhraseTodo')}
          />
        )}
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <View style={[styles.frame, { backgroundColor: colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t('closeSettings')} />
          <View style={[styles.sheet, { backgroundColor: colors.modalBg }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeader}>
              {panel === 'home' ? (
                <BrandLogo size={32} />
              ) : (
                <TouchableOpacity onPress={() => setPanel('home')} accessibilityRole="button" accessibilityLabel={t('settingsBack')}>
                  <AppText style={[styles.back, { color: colors.primary }]}>{t('settingsBack')}</AppText>
                </TouchableOpacity>
              )}
              <View style={styles.sheetTitles}>
                <AppText style={[styles.sheetTitle, { color: colors.text }]}>{t(titles[panel])}</AppText>
                {panel === 'home' ? (
                  <AppText style={[styles.sheetLead, { color: colors.textMuted }]}>{t('settingsLead')}</AppText>
                ) : null}
              </View>
              <TouchableOpacity onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel={t('closeSettings')}>
                <AppText style={[styles.closeText, { color: colors.textMuted }]}>×</AppText>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
              {panel === 'home' ? (
                <View>
                  <MenuRow icon="shield" label={t('securityTitle')} onPress={() => setPanel('security')} />
                  <MenuRow icon="user" label={t('profile')} onPress={() => setPanel('profile')} />
                  <MenuRow icon="sun" label={t('appearance')} onPress={() => setPanel('appearance')} />
                  <MenuRow icon="globe" label={t('language')} onPress={() => setPanel('language')} />
                  <MenuRow icon="bank" label={t('appModeTitle')} onPress={() => setPanel('mode')} />
                  {founderReady ? (
                    <MenuRow icon="shield" label={t('settingsAdminTitle')} onPress={() => setPanel('admin')} />
                  ) : (
                    <TouchableOpacity
                      onPress={() => setPanel('admin')}
                      accessibilityRole="button"
                      accessibilityLabel={t('settingsAdminConnect')}
                    >
                      <AppText style={[styles.adminLink, { color: colors.textMuted }]}>{t('settingsAdminConnect')}</AppText>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}
              {panel === 'security' ? <SecuritySettings /> : null}
              {panel === 'profile' ? <ProfileSettings /> : null}
              {panel === 'appearance' ? <ThemeToggle hideLabel /> : null}
              {panel === 'language' ? <LanguageSelector hideLabel /> : null}
              {panel === 'mode' ? <ModeToggle /> : null}
              {panel === 'admin' ? <AdminAccess /> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    zIndex: 2,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  sheetTitles: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  sheetLead: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  back: {
    fontSize: 15,
    fontWeight: '600',
  },
  close: {
    paddingHorizontal: 6,
  },
  closeText: {
    fontSize: 28,
    lineHeight: 30,
  },
  menuRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 22,
    lineHeight: 24,
  },
  phraseBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  adminLink: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
});
