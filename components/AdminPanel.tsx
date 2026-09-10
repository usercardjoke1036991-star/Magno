import { isAddress } from 'ethers';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './icons';
import { formatAddress } from '../utils/formatters';
import type { OpenAdminProposal } from '../utils/adminProposal';
import type { ConfigurableStable } from '../constants/tokens';

interface AdminPanelProps {
  isOwner: boolean;
  isAdmin?: boolean;
  isLoading: boolean;
  paused?: boolean;
  tokenSymbol: string;
  tokenAddress?: string;
  adminRoster?: string[];
  requiredConfirmations?: number;
  proposalCount?: number;
  openProposal?: OpenAdminProposal | null;
  founderAddress?: string;
  extraStables?: ConfigurableStable[];
  onWithdrawFees: () => void;
  onWithdrawTokenFees: () => void;
  onPause?: () => void;
  onExecuteProposal?: (id: number) => void;
  onConfirmProposal?: (id: number) => void;
  onProposeAddAdmin?: (address: string) => void;
  onProposeRemoveAdmin?: (address: string) => void;
  onProposeFeeCollector?: (address: string) => void;
  onProposeConfirmations?: (required: number) => void;
  onProposeFundador?: (address: string) => void;
  onProposeOwner?: (address: string) => void;
  onProposeSetTokenConfig?: (token: string, feed: string, enabled: boolean) => void;
  onLiquidar?: (debtorAddress: string, tokenAddress: string) => void;
  onMarcarMoroso?: (debtorAddress: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOwner,
  isAdmin = false,
  isLoading,
  paused = false,
  tokenSymbol,
  tokenAddress = '',
  adminRoster = [],
  requiredConfirmations = 1,
  proposalCount = 0,
  openProposal = null,
  founderAddress = '',
  extraStables = [],
  onWithdrawFees,
  onWithdrawTokenFees,
  onPause,
  onExecuteProposal,
  onConfirmProposal,
  onProposeAddAdmin,
  onProposeRemoveAdmin,
  onProposeFeeCollector,
  onProposeConfirmations,
  onProposeFundador,
  onProposeOwner,
  onProposeSetTokenConfig,
  onLiquidar,
  onMarcarMoroso,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const [debtorDraft, setDebtorDraft] = useState('');
  if (!isOwner && !isAdmin) return null;

  const confirmToggle = (next: boolean, apply: (value: boolean) => void) => {
    Alert.alert(t('admin'), t('adminTimelockConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('ready'), onPress: () => apply(next) },
    ]);
  };

  const confirmPause = () => {
    Alert.alert(t('pauseProtocol'), t('pauseProtocolConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('pauseProtocol'), style: 'destructive', onPress: onPause },
    ]);
  };

  const confirmWithdrawBnb = () => {
    Alert.alert(t('withdrawBnb'), t('confirmWithdrawBnb'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('withdrawBnb'), style: 'destructive', onPress: onWithdrawFees },
    ]);
  };

  const confirmWithdrawToken = () => {
    Alert.alert(t('withdrawFees'), t('confirmWithdrawFees'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('withdrawFees'), style: 'destructive', onPress: onWithdrawTokenFees },
    ]);
  };

  const trimmed = draft.trim();

  const proposeWithAddress = (fn?: (address: string) => void) => {
    if (!fn) return;
    if (!isAddress(trimmed)) {
      Alert.alert(t('admin'), t('adminInvalidAddress'));
      return;
    }
    confirmToggle(true, () => {
      fn(trimmed);
      setDraft('');
    });
  };

  return (
    <View>
      <Text style={[styles.note, { color: colors.textMuted }]}>{t('adminLead')}</Text>
      {paused ? <Text style={[styles.paused, { color: colors.danger }]}>{t('protocolPaused')}</Text> : null}
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        {t('adminRoster', {
          count: adminRoster.length,
          confirms: requiredConfirmations,
          proposal: proposalCount,
        })}
      </Text>
      {adminRoster.map((item) => {
        const isFounderWallet = founderAddress && item.toLowerCase() === founderAddress.toLowerCase();
        return (
          <Text key={item} style={[styles.meta, { color: colors.text }]}>
            {formatAddress(item)} · {isFounderWallet ? t('adminRoleFounder') : t('adminRoleCofounder')}
          </Text>
        );
      })}

      <Text style={[styles.note, { color: colors.textMuted }]}>{t('adminAddFoundersLead')}</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={t('adminAddressPlaceholder')}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      {onProposeAddAdmin && adminRoster.length < 3 ? (
        <TouchableOpacity
          disabled={isLoading}
          onPress={() => proposeWithAddress(onProposeAddAdmin)}
          style={[styles.button, { backgroundColor: colors.chip }]}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>{t('adminAdd')}</Text>
        </TouchableOpacity>
      ) : null}
      {onProposeRemoveAdmin ? (
        <TouchableOpacity
          disabled={isLoading}
          onPress={() => proposeWithAddress(onProposeRemoveAdmin)}
          style={[styles.button, { backgroundColor: colors.chip }]}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>{t('adminRemove')}</Text>
        </TouchableOpacity>
      ) : null}
      {onProposeFundador ? (
        <TouchableOpacity
          disabled={isLoading}
          onPress={() => proposeWithAddress(onProposeFundador)}
          style={[styles.button, { backgroundColor: colors.chip }]}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>{t('adminSetFundador')}</Text>
        </TouchableOpacity>
      ) : null}
      {onProposeOwner ? (
        <TouchableOpacity
          disabled={isLoading}
          onPress={() => proposeWithAddress(onProposeOwner)}
          style={[styles.button, { backgroundColor: colors.chip }]}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>{t('adminSetOwner')}</Text>
        </TouchableOpacity>
      ) : null}
      {onProposeFeeCollector ? (
        <TouchableOpacity
          disabled={isLoading}
          onPress={() => proposeWithAddress(onProposeFeeCollector)}
          style={[styles.button, { backgroundColor: colors.chip }]}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>{t('adminFeeCollector')}</Text>
        </TouchableOpacity>
      ) : null}
      {onProposeConfirmations && adminRoster.length < 3 ? (
        <View style={styles.row}>
          <TouchableOpacity
            disabled={isLoading}
            onPress={() => confirmToggle(true, () => onProposeConfirmations(1))}
            style={[styles.button, styles.half, { backgroundColor: colors.chip }]}
          >
            <Text style={[styles.buttonText, { color: colors.text }]}>{t('adminConfirms1')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={isLoading}
            onPress={() => confirmToggle(true, () => onProposeConfirmations(2))}
            style={[styles.button, styles.half, { backgroundColor: colors.chip }]}
          >
            <Text style={[styles.buttonText, { color: colors.text }]}>{t('adminConfirms2')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {adminRoster.length >= 3 ? (
        <Text style={[styles.note, { color: colors.textMuted }]}>{t('adminTwoOfThree')}</Text>
      ) : null}
      {onProposeSetTokenConfig && extraStables.length ? (
        <>
          <Text style={[styles.note, { color: colors.textMuted }]}>{t('adminEnableTokenLead')}</Text>
          {extraStables.map((stable) => (
            <TouchableOpacity
              key={stable.address}
              disabled={isLoading}
              onPress={() =>
                confirmToggle(true, () => onProposeSetTokenConfig(stable.address, stable.feed, true))
              }
              style={[styles.button, { backgroundColor: colors.chip }]}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>
                {t('adminEnableToken', { symbol: stable.symbol })}
              </Text>
            </TouchableOpacity>
          ))}
        </>
      ) : null}
      {openProposal ? (
        <Text style={[styles.meta, { color: colors.text }]}>
          {t('adminProposalMeta', {
            id: openProposal.id,
            selector: openProposal.selector,
            confirms: openProposal.confirms,
            when:
              openProposal.eta * 1000 <= Date.now()
                ? t('adminProposalReady')
                : new Date(openProposal.eta * 1000).toLocaleString(),
          })}
        </Text>
      ) : (
        <Text style={[styles.meta, { color: colors.textMuted }]}>{t('adminProposalNone')}</Text>
      )}
      {isAdmin && onConfirmProposal && openProposal ? (
        <TouchableOpacity
          disabled={isLoading}
          onPress={() => onConfirmProposal(openProposal.id)}
          style={[styles.button, { backgroundColor: colors.chip }]}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>{t('confirmAdminProposal')}</Text>
        </TouchableOpacity>
      ) : null}
      {isAdmin && onExecuteProposal && openProposal ? (
        <TouchableOpacity
          disabled={isLoading}
          onPress={() => onExecuteProposal(openProposal.id)}
          style={[styles.button, { backgroundColor: colors.chip }]}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={[styles.buttonText, { color: colors.text }]}>{t('executeAdminProposal')}</Text>
          )}
        </TouchableOpacity>
      ) : null}
      {isAdmin && !paused && onPause ? (
        <TouchableOpacity disabled={isLoading} onPress={confirmPause} style={[styles.pause, { backgroundColor: '#B42318' }]}>
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={styles.btnRow}>
              <AppIcon name="warning" size={16} color="#fff" />
              <Text style={styles.buttonText}>{t('pauseProtocol')}</Text>
            </View>
          )}
        </TouchableOpacity>
      ) : null}
      {(onLiquidar || onMarcarMoroso) ? (
        <>
          <Text style={[styles.note, { color: colors.textMuted, marginTop: 16 }]}>{t('liquidarTitle')}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{t('liquidarLead')}</Text>
          <TextInput
            value={debtorDraft}
            onChangeText={setDebtorDraft}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('liquidarAddressPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          />
          {onMarcarMoroso ? (
            <TouchableOpacity
              disabled={isLoading}
              onPress={() => {
                const addr = debtorDraft.trim();
                if (!isAddress(addr)) { Alert.alert(t('admin'), t('adminInvalidAddress')); return; }
                Alert.alert(t('liquidarTitle'), t('marcarMorosoConfirm'), [
                  { text: t('cancel'), style: 'cancel' },
                  { text: t('ready'), onPress: () => { onMarcarMoroso(addr); setDebtorDraft(''); } },
                ]);
              }}
              style={[styles.button, { backgroundColor: colors.chip }]}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>{t('marcarMorosoBtn')}</Text>
            </TouchableOpacity>
          ) : null}
          {onLiquidar && tokenAddress ? (
            <TouchableOpacity
              disabled={isLoading}
              onPress={() => {
                const addr = debtorDraft.trim();
                if (!isAddress(addr)) { Alert.alert(t('admin'), t('adminInvalidAddress')); return; }
                Alert.alert(t('liquidarTitle'), t('liquidarConfirm'), [
                  { text: t('cancel'), style: 'cancel' },
                  { text: t('ready'), style: 'destructive', onPress: () => { onLiquidar(addr, tokenAddress); setDebtorDraft(''); } },
                ]);
              }}
              style={[styles.button, { backgroundColor: '#B42318' }]}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={styles.btnRow}>
                  <AppIcon name="warning" size={16} color="#fff" />
                  <Text style={styles.buttonText}>{t('liquidarBtn')} ({tokenSymbol})</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}
      {isOwner ? (
        <>
          <TouchableOpacity disabled={isLoading} onPress={confirmWithdrawBnb} style={[styles.button, { backgroundColor: colors.primary }]}>
            {isLoading ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <View style={styles.btnRow}>
                <AppIcon name="withdraw" size={16} color={colors.onPrimary} />
                <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('withdrawBnb')}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity disabled={isLoading} onPress={confirmWithdrawToken} style={[styles.button, { backgroundColor: colors.primary }]}>
            {isLoading ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <View style={styles.btnRow}>
                <AppIcon name="withdraw" size={16} color={colors.onPrimary} />
                <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
                  {t('withdrawFees')} ({tokenSymbol})
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  note: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  meta: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginTop: 8,
    marginBottom: 8,
  },
  paused: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 10,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  half: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pause: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});



