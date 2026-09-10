import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import type { ThemePreference } from '../theme/palette';
import { AppIcon } from './icons';

export const ThemeToggle: React.FC<{ hideLabel?: boolean }> = ({ hideLabel = false }) => {
  const { t } = useI18n();
  const { preference, setTheme, colors } = useTheme();

  const options: { value: ThemePreference; label: string; icon: 'sun' | 'moon' | 'gear' }[] = [
    { value: 'system', label: t('themeSystem'), icon: 'gear' },
    { value: 'light', label: t('themeLight'), icon: 'sun' },
    { value: 'dark', label: t('themeDark'), icon: 'moon' },
  ];

  return (
    <View style={styles.wrap}>
      {!hideLabel && <Text style={[styles.label, { color: colors.textMuted }]}>{t('appearance')}</Text>}
      <View style={[styles.track, { backgroundColor: colors.chip, borderColor: colors.border }]}>
        {options.map((item) => {
          const active = preference === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              style={[styles.option, active && { backgroundColor: colors.card }]}
              onPress={() => setTheme(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <AppIcon name={item.icon} size={14} color={active ? colors.text : colors.textMuted} />
              <Text style={[styles.optionText, { color: active ? colors.text : colors.textMuted }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  track: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  option: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
