import { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { supabase, STORAGE_BUCKET } from '@/lib/supabase';
import { recognizeText, OCR_AVAILABLE } from '@/lib/ocr';
import {
  parseOcrText, searchCards, estimateValue,
} from '@/lib/pokemonTcg';
import { palette, radius, spacing, typography } from '@/lib/theme';
import type { CardDirection, PokemonTcgCard } from '@/types/database';

type Phase = 'capture' | 'match' | 'confirm';

export default function Scan() {
  const { eventId, interactionId, direction } = useLocalSearchParams<{
    eventId: string;
    interactionId: string;
    direction: CardDirection;
  }>();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<Phase>('capture');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualNumber, setManualNumber] = useState('');
  const [candidates, setCandidates] = useState<PokemonTcgCard[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<PokemonTcgCard | null>(null);
  const [valueOverride, setValueOverride] = useState('');
  const [quantity, setQuantity] = useState('1');

  if (!permission) {
    return <Screen><ActivityIndicator color={palette.accent} /></Screen>;
  }
  if (!permission.granted) {
    return (
      <Screen>
        <Text style={[typography.title, { color: palette.text }]}>Camera access needed</Text>
        <Text style={[typography.body, { color: palette.textMuted }]}>
          Grant camera access to scan cards. You can also enter card info manually below.
        </Text>
        <Button label="Allow camera" onPress={requestPermission} />
        <Button
          label="Skip — enter manually"
          variant="secondary"
          onPress={() => setPhase('match')}
        />
      </Screen>
    );
  }

  async function capture() {
    if (!cameraRef.current) return;
    setBusy(true);
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
    if (!photo) { setBusy(false); return; }
    // Downsize for OCR speed and storage.
    const manipulated = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    setCapturedUri(manipulated.uri);

    // Try OCR. If the OCR module is stubbed (Expo Go), fall through to manual entry.
    const text = await recognizeText({ imageUri: manipulated.uri });
    if (text) {
      const parsed = parseOcrText(text);
      if (parsed.candidateName) setManualName(parsed.candidateName);
      if (parsed.setNumber) setManualNumber(parsed.setNumber);
      await runSearch(parsed.candidateName, parsed.setNumber);
    }
    setBusy(false);
    setPhase('match');
  }

  async function runSearch(name?: string | null, number?: string | null) {
    setBusy(true);
    try {
      const results = await searchCards({
        name: name ?? manualName,
        setNumber: number ?? manualNumber,
      });
      setCandidates(results);
    } catch (e: any) {
      Alert.alert('Search failed', e?.message ?? String(e));
    }
    setBusy(false);
  }

  async function saveCard() {
    if (!selected) return;
    setBusy(true);

    // Upload the capture image (if any) to storage.
    let scanImageUrl: string | null = null;
    if (capturedUri) {
      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        const filename = `${user.id}/${interactionId}/${Date.now()}-scan.jpg`;
        const blob = await (await fetch(capturedUri)).blob();
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filename, blob, { contentType: 'image/jpeg' });
        if (!error) {
          const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(filename, 60 * 60 * 24 * 365);
          scanImageUrl = data?.signedUrl ?? null;
        }
      }
    }

    const value =
      parseFloat(valueOverride) ||
      estimateValue(selected) ||
      null;

    const { error } = await supabase.from('interaction_cards').insert({
      interaction_id: interactionId,
      direction,
      tcg_card_id: selected.id,
      card_name: selected.name,
      set_name: selected.set?.name ?? null,
      card_number: `${selected.number}/${selected.set?.printedTotal ?? ''}`,
      rarity: selected.rarity ?? null,
      image_url: selected.images.small,
      scan_image_url: scanImageUrl,
      estimated_value: value,
      quantity: parseInt(quantity, 10) || 1,
    });

    setBusy(false);
    if (error) {
      Alert.alert('Save failed', error.message);
      return;
    }
    router.back();
  }

  if (phase === 'capture') {
    return (
      <>
        <Stack.Screen options={{ title: direction === 'in' ? 'Scan card received' : 'Scan card given' }} />
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          <View style={styles.cameraOverlay}>
            <View style={styles.frameGuide} />
            <Text style={styles.hint}>
              Align the card inside the frame. {OCR_AVAILABLE ? 'OCR will try to read the name and set number.' : 'You will confirm the card on the next screen.'}
            </Text>
          </View>
          <View style={styles.cameraControls}>
            <Pressable onPress={() => setPhase('match')} style={styles.secondaryControl}>
              <Text style={styles.secondaryControlText}>Skip</Text>
            </Pressable>
            <Pressable onPress={capture} style={styles.shutter} disabled={busy}>
              {busy
                ? <ActivityIndicator color="#000" />
                : <View style={styles.shutterInner} />}
            </Pressable>
            <View style={{ width: 60 }} />
          </View>
        </View>
      </>
    );
  }

  if (phase === 'match') {
    return (
      <>
        <Stack.Screen options={{ title: 'Find the card' }} />
        <Screen>
          {capturedUri && (
            <Image source={{ uri: capturedUri }} style={styles.capturePreview} resizeMode="contain" />
          )}
          <Text style={[typography.small, { color: palette.textMuted }]}>
            {OCR_AVAILABLE
              ? "Tweak the search if OCR didn't nail it, then tap Search."
              : "Type the card's name. Add the set number (e.g. 152) to narrow results."}
          </Text>
          <Input label="Card name" value={manualName} onChangeText={setManualName} autoCapitalize="words" />
          <Input label="Card number (optional)" value={manualNumber} onChangeText={setManualNumber} keyboardType="number-pad" />
          <Button label="Search" onPress={() => runSearch()} loading={busy} />

          {candidates.length > 0 && (
            <>
              <Text style={[typography.bodyStrong, { color: palette.text, marginTop: spacing.md }]}>
                Tap the matching card
              </Text>
              <View style={{ gap: spacing.sm }}>
                {candidates.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => { setSelected(c); setPhase('confirm'); }}
                    style={styles.candidate}
                  >
                    <Image source={{ uri: c.images.small }} style={styles.candidateImg} />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.body, { color: palette.text }]}>{c.name}</Text>
                      <Text style={[typography.small, { color: palette.textMuted }]}>
                        {c.set.name} · {c.number}/{c.set.printedTotal}
                      </Text>
                      {estimateValue(c) != null && (
                        <Text style={[typography.small, { color: palette.accent, marginTop: 2 }]}>
                          ~${estimateValue(c)!.toFixed(2)} market
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </Screen>
      </>
    );
  }

  // confirm phase
  return (
    <>
      <Stack.Screen options={{ title: 'Confirm card' }} />
      <Screen>
        {selected && (
          <>
            <View style={styles.confirmRow}>
              <Image source={{ uri: selected.images.large }} style={styles.confirmImg} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[typography.title, { color: palette.text }]}>{selected.name}</Text>
                <Text style={[typography.body, { color: palette.textMuted }]}>
                  {selected.set.name}
                </Text>
                <Text style={[typography.small, { color: palette.textDim }]}>
                  {selected.number}/{selected.set.printedTotal}
                  {selected.rarity ? ` · ${selected.rarity}` : ''}
                </Text>
                {estimateValue(selected) != null && (
                  <Text style={[typography.body, { color: palette.accent, marginTop: spacing.xs }]}>
                    Market ~${estimateValue(selected)!.toFixed(2)}
                  </Text>
                )}
              </View>
            </View>

            <Input
              label="Value override ($)"
              placeholder={estimateValue(selected) != null ? estimateValue(selected)!.toFixed(2) : '0.00'}
              value={valueOverride}
              onChangeText={setValueOverride}
              keyboardType="decimal-pad"
            />
            <Input
              label="Quantity"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
            />

            <Button label={`Add to ${direction === 'in' ? 'received' : 'given'}`} onPress={saveCard} loading={busy} />
            <Button label="Pick a different match" variant="secondary" onPress={() => setPhase('match')} />
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraOverlay: {
    position: 'absolute', inset: 0,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  frameGuide: {
    width: '80%', aspectRatio: 0.72,
    borderWidth: 2, borderColor: palette.accent,
    borderRadius: radius.lg,
  },
  hint: {
    ...typography.small, color: palette.text, textAlign: 'center',
    marginTop: spacing.lg, backgroundColor: '#000000aa', padding: spacing.sm, borderRadius: radius.sm,
  },
  cameraControls: {
    position: 'absolute', bottom: 50, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  shutter: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 4, borderColor: '#000',
  },
  secondaryControl: { padding: spacing.md },
  secondaryControlText: { ...typography.body, color: palette.text },
  capturePreview: { width: '100%', height: 200, borderRadius: radius.md },
  candidate: {
    flexDirection: 'row', gap: spacing.md, padding: spacing.md,
    backgroundColor: palette.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: palette.border, alignItems: 'center',
  },
  candidateImg: { width: 60, height: 84, borderRadius: 4, backgroundColor: palette.surfaceElevated },
  confirmRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  confirmImg: { width: 140, height: 196, borderRadius: radius.md, backgroundColor: palette.surfaceElevated },
});
