import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { signIn } from '@/hooks/useAuth';
import { palette, spacing, typography } from '@/lib/theme';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!email || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) Alert.alert('Sign in failed', error.message);
  }

  return (
    <Screen>
      <View style={styles.brand}>
        <Text style={styles.kicker}>TCG TRACKER</Text>
        <Text style={styles.title}>Sign in.</Text>
        <Text style={styles.subtitle}>
          Track every trade, sale, and buy at your next show.
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          placeholder="••••••••"
        />
        <Button label="Sign in" onPress={onSubmit} loading={busy} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>No account yet?</Text>
        <Link href="/(auth)/sign-up" style={styles.link}>Create one</Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { gap: spacing.xs, marginTop: spacing.xxl },
  kicker: { ...typography.small, color: palette.accent, letterSpacing: 2, fontWeight: '700' },
  title: { ...typography.display, color: palette.text },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.xs },
  footer: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', marginTop: 'auto' },
  footerText: { ...typography.body, color: palette.textMuted },
  link: { ...typography.bodyStrong, color: palette.accent },
});
