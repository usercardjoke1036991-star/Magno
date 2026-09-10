import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon, type IconName } from './icons';

interface AppSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  tone?: 'default' | 'green' | 'blue' | 'gold';
  icon?: IconName;
}

export const AppSection: React.FC<AppSectionProps> = ({
  title,
  description,
  children,
  defaultOpen = true,
  icon,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setOpen((value) => !value)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
      >
        {icon ? <AppIcon name={icon} size={18} color={colors.textMuted} /> : null}
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {description && open ? (
            <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
          ) : null}
        </View>
        <Text style={[styles.chevron, { color: colors.textMuted }]}>{open ? '–' : '+'}</Text>
      </TouchableOpacity>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
};

interface AppSubsectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: IconName;
}

export const AppSubsection: React.FC<AppSubsectionProps> = ({
  title,
  children,
  defaultOpen = true,
  icon,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const { colors } = useTheme();

  return (
    <View style={styles.subCard}>
      <TouchableOpacity
        style={styles.subHeader}
        onPress={() => setOpen((value) => !value)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
      >
        {icon ? <AppIcon name={icon} size={15} color={colors.textMuted} /> : null}
        <Text style={[styles.subTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.subChevron, { color: colors.textMuted }]}>{open ? '–' : '+'}</Text>
      </TouchableOpacity>
      {open ? <View style={styles.subBody}>{children}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  description: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  chevron: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '400',
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14,
  },
  subCard: {
    overflow: 'hidden',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  subTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  subChevron: {
    fontSize: 16,
    fontWeight: '400',
  },
  subBody: {
    paddingTop: 8,
    paddingBottom: 4,
  },
});
