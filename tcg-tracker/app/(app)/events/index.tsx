import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Alert, ActionSheetIOS, Platform,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { signOut } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { palette, radius, spacing, typography, TAP_TARGET } from '@/lib/theme';
import type { Event } from '@/types/database';

export default function EventsList() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) {
      Alert.alert('Could not load events', error.message);
    } else {
      setEvents(data ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openSettings() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Log out'], cancelButtonIndex: 0, destructiveButtonIndex: 1 },
        (i) => { if (i === 1) signOut(); },
      );
    } else {
      Alert.alert('Settings', undefined, [
        { text: 'Log out', style: 'destructive', onPress: () => signOut() },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Events',
          headerRight: () => (
            <Pressable onPress={openSettings} hitSlop={12}>
              <Ionicons name="settings-outline" size={22} color={palette.textMuted} />
            </Pressable>
          ),
        }}
      />
      <Screen scroll={false} padded={false}>
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={palette.accent}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No events yet.</Text>
                <Text style={styles.emptySub}>
                  Create your first event to start tracking interactions.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(app)/events/${item.id}`)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {item.location && <Text style={styles.cardSub}>{item.location}</Text>}
                {item.start_date && (
                  <Text style={styles.cardDate}>
                    {item.start_date}
                    {item.end_date && item.end_date !== item.start_date ? ` → ${item.end_date}` : ''}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
            </Pressable>
          )}
        />

        <View style={styles.fab}>
          <Button
            label="+  New event"
            onPress={() => router.push('/(app)/events/new')}
          />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: TAP_TARGET + 20,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardTitle: { ...typography.title, color: palette.text },
  cardSub: { ...typography.body, color: palette.textMuted },
  cardDate: { ...typography.small, color: palette.textDim, marginTop: spacing.xs },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl * 2 },
  emptyTitle: { ...typography.title, color: palette.text },
  emptySub: { ...typography.body, color: palette.textMuted, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg,
  },
});
