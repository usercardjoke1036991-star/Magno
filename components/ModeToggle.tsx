import React from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { useAppMode } from '../wallet/AppModeContext';
import { isStoreProduction, type AppMode } from '../constants/rpcConfig';
import { AppText } from './AppText';

export const ModeToggle: React.FC = () => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { mode, setMode } = useAppMode();
  const storeBuild = isStoreProduction();

  const choose = (next: AppMode) => {
    if (storeBuild || next === mode) return;
    Alert.alert(t('appModeTitle'), next === 'demo' ? t('appModeSwitchDemo') : t('appModeSwitchLive'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('ready'),
        onPress: () => {
          void setMode(next).then((ok) => {
            if (!ok) {
              Alert.alert(t('error'), next === 'live' ? t('appModeNeedLive') : t('appModeNeedDemo'));
            }
          });
        },
      },
    ]);
  };

  return (
    <View>
      <AppText style={[styles.lead, { color: colors.textMuted }]}>
        {storeBuild ? t('appModeStoreLocked') : t('appModeLead')}
      </AppText>
      {storeBuild ? null : (
        <View style={styles.row}>
          <TouchableOpacity
            onPress={() => choose('demo')}
            style={[
              styles.chip,
              { borderColor: colors.border, backgroundColor: mode === 'demo' ? colors.primary : colors.surface },
            ]}
          >
            <AppText style={[styles.chipText, { color: mode === 'demo' ? colors.onPrimary : colors.text }]}>
              {t('appModeDemo')}
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => choose('live')}
            style={[
              styles.chip,
              { borderColor: colors.border, backgroundColor: mode === 'live' ? colors.primary : colors.surface },
            ]}
          >
            <AppText style={[styles.chipText, { color: mode === 'live' ? colors.onPrimary : colors.text }]}>
              {t('appModeLive')}
            </AppText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  lead: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  chipText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
