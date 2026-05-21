import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { signUp } from '@/hooks/useAuth';
import { palette, spacing, typography } from '@/lib/theme';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!email || password.length < 6) {
      Alert.alert('Invalid', 'Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    const { error } = await signUp(email.trim(), password);
    setBusy(false);
    if (error) {
      Alert.alert('Sign up failed', error.message);
    } else {
      Alert.alert(
        'Check your email',
        'We sent a confirmation link. After confirming, return here to sign in.'
      );
    }
  }

  return (
    <Screen>
      <View style={{ marginTop: spacing.xxl, gap: spacing.xs }}>
        <Text style={styles.kicker}>TCG TRACKER</Text>
        <Text style={styles.title}>Create account.</Text>
      </View>

      <View style={{ gap: spacing.md }}>
        <Input label="Email" value={email} onChangeText={setEmail}
               autoCapitalize="none" keyboardType="email-address" />
        <Input label="Password" value={password} onChangeText={setPassword}
               secureTextEntry placeholder="At least 6 characters" />
        <Button label="Sign up" onPress={onSubmit} loading={busy} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Link href="/(auth)/sign-in" style={styles.link}>Sign in</Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { ...typography.small, color: palette.accent, letterSpacing: 2, fontWeight: '700' },
  title: { ...typography.display, color: palette.text },
  footer: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', marginTop: 'auto' },
  footerText: { ...typography.body, color: palette.textMuted },
  link: { ...typography.bodyStrong, color: palette.accent },
});
