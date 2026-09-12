import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from './AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LANGUAGES } from '../i18n/languages';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { APP_DISPLAY_NAME } from '../constants/brand';
import { BrandLogo } from './BrandLogo';
import { AppIcon } from './icons';

export const LanguageWelcome: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { langReady, langChosen, chooseLang, setLang, lang, t, rtl } = useI18n();
  const { colors } = useTheme();
  const align = rtl ? ('right' as const) : ('left' as const);

  if (!langReady) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg, justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (langChosen) {
    return <>{children}</>;
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <BrandLogo size={72} style={styles.logo} />
        <AppText style={[styles.brand, { color: colors.text, textAlign: align }]}>{APP_DISPLAY_NAME}</AppText>
        <AppText style={[styles.title, { color: colors.text, textAlign: align }]}>{t('chooseLanguage')}</AppText>
        <AppText style={[styles.lead, { color: colors.textMuted, textAlign: align }]}>{t('chooseLanguageLead')}</AppText>
        <AppText style={[styles.hint, { color: colors.textMuted, textAlign: align }]}>{t('chooseLanguageHint')}</AppText>
        {LANGUAGES.map((item) => {
          const active = item.code === lang;
          return (
            <TouchableOpacity
              key={item.code}
              onPress={() => setLang(item.code)}
              style={[
                styles.option,
                {
                  backgroundColor: colors.card,
                  borderColor: active ? colors.text : colors.border,
                  flexDirection: rtl ? 'row-reverse' : 'row',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.native}
            >
              <AppText style={styles.flag}>{item.flag}</AppText>
              <View style={styles.optionTextWrap}>
                <AppText style={[styles.optionText, { color: colors.text, textAlign: align }]}>{item.native}</AppText>
                <AppText style={[styles.optionSub, { color: colors.textMuted, textAlign: align }]}>{item.english}</AppText>
              </View>
              {active ? <AppIcon name="check" size={16} color={colors.text} /> : null}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => chooseLang(lang)}
          style={[styles.continue, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
        >
          <AppText style={[styles.continueText, { color: colors.onPrimary }]}>{t('ready')}</AppText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 40,
  },
  logo: {
    marginBottom: 16,
  },
  brand: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  flag: {
    fontSize: 22,
    marginRight: 10,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionSub: {
    fontSize: 12,
    marginTop: 1,
  },
  continue: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
