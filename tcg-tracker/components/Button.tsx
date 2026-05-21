import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { palette, radius, spacing, typography, TAP_TARGET } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <Text style={[styles.label, variant === 'ghost' && { color: palette.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TAP_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: palette.accent },
  secondary: { backgroundColor: palette.surfaceElevated, borderWidth: 1, borderColor: palette.border },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: palette.negative },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  label: { ...typography.bodyStrong, color: '#0d0e10' },
});
