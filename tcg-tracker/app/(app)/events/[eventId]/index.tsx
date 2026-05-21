import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { InteractionTypeBadge } from '@/components/InteractionTypeBadge';
import { supabase } from '@/lib/supabase';
import { palette, radius, spacing, typography, TAP_TARGET } from '@/lib/theme';
import type { Event, InteractionSummary } from '@/types/database';

export default function EventDetail() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [interactions, setInteractions] = useState<InteractionSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: ev, error: e1 }, { data: ints, error: e2 }] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).single(),
      supabase
        .from('interaction_summary')
        .select('*')
        .eq('event_id', eventId)
        .order('occurred_at', { ascending: false }),
    ]);
    if (e1) Alert.alert('Could not load event', e1.message);
    if (e2) Alert.alert('Could not load interactions', e2.message);
    setEvent(ev ?? null);
    setInteractions(ints ?? []);
    setRefreshing(false);
  }, [eventId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const netTotal = interactions.reduce((s, i) => s + Number(i.net_value || 0), 0);
  const cashIn = interactions.reduce((s, i) => s + Number(i.cash_in || 0), 0);
  const cashOut = interactions.reduce((s, i) => s + Number(i.cash_out || 0), 0);

  return (
    <>
      <Stack.Screen options={{ title: event?.name ?? 'Event' }} />
      <Screen scroll={false} padded={false}>
        <FlatList
          data={interactions}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={palette.accent}
            />
          }
          ListHeaderComponent={
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Net P/L</Text>
                <Text style={[
                  styles.summaryValue,
                  { color: netTotal >= 0 ? palette.positive : palette.negative },
                ]}>
                  {netTotal >= 0 ? '+' : ''}${netTotal.toFixed(2)}
                </Text>
              </View>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryCellLabel}>Cash in</Text>
                  <Text style={styles.summaryCellValue}>${cashIn.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryCellLabel}>Cash out</Text>
                  <Text style={styles.summaryCellValue}>${cashOut.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryCellLabel}>Count</Text>
                  <Text style={styles.summaryCellValue}>{interactions.length}</Text>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No interactions yet.</Text>
              <Text style={styles.emptySub}>Tap "New interaction" to log a trade, sale, or buy.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push(`/(app)/events/${eventId}/interactions/${item.id}`)
              }
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <InteractionTypeBadge type={item.type} />
                <Text style={styles.rowTime}>
                  {new Date(item.occurred_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
              <Text
                style={[
                  styles.rowNet,
                  { color: item.net_value >= 0 ? palette.positive : palette.negative },
                ]}
              >
                {item.net_value >= 0 ? '+' : ''}${Number(item.net_value).toFixed(2)}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={palette.textDim} />
            </Pressable>
          )}
        />

        <View style={styles.fab}>
          <Button
            label="+  New interaction"
            onPress={() => router.push(`/(app)/events/${eventId}/interactions/new`)}
          />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  summaryLabel: { ...typography.small, color: palette.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  summaryValue: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  summaryGrid: { flexDirection: 'row', gap: spacing.md, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: spacing.md },
  summaryCell: { flex: 1 },
  summaryCellLabel: { ...typography.small, color: palette.textDim },
  summaryCellValue: { ...typography.bodyStrong, color: palette.text, marginTop: 2 },

  row: {
    minHeight: TAP_TARGET,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowTime: { ...typography.small, color: palette.textMuted },
  rowNet: { ...typography.bodyStrong },

  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl },
  emptyTitle: { ...typography.title, color: palette.text },
  emptySub: { ...typography.body, color: palette.textMuted, textAlign: 'center' },

  fab: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
});
