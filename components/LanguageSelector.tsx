import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LANGUAGES } from '../i18n/languages';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './icons';

export const LanguageSelector: React.FC<{ hideLabel?: boolean }> = ({ hideLabel = false }) => {
  const { lang, setLang, t, rtl } = useI18n();
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      {!hideLabel && (
        <Text style={[styles.label, rtl && styles.rtlText, { color: colors.textMuted }]}>{t('language')}</Text>
      )}
      {LANGUAGES.map((item) => {
        const active = item.code === lang;
        return (
          <TouchableOpacity
            key={item.code}
            style={[
              styles.option,
              {
                backgroundColor: colors.card,
                borderColor: active ? colors.text : colors.border,
                flexDirection: rtl ? 'row-reverse' : 'row',
              },
            ]}
            onPress={() => setLang(item.code)}
          >
            <Text style={styles.flag}>{item.flag}</Text>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionText, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{item.native}</Text>
              <Text style={[styles.optionSub, { color: colors.textMuted, textAlign: rtl ? 'right' : 'left' }]}>{item.english}</Text>
            </View>
            {active ? <AppIcon name="check" size={16} color={colors.text} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
    alignSelf: 'stretch',
  },
  label: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  flag: {
    fontSize: 22,
    marginRight: 10,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  optionSub: {
    fontSize: 11,
    marginTop: 1,
  },
});
