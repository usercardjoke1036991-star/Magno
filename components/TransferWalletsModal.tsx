import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseUnits } from 'ethers';
import { COMPATIBLE_WALLETS } from '../constants/compatibleWallets';
import { enviarBnb, enviarToken, loadAppWallet } from '../services/appWallet';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { useFundsConfirm } from './FundsConfirmHost';
import { parsePositiveDecimal } from '../utils/formatters';
import { isHexAddress } from '../utils/sanitize';
import { humanizeTxError } from '../utils/txErrors';
import { WalletMark } from './WalletMark';
import { BrandLogo } from './BrandLogo';
import type { Token } from '../constants/tokens';

interface TransferWalletsModalProps {
  visible: boolean;
  mode: 'in' | 'out';
  walletAddress: string;
  tokenBalance: string;
  bnbBalance: string;
  selectedToken: Token;
  isLoading: boolean;
  onClose: () => void;
  onSent: () => void;
}

export const TransferWalletsModal: React.FC<TransferWalletsModalProps> = ({
  visible,
  mode,
  walletAddress,
  tokenBalance,
  bnbBalance,
  selectedToken,
  isLoading,
  onClose,
  onSent,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { confirmFunds } = useFundsConfirm();
  const [walletId, setWalletId] = useState<string | null>(null);
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState<'token' | 'bnb'>('token');
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => COMPATIBLE_WALLETS.find((item) => item.id === walletId) || null,
    [walletId]
  );

  const close = () => {
    setWalletId(null);
    setDestination('');
    setAmount('');
    onClose();
  };

  const sendOut = async () => {
    const to = destination.trim();
    if (!isHexAddress(to)) {
      Alert.alert(t('error'), t('appWalletBadAddress'));
      return;
    }
    const parsed = parsePositiveDecimal(amount);
    if (!parsed) {
      Alert.alert(t('amount'), t('invalidAmount'));
      return;
    }
    const available = Number(asset === 'bnb' ? bnbBalance : tokenBalance);
    if (Number(parsed) > available) {
      Alert.alert(t('amount'), t('amountExceedsBalance'));
      return;
    }
    const signer = await loadAppWallet();
    if (!signer) {
      Alert.alert(t('error'), t('appWalletNotReady'));
      return;
    }
    if (!(await confirmFunds())) return;
    setBusy(true);
    try {
      if (asset === 'bnb') {
        await enviarBnb(signer, to, parseUnits(parsed, 18).toString());
      } else {
        await enviarToken(
          signer,
          selectedToken.address,
          to,
          parseUnits(parsed, selectedToken.decimals).toString()
        );
      }
      Alert.alert(t('ready'), t('appWalletSent'));
      setAmount('');
      onSent();
      close();
    } catch (error) {
      Alert.alert(t('error'), humanizeTxError(error));
    } finally {
      setBusy(false);
    }
  };

  const blocked = busy || isLoading;
  const title = mode === 'in' ? t('appWalletInTitle') : t('appWalletSendTitle');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={selected ? () => setWalletId(null) : close}
            accessibilityRole="button"
          >
            <Text style={[styles.back, { color: colors.primary }]}>{t('settingsBack')}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <View style={styles.spacer} />
        </View>
        <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={styles.body}>
          {!selected ? (
            <>
              <Text style={[styles.lead, { color: colors.textMuted }]}>{t('appWalletPickLead')}</Text>
              <View style={styles.grid}>
                {COMPATIBLE_WALLETS.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setWalletId(item.id)}
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={item.name}
                  >
                    <WalletMark wallet={item} size={48} />
                    <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <View>
              <View style={styles.chosen}>
                <WalletMark wallet={selected} size={40} />
                <Text style={[styles.chosenName, { color: colors.text }]}>{selected.name}</Text>
              </View>
              {mode === 'in' ? (
                <>
                  <View style={styles.chosen}>
                    <BrandLogo size={40} />
                    <Text style={[styles.chosenName, { color: colors.text }]}>{t('appWalletLabel')}</Text>
                  </View>
                  <Text style={[styles.lead, { color: colors.textMuted }]}>
                    {t('appWalletInLead', { wallet: selected.name })}
                  </Text>
                  <Text selectable style={[styles.address, { color: colors.text, backgroundColor: colors.surface }]}>
                    {walletAddress}
                  </Text>
                  <TouchableOpacity
                    style={[styles.send, { backgroundColor: colors.connect, marginTop: 12 }]}
                    onPress={() => Share.share({ message: walletAddress }).catch(() => {})}
                  >
                    <Text style={styles.sendText}>{t('appWalletShare')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={[styles.lead, { color: colors.textMuted }]}>
                    {t('appWalletSendLead', { wallet: selected.name })}
                  </Text>
                  <TextInput
                    value={destination}
                    onChangeText={setDestination}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={t('appWalletDestination', { wallet: selected.name })}
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                  />
                  <View style={styles.row}>
                    <TouchableOpacity
                      onPress={() => setAsset('token')}
                      style={[
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        asset === 'token' && { borderColor: colors.primary, backgroundColor: colors.chip },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: colors.text }]}>{selectedToken.symbol}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setAsset('bnb')}
                      style={[
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        asset === 'bnb' && { borderColor: colors.primary, backgroundColor: colors.chip },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: colors.text }]}>BNB</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder={asset === 'bnb' ? '0.001' : tokenBalance}
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                  />
                  <TouchableOpacity
                    disabled={blocked || !amount}
                    onPress={sendOut}
                    style={[styles.send, { backgroundColor: colors.primary }, (blocked || !amount) && { backgroundColor: colors.chip }]}
                  >
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>{t('appWalletSend')}</Text>}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
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
    marginBottom: 12,
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
  body: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  lead: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '47.5%',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 10,
  },
  cardName: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  chosen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  chosenName: {
    fontSize: 18,
    fontWeight: '700',
  },
  address: {
    fontFamily: 'monospace',
    fontSize: 13,
    borderRadius: 12,
    padding: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  send: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  sendText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
