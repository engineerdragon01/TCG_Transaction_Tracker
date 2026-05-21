import { useState } from 'react';
import { View, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/lib/theme';

export default function NewEvent() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give the event a name.');
      return;
    }
    setBusy(true);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) { setBusy(false); return; }

    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: user.id,
        name: name.trim(),
        location: location.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    setBusy(false);
    if (error) {
      Alert.alert('Could not create event', error.message);
      return;
    }
    router.replace(`/(app)/events/${data.id}`);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'New event' }} />
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Input label="Name *" value={name} onChangeText={setName}
                 placeholder="e.g. PokéCon Sacramento" autoFocus />
          <Input label="Location" value={location} onChangeText={setLocation}
                 placeholder="Venue / city" />
          <Input label="Start date (YYYY-MM-DD)" value={startDate}
                 onChangeText={setStartDate} placeholder="2026-06-14"
                 autoCapitalize="none" />
          <Input label="End date (YYYY-MM-DD)" value={endDate}
                 onChangeText={setEndDate} placeholder="2026-06-15"
                 autoCapitalize="none" />
          <Input label="Notes" value={notes} onChangeText={setNotes}
                 multiline numberOfLines={3} style={{ minHeight: 80 }} />
        </View>
        <Button label="Create event" onPress={create} loading={busy} />
      </Screen>
    </>
  );
}
