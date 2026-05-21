import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, Image, ScrollView,
} from 'react-native';
import {
  Stack, useLocalSearchParams, useRouter, useFocusEffect,
} from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '@/components/Screen';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { InteractionTypeBadge } from '@/components/InteractionTypeBadge';
import { supabase, STORAGE_BUCKET } from '@/lib/supabase';
import { palette, radius, spacing, typography } from '@/lib/theme';
import type {
  Interaction, InteractionCard, InteractionImage, CardDirection,
} from '@/types/database';

export default function InteractionDetail() {
  const { eventId, interactionId } =
    useLocalSearchParams<{ eventId: string; interactionId: string }>();
  const router = useRouter();
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [cards, setCards] = useState<InteractionCard[]>([]);
  const [images, setImages] = useState<(InteractionImage & { url?: string })[]>([]);

  // Cash fields, kept in component state so the user can type freely.
  const [cashIn, setCashIn] = useState('');
  const [cashOut, setCashOut] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    const [{ data: i }, { data: c }, { data: img }] = await Promise.all([
      supabase.from('interactions').select('*').eq('id', interactionId).single(),
      supabase.from('interaction_cards').select('*').eq('interaction_id', interactionId).order('created_at'),
      supabase.from('interaction_images').select('*').eq('interaction_id', interactionId).order('created_at'),
    ]);
    if (i) {
      setInteraction(i);
      setCashIn(String(i.cash_in ?? ''));
      setCashOut(String(i.cash_out ?? ''));
      setPaymentMethod(i.payment_method ?? '');
      setCounterparty(i.counterparty ?? '');
      setNotes(i.notes ?? '');
    }
    setCards(c ?? []);

    // Resolve signed URLs for stored images.
    if (img && img.length) {
      const withUrls = await Promise.all(
        img.map(async (row) => {
          const { data: signed } = await supabase
            .storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(row.storage_path, 60 * 30);
          return { ...row, url: signed?.signedUrl };
        })
      );
      setImages(withUrls);
    } else {
      setImages([]);
    }
  }, [interactionId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function saveCash() {
    const { error } = await supabase
      .from('interactions')
      .update({
        cash_in: parseFloat(cashIn) || 0,
        cash_out: parseFloat(cashOut) || 0,
        payment_method: paymentMethod.trim() || null,
        counterparty: counterparty.trim() || null,
        notes: notes.trim() || null,
      })
      .eq('id', interactionId);
    if (error) Alert.alert('Save failed', error.message);
    else Alert.alert('Saved', 'Interaction updated.');
  }

  async function deleteCard(id: string) {
    await supabase.from('interaction_cards').delete().eq('id', id);
    load();
  }

  async function pickAndUploadImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const filename = `${user.id}/${interactionId}/${Date.now()}.jpg`;
    const blob = await (await fetch(asset.uri)).blob();
    const { error: upErr } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .upload(filename, blob, { contentType: 'image/jpeg' });
    if (upErr) { Alert.alert('Upload failed', upErr.message); return; }

    const { error: rowErr } = await supabase
      .from('interaction_images')
      .insert({ interaction_id: interactionId, storage_path: filename, kind: 'other' });
    if (rowErr) Alert.alert('Save failed', rowErr.message);
    load();
  }

  async function deleteInteraction() {
    Alert.alert('Delete interaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('interactions').delete().eq('id', interactionId);
          router.back();
        },
      },
    ]);
  }

  const cardsIn = cards.filter((c) => c.direction === 'in');
  const cardsOut = cards.filter((c) => c.direction === 'out');

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Interaction',
          headerRight: () => (
            <Pressable onPress={deleteInteraction} hitSlop={12}>
              <Ionicons name="trash-outline" size={20} color={palette.negative} />
            </Pressable>
          ),
        }}
      />
      <Screen>
        {interaction && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <InteractionTypeBadge type={interaction.type} />
            <Text style={styles.timestamp}>
              {new Date(interaction.occurred_at).toLocaleString()}
            </Text>
          </View>
        )}

        {/* Cards received */}
        <Section
          title="Cards received (in)"
          accent={palette.positive}
          cards={cardsIn}
          onAdd={() => router.push(
            `/(app)/events/${eventId}/scan?interactionId=${interactionId}&direction=in`
          )}
          onDelete={deleteCard}
        />

        {/* Cards given */}
        <Section
          title="Cards given (out)"
          accent={palette.negative}
          cards={cardsOut}
          onAdd={() => router.push(
            `/(app)/events/${eventId}/scan?interactionId=${interactionId}&direction=out`
          )}
          onDelete={deleteCard}
        />

        {/* Cash & payment */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Cash & payment</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Cash in ($)"
                value={cashIn}
                onChangeText={setCashIn}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Cash out ($)"
                value={cashOut}
                onChangeText={setCashOut}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </View>
          </View>
          <Input
            label="Payment method"
            value={paymentMethod}
            onChangeText={setPaymentMethod}
            placeholder="cash / venmo / zelle"
          />
          <Input
            label="Counterparty"
            value={counterparty}
            onChangeText={setCounterparty}
            placeholder="Name or @handle (optional)"
          />
          <Input
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={{ minHeight: 70 }}
          />
          <Button label="Save details" onPress={saveCash} variant="secondary" />
        </View>

        {/* Receipt images */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.cardHeader}>Receipt images</Text>
            <Pressable onPress={pickAndUploadImage} hitSlop={8}>
              <Ionicons name="add-circle-outline" size={26} color={palette.accent} />
            </Pressable>
          </View>
          {images.length === 0 ? (
            <Text style={styles.cardEmpty}>
              Attach a Venmo/Zelle screenshot or photo of cash for your records.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {images.map((img) => (
                  img.url ? (
                    <Image
                      key={img.id}
                      source={{ uri: img.url }}
                      style={styles.thumb}
                    />
                  ) : null
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </Screen>
    </>
  );
}

function Section({ title, accent, cards, onAdd, onDelete }: {
  title: string;
  accent: string;
  cards: InteractionCard[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: accent }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.cardHeader}>{title}</Text>
        <Pressable onPress={onAdd} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={26} color={palette.accent} />
        </Pressable>
      </View>
      {cards.length === 0 ? (
        <Text style={styles.cardEmpty}>None yet. Tap + to scan or add.</Text>
      ) : (
        cards.map((c) => (
          <View key={c.id} style={styles.cardRow}>
            {c.image_url && <Image source={{ uri: c.image_url }} style={styles.miniThumb} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.cardRowTitle}>{c.card_name}</Text>
              <Text style={styles.cardRowSub}>
                {[c.set_name, c.card_number].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.cardRowValue}>
                {c.estimated_value != null
                  ? `$${(Number(c.estimated_value) * c.quantity).toFixed(2)}`
                  : '—'}
              </Text>
              {c.quantity > 1 && <Text style={styles.cardRowSub}>×{c.quantity}</Text>}
            </View>
            <Pressable onPress={() => onDelete(c.id)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={palette.textDim} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  timestamp: { ...typography.small, color: palette.textMuted },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: { ...typography.bodyStrong, color: palette.text },
  cardEmpty: { ...typography.small, color: palette.textMuted },
  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: palette.border,
  },
  cardRowTitle: { ...typography.body, color: palette.text },
  cardRowSub: { ...typography.small, color: palette.textMuted },
  cardRowValue: { ...typography.bodyStrong, color: palette.text },
  miniThumb: { width: 38, height: 53, borderRadius: 4, backgroundColor: palette.surfaceElevated },
  thumb: { width: 120, height: 160, borderRadius: radius.md, backgroundColor: palette.surfaceElevated },
});
