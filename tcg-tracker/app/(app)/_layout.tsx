import { Stack } from 'expo-router';
import { palette } from '@/lib/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.bg },
        headerTintColor: palette.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: palette.bg },
      }}
    />
  );
}
