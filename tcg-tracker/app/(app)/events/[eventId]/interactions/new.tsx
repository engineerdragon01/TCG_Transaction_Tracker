import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { palette, radius, spacing, typography } from '@/lib/theme';
import type { InteractionType } from '@/types/database';

const TYPES: { value: InteractionType; title: string; sub: string; color: string }[] = [
  { value: 'trade', title: 'Trade', sub: 'Cards for cards (± cash)', color: palette.trade },
  { value: 'sale',  title: 'Sale',  sub: 'Cards out, cash in',       color: palette.sale  },
  { value: 'buy',   title: 'Buy',   sub: 'Cash out, cards in',       color: palette.buy   },
];

export default function NewInteraction() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const [type, setType] = useState<InteractionType>('sale');
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) { setBusy(false); return; }

    const { data, error } = await supabase
      .from('interactions')
      .insert({
        event_id: eventId,
        user_id: user.id,
        type,
        occurred_at: new Date().toISOString(),
      })
      .select()
      .single();

    setBusy(false);
    if (error) {
      Alert.alert('Could not create', error.message);
      return;
    }
    router.replace(`/(app)/events/${eventId}/interactions/${data.id}`);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'New interaction' }} />
      <Screen>
        <Text style={styles.heading}>What kind of interaction?</Text>
        <View style={{ gap: spacing.md }}>
          {TYPES.map((t) => {
            const selected = type === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setType(t.value)}
                style={[
                  styles.option,
                  selected && { borderColor: t.color, borderWidth: 2, backgroundColor: t.color + '11' },
                ]}
              >
                <View style={[styles.colorChip, { backgroundColor: t.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optTitle}>{t.title}</Text>
                  <Text style={styles.optSub}>{t.sub}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Button label="Start logging" onPress={create} loading={busy} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.title, color: palette.text, marginTop: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  colorChip: { width: 12, height: 40, borderRadius: 4 },
  optTitle: { ...typography.title, color: palette.text },
  optSub: { ...typography.small, color: palette.textMuted },
});
