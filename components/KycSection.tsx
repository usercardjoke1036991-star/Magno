import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './icons';
import { AppText, AppTextInput } from './AppText';
import {
  formatKycFingerprint,
  isValidKyc,
  loadKycDeclaration,
  saveKycDeclaration,
  type KycDocType,
} from '../services/kycDeclaration';

interface KycSectionProps {
  walletAddress: string;
  isRegistered: boolean;
  kycDeclarado: boolean;
  isLoading: boolean;
  paused?: boolean;
  onDeclare: () => Promise<boolean>;
}

const DOC_TYPES: KycDocType[] = ['nationalId', 'passport', 'other'];

export const KycSection: React.FC<KycSectionProps> = ({
  walletAddress,
  isRegistered,
  kycDeclarado,
  isLoading,
  paused = false,
  onDeclare,
}) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [docType, setDocType] = useState<KycDocType>('nationalId');
  const [accepted, setAccepted] = useState(false);
  const [fingerprint, setFingerprint] = useState('');
  const [editing, setEditing] = useState(false);
  const [nameLocked, setNameLocked] = useState(false);
  const [docLocked, setDocLocked] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;
    loadKycDeclaration(walletAddress).then((saved) => {
      if (!saved) return;
      setLegalName(saved.legalName);
      setCountry(saved.country);
      setCity(saved.city || '');
      setRegion(saved.region || '');
      setDocType(saved.docType);
      setAccepted(true);
      setFingerprint(formatKycFingerprint(saved.identityFingerprint));
      setNameLocked(Boolean(saved.boundLegalName));
      setDocLocked(Boolean(saved.docLocked));
    }).catch(() => {});
  }, [walletAddress]);

  const done = kycDeclarado && !editing;
  const identityNameFrozen = kycDeclarado || nameLocked;
  const identityDocFrozen = kycDeclarado || docLocked;
  const blocked = isLoading || paused || !isRegistered || !walletAddress;

  const submit = async () => {
    if (!isValidKyc({ legalName, country, city, docType }) || !accepted) return;
    const saved = await saveKycDeclaration(walletAddress, {
      legalName,
      country,
      city,
      region,
      docType,
    });
    setFingerprint(formatKycFingerprint(saved.identityFingerprint));
    setNameLocked(Boolean(saved.boundLegalName));
    setDocLocked(Boolean(saved.docLocked));
    if (!kycDeclarado) {
      const ok = await onDeclare();
      if (!ok) return;
    }
    setEditing(false);
  };

  const docLabel = (type: KycDocType) => {
    if (type === 'passport') return t('kycDocPassport');
    if (type === 'other') return t('kycDocOther');
    return t('kycDocNationalId');
  };

  return (
    <View>
      <AppText style={[styles.lead, { color: colors.textMuted }]}>{t('kycLead')}</AppText>
      <AppText style={[styles.note, { color: colors.textMuted }]}>{t('kycNotGov')}</AppText>
      <AppText style={[styles.note, { color: colors.textMuted }]}>{t('kycLocationPrivate')}</AppText>
      <AppText style={[styles.note, { color: colors.textMuted }]}>{t('kycBoundNote')}</AppText>
      {fingerprint ? (
        <AppText style={[styles.note, { color: colors.textMuted }]}>{t('kycFingerprint', { fingerprint })}</AppText>
      ) : null}

      {done ? (
        <View style={[styles.done, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppIcon name="check" size={16} color={colors.success} />
          <AppText style={[styles.doneText, { color: colors.text }]}>{t('kycDone')}</AppText>
          <TouchableOpacity onPress={() => setEditing(true)}>
            <AppText style={[styles.change, { color: colors.primary }]}>{t('kycEdit')}</AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          {!isRegistered ? (
            <AppText style={[styles.warn, { color: colors.warnText }]}>{t('activateBeforeLoan')}</AppText>
          ) : null}
          <AppText style={[styles.label, { color: colors.text }]}>{t('kycLegalName')}</AppText>
          {identityNameFrozen ? (
            <View style={[styles.frozenField, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AppText style={[styles.frozenText, { color: colors.text }]}>{legalName}</AppText>
              <AppText style={[styles.frozenBadge, { color: colors.textMuted }]}>{t('kycNameLocked')}</AppText>
            </View>
          ) : (
            <AppTextInput
              value={legalName}
              onChangeText={setLegalName}
              editable={!blocked}
              placeholder={t('kycLegalName')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            />
          )}
          <AppText style={[styles.label, { color: colors.text }]}>{t('kycCountry')}</AppText>
          <AppTextInput
            value={country}
            onChangeText={setCountry}
            editable={!blocked}
            placeholder={t('kycCountry')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          />
          <AppText style={[styles.label, { color: colors.text }]}>{t('kycCity')}</AppText>
          <AppTextInput
            value={city}
            onChangeText={setCity}
            editable={!blocked}
            placeholder={t('kycCity')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          />
          <AppText style={[styles.label, { color: colors.text }]}>{t('kycRegion')}</AppText>
          <AppTextInput
            value={region}
            onChangeText={setRegion}
            editable={!blocked}
            placeholder={t('kycRegion')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          />
          <AppText style={[styles.label, { color: colors.text }]}>{t('kycDocType')}</AppText>
          {identityDocFrozen ? (
            <View style={[styles.frozenField, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AppText style={[styles.frozenText, { color: colors.text }]}>{docLabel(docType)}</AppText>
              <AppText style={[styles.frozenBadge, { color: colors.textMuted }]}>{t('kycDocTypeLocked')}</AppText>
            </View>
          ) : (
            <View style={styles.types}>
              {DOC_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setDocType(type)}
                  style={[
                    styles.typeChip,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    docType === type && { borderColor: colors.primary, backgroundColor: colors.chip },
                  ]}
                >
                  <AppText style={[styles.typeText, { color: colors.text }]}>{docLabel(type)}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity onPress={() => setAccepted((value) => !value)} style={styles.checkRow}>
            <View style={[styles.box, { borderColor: colors.border }, accepted && { backgroundColor: colors.primary, borderColor: colors.primary }]} />
            <AppText style={[styles.checkText, { color: colors.text }]}>{t('kycDeclare')}</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={blocked || !accepted || !isValidKyc({ legalName, country, city, docType })}
            onPress={submit}
            style={[
              styles.button,
              { backgroundColor: colors.connect },
              (blocked || !accepted || !isValidKyc({ legalName, country, city, docType })) && { backgroundColor: colors.chip },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <AppText style={[styles.buttonText, (blocked || !accepted) && { color: colors.textMuted }]}>
                {paused ? t('actionPaused') : t('kycSubmit')}
              </AppText>
            )}
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
    marginBottom: 6,
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  warn: {
    fontSize: 13,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
  },
  frozenField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  frozenText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  frozenBadge: {
    fontSize: 11,
    marginLeft: 8,
  },
  types: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typeChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 2,
  },
  checkText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  done: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  doneText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  change: {
    fontSize: 13,
    fontWeight: '600',
  },
});
