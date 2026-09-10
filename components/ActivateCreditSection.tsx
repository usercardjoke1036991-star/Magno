import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './icons';

interface ActivateCreditSectionProps {
  isRegistered: boolean;
  onRegister: (padre?: string) => void;
  isLoading: boolean;
  initialInviteCode?: string;
  paused?: boolean;
}

export const ActivateCreditSection: React.FC<ActivateCreditSectionProps> = ({
  isRegistered,
  onRegister,
  isLoading,
  initialInviteCode = '',
  paused = false,
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const [padre, setPadre] = useState(initialInviteCode);
  const { t } = useI18n();
  const { colors } = useTheme();

  useEffect(() => {
    if (initialInviteCode) {
      setPadre(initialInviteCode);
    }
  }, [initialInviteCode]);

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <AppIcon name="id" size={16} color={colors.textMuted} />
          <Text style={[styles.title, { color: colors.text }]}>{t('howItWorks')}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowInfo((value) => !value)}
          style={[styles.infoButton, { backgroundColor: colors.chip }]}
        >
          <AppIcon name="info" size={15} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.cycle}>
        {(['jobCycle1', 'jobCycle2', 'jobCycle3', 'jobCycle4', 'jobCycle5'] as const).map((key, index) => (
          <View key={key} style={styles.cycleRow}>
            <Text style={[styles.cycleNum, { color: colors.primary }]}>{index + 1}</Text>
            <Text style={[styles.cycleText, { color: colors.text }]}>{t(key)}</Text>
          </View>
        ))}
      </View>

      {showInfo && (
        <View style={[styles.identityInfo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.identityNote, { color: colors.textMuted }]}>
            {t('howItWorksBody')}
          </Text>
        </View>
      )}

      {isRegistered ? (
        <View style={[styles.registeredBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppIcon name="check" size={16} color={colors.success} />
          <Text style={[styles.registeredText, { color: colors.text }]}>{t('readyToBorrow')}</Text>
        </View>
      ) : (
        <View>
          <TextInput
            value={padre}
            onChangeText={setPadre}
            placeholder={t('invitePlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[
              styles.referralInput,
              { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },
            ]}
          />
          <TouchableOpacity
            disabled={isLoading || paused}
            onPress={() => onRegister(padre.trim() || undefined)}
            style={[
              styles.registerButton,
              { backgroundColor: colors.connect },
              (isLoading || paused) && { backgroundColor: colors.chip },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnRow}>
                <AppIcon name="user" size={16} color={isLoading || paused ? colors.textMuted : '#fff'} />
                <Text style={[styles.registerButtonText, (isLoading || paused) && { color: colors.textMuted }]}>
                  {paused ? t('actionPaused') : t('activateCredit')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.securityNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppIcon name="shield" size={15} color={colors.textMuted} />
        <Text style={[styles.securityNoteText, { color: colors.textMuted }]}>
          {t('securityNote')}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  identityInfo: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  identityNote: {
    fontSize: 13,
    lineHeight: 19,
  },
  cycle: {
    gap: 8,
    marginBottom: 14,
  },
  cycleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cycleNum: {
    fontSize: 14,
    fontWeight: '700',
    width: 16,
    marginTop: 1,
  },
  cycleText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  registeredBadge: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  registeredText: {
    fontSize: 15,
    fontWeight: '500',
  },
  referralInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 13,
  },
  registerButton: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  securityNote: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  securityNoteText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
});
