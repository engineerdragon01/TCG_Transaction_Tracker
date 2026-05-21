import { View, Text, StyleSheet } from 'react-native';
import { palette, radius, spacing, typography } from '@/lib/theme';
import type { InteractionType } from '@/types/database';

const LABEL: Record<InteractionType, string> = {
  trade: 'TRADE',
  sale: 'SALE',
  buy: 'BUY',
};

const COLOR: Record<InteractionType, string> = {
  trade: palette.trade,
  sale: palette.sale,
  buy: palette.buy,
};

export function InteractionTypeBadge({ type }: { type: InteractionType }) {
  return (
    <View style={[styles.badge, { backgroundColor: COLOR[type] + '22', borderColor: COLOR[type] }]}>
      <Text style={[styles.label, { color: COLOR[type] }]}>{LABEL[type]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: { ...typography.small, fontWeight: '700', letterSpacing: 0.8 },
});
