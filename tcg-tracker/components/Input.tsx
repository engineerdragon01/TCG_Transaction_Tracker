import { TextInput, View, Text, StyleSheet, TextInputProps } from 'react-native';
import { palette, radius, spacing, typography, TAP_TARGET } from '@/lib/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...rest }: InputProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={palette.textDim}
        style={[styles.input, error && styles.inputError, style]}
        {...rest}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.small, color: palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    minHeight: TAP_TARGET,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: palette.text,
    ...typography.body,
  },
  inputError: { borderColor: palette.negative },
  error: { ...typography.small, color: palette.negative },
});
