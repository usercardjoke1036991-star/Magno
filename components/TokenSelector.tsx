import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Token } from '../hooks/useWeb3Balances';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { TokenLogo } from './icons';
import { AppText } from './AppText';

interface TokenSelectorProps {
  tokens: Token[];
  selectedToken: Token;
  onSelectToken: (token: Token) => void;
}

export const TokenSelector: React.FC<TokenSelectorProps> = ({
  tokens,
  selectedToken,
  onSelectToken,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <View style={styles.tokenSelector}>
      <View style={styles.titleRow}>
        <TokenLogo symbol={selectedToken.symbol} size={18} />
        <AppText style={[styles.sectionTitle, { color: colors.text }]}>{t('selectToken')}</AppText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {tokens.map((token) => (
          <TouchableOpacity
            key={token.address}
            style={[
              styles.tokenButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selectedToken.symbol === token.symbol && {
                borderColor: colors.text,
                backgroundColor: colors.card,
              },
            ]}
            onPress={() => onSelectToken(token)}
          >
            <TokenLogo symbol={token.symbol} size={18} />
            <AppText
              style={[
                styles.tokenButtonText,
                { color: selectedToken.symbol === token.symbol ? colors.text : colors.textMuted },
              ]}
            >
              {token.symbol}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  tokenSelector: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tokenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    gap: 8,
  },
  tokenButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
