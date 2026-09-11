import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './icons';
import { claimUsername, checkUsernameAvailable } from '../services/accountUsername';
import { isValidUsername, normalizeUsername } from '../utils/usernamePolicy';
import { isValidLegalName, normalizeLegalName } from '../services/kycDeclaration';
import { notifyApiConfigured } from '../services/phoneOtp';

interface UsernameSectionProps {
  walletAddress: string;
  claimedUsername: string;
  legalName?: string;
  includeLegalName?: boolean;
  onClaimed: (username: string, legalName?: string) => void;
}

export const UsernameSection: React.FC<UsernameSectionProps> = ({
  walletAddress,
  claimedUsername,
  legalName: initialLegal = '',
  includeLegalName = false,
  onClaimed,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [username, setUsername] = useState(claimedUsername);
  const [legalName, setLegalName] = useState(initialLegal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(!claimedUsername);
  const valid = isValidUsername(username) && (!includeLegalName || isValidLegalName(legalName));
  const done = Boolean(claimedUsername) && (!includeLegalName || isValidLegalName(initialLegal)) && !editing;
  const legalNameLocked = includeLegalName && isValidLegalName(initialLegal);

  const save = async () => {
    if (!valid || !walletAddress) return;
    setBusy(true);
    setError('');
    try {
      const next = normalizeUsername(username);
      const free = await checkUsernameAvailable(walletAddress, next);
      if (!free) {
        setError(t('usernameTaken'));
        return;
      }
      const saved = await claimUsername(walletAddress, next);
      onClaimed(saved, includeLegalName ? normalizeLegalName(legalName) : undefined);
      setEditing(false);
    } catch (caught) {
      const reason = String((caught as Error)?.message || '');
      if (reason.includes('taken')) setError(t('usernameTaken'));
      else if (reason.includes('username')) setError(t('usernameInvalid'));
      else setError(t('usernameTaken'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={[styles.lead, { color: colors.textMuted }]}>{t('usernameLead')}</Text>
      {includeLegalName ? (
        <Text style={[styles.lead, { color: colors.textMuted }]}>{t('legalNameLead')}</Text>
      ) : null}
      {done ? (
        <View style={[styles.done, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppIcon name="check" size={16} color={colors.success} />
          <Text style={[styles.doneText, { color: colors.text }]}>@{claimedUsername}</Text>
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={[styles.change, { color: colors.primary }]}>{t('usernameChange')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text style={[styles.label, { color: colors.text }]}>{t('usernameField')}</Text>
          <TextInput
            value={username}
            onChangeText={(value) => setUsername(normalizeUsername(value))}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="usuario"
            placeholderTextColor={colors.textMuted}
            maxLength={20}
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('usernameHint')}</Text>
          {includeLegalName ? (
            <>
              <Text style={[styles.label, { color: colors.text }]}>{t('legalNameField')}</Text>
              {legalNameLocked ? (
                <TextInput
                  value={legalName}
                  editable={false}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, opacity: 0.7 }]}
                />
              ) : (
                <TextInput
                  value={legalName}
                  onChangeText={setLegalName}
                  autoCapitalize="words"
                  placeholder={t('legalNameField')}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                />
              )}
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                {legalNameLocked ? t('kycNameLocked') : t('legalNamePrivate')}
              </Text>
            </>
          ) : null}
          <TouchableOpacity
            disabled={busy || !valid || !walletAddress}
            onPress={() => void save()}
            style={[styles.button, { backgroundColor: colors.connect }, (busy || !valid) && { backgroundColor: colors.chip }]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('usernameSave')}</Text>}
          </TouchableOpacity>
          {!notifyApiConfigured() ? (
            <Text style={[styles.hint, { color: colors.warnText }]}>{t('usernameLocalOnly')}</Text>
          ) : null}
          {error ? <Text style={[styles.warn, { color: colors.danger }]}>{error}</Text> : null}
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
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 15,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  warn: {
    fontSize: 13,
    lineHeight: 18,
  },
  done: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doneText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  change: {
    fontSize: 13,
    fontWeight: '600',
  },
});
