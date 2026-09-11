import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { getContractAddress } from '../constants/contractConfig';
import { isContractConfigured } from '../constants/rpcConfig';
import { AppIcon } from './icons';
import { AppSubsection } from './AppSection';

interface PoolSupportSectionProps {
  isLoading: boolean;
  tokenSymbol: string;
  tokenSupported: boolean;
  poolBalance: string;
  poolOutstanding?: string;
  poolCash?: string;
  walletConnected: boolean;
  paused?: boolean;
  onDepositPool: (amount: string) => void;
}

export const PoolSupportSection: React.FC<PoolSupportSectionProps> = ({
  isLoading,
  tokenSymbol,
  tokenSupported,
  poolBalance,
  poolOutstanding,
  poolCash,
  walletConnected,
  paused = false,
  onDepositPool,
}) => {
  const [depositAmount, setDepositAmount] = useState('10');
  const { t } = useI18n();
  // Sin retiro ni posición LP: el aporte queda en el contrato para prestar.
  const { colors } = useTheme();
  const contractReady = isContractConfigured();
  const blocked = isLoading || !walletConnected || !tokenSupported || paused || !contractReady;

  return (
    <View style={styles.stack}>
      <AppSubsection title={t('subsectionPoolInfo')} defaultOpen={false} icon="info">
        <Text style={[styles.lead, { color: colors.text }]}>{t('poolPublicLead')}</Text>
        <Text style={[styles.destination, { color: colors.textMuted, backgroundColor: colors.surface, borderColor: colors.border }]}>
          {t('poolDestination', { amount: `${poolBalance} ${tokenSymbol}` })}
        </Text>
        {poolCash && poolOutstanding ? (
          <Text style={[styles.locked, { color: colors.textMuted }]}>
            {t('poolNavExplain', { cash: `${poolCash} ${tokenSymbol}`, loans: `${poolOutstanding} ${tokenSymbol}` })}
          </Text>
        ) : null}
        <Text style={[styles.locked, { color: colors.textMuted }]}>{t('poolLockedNote')}</Text>
        {contractReady ? (
          <>
            <Text style={[styles.label, { color: colors.primary }]}>{t('poolContractLabel')}</Text>
            <Text selectable style={[styles.address, { color: colors.primary, backgroundColor: colors.surface }]}>
              {getContractAddress()}
            </Text>
          </>
        ) : (
          <Text style={[styles.warn, { color: colors.warnText }]}>{t('liveCreditNotReady')}</Text>
        )}
      </AppSubsection>
      <AppSubsection title={t('subsectionPoolDeposit')} defaultOpen icon="deposit">
        {!walletConnected && <Text style={[styles.warn, { color: colors.warnText }]}>{t('connectFirst')}</Text>}
        {!tokenSupported && walletConnected && (
          <Text style={[styles.warn, { color: colors.warnText }]}>{t('tokenNotEnabled')}</Text>
        )}
        <Text style={[styles.label, { color: colors.primary }]}>{t('amountDeposit')} ({tokenSymbol})</Text>
        <TextInput
          value={depositAmount}
          onChangeText={setDepositAmount}
          keyboardType="decimal-pad"
          placeholder="10"
          editable={!blocked}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
              color: colors.text,
            },
          ]}
        />
        <TouchableOpacity
          disabled={blocked}
          onPress={() => onDepositPool(depositAmount)}
          style={[styles.button, { backgroundColor: colors.primary }, blocked && { backgroundColor: colors.chip }]}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={styles.buttonRow}>
              <AppIcon name="deposit" size={18} color="#fff" />
              <Text style={styles.buttonText}>{t('depositPool')}</Text>
            </View>
          )}
        </TouchableOpacity>
      </AppSubsection>
    </View>
  );
};

const styles = StyleSheet.create({
  stack: {
    gap: 10,
  },
  lead: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
  destination: {
    fontSize: 12,
    lineHeight: 18,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  locked: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  address: {
    fontFamily: 'monospace',
    fontSize: 11,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  warn: {
    fontSize: 12,
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disabled: {
    backgroundColor: '#9e9e9e',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
