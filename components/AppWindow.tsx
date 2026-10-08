import React from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { AppText } from './AppText';

interface AppWindowProps {
  visible: boolean;
  title: string;
  lead?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const AppWindow: React.FC<AppWindowProps> = ({ visible, title, lead, onClose, children }) => {
  const { t } = useI18n();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('settingsBack')}>
            <AppText style={[styles.back, { color: colors.primary }]}>{t('settingsBack')}</AppText>
          </TouchableOpacity>
          <AppText style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </AppText>
          <View style={styles.spacer} />
        </View>
        {lead ? <AppText style={[styles.lead, { color: colors.textMuted }]}>{lead}</AppText> : null}
        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 8,
  },
  back: {
    fontSize: 15,
    fontWeight: '600',
    width: 72,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
  spacer: {
    width: 72,
  },
  lead: {
    paddingHorizontal: 20,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 96,
    gap: 14,
  },
});
