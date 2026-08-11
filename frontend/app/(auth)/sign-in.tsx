import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/auth';
import { theme } from '@/src/theme';

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setErr(null);
    if (!email || !password) { setErr('Please enter email and password'); return; }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      setErr(e?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface }} edges={['top', 'bottom']}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: theme.color.surface }}
    >
      <LinearGradient
        colors={['#0B1220', '#090D14', '#050810']}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <Ionicons name="hardware-chip-outline" size={28} color={theme.color.brand} />
          </View>
          <View>
            <Text style={styles.brandTitle}>INSIDE OUT</Text>
            <Text style={styles.brandSub}>See it. Understand it. Reverse it. Build it.</Text>
          </View>
        </View>

        <View style={styles.card} testID="sign-in-card">
          <Text style={styles.h1}>Welcome back</Text>
          <Text style={styles.h2}>Sign in to continue reverse-engineering</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="sign-in-email"
            value={email} onChangeText={setEmail}
            placeholder="engineer@insideout.app"
            placeholderTextColor={theme.color.textMuted}
            autoCapitalize="none" keyboardType="email-address"
            style={styles.input}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="sign-in-password"
            value={password} onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={theme.color.textMuted}
            secureTextEntry style={styles.input}
          />
          {err && <Text style={styles.err} testID="sign-in-error">{err}</Text>}

          <Pressable
            testID="sign-in-submit-button"
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.8 }]}
            onPress={onSubmit} disabled={loading}
          >
            {loading ? <ActivityIndicator color={theme.color.onBrand} /> : (
              <Text style={styles.primaryText}>SIGN IN</Text>
            )}
          </Pressable>

          <Pressable
            testID="go-to-sign-up-button"
            onPress={() => router.push('/(auth)/sign-up')}
            style={styles.linkRow}
          >
            <Text style={styles.linkDim}>Don't have an account? </Text>
            <Text style={styles.link}>Create one</Text>
          </Pressable>
        </View>

        <Text style={styles.footnote}>INSIDE OUT · Engineering intelligence platform</Text>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: theme.spacing.xl, paddingTop: 80, minHeight: '100%' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: theme.spacing.xxl },
  logoBox: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: theme.color.brandTint, borderWidth: 1, borderColor: theme.color.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  brandTitle: { color: theme.color.text, fontSize: 22, fontWeight: '600', letterSpacing: 2 },
  brandSub: { color: theme.color.textMuted, fontSize: 11, marginTop: 2 },
  card: {
    backgroundColor: theme.color.surface2, borderRadius: theme.radius.lg,
    padding: theme.spacing.xl, borderWidth: 1, borderColor: theme.color.border,
  },
  h1: { color: theme.color.text, fontSize: 24, fontWeight: '600', marginBottom: 4 },
  h2: { color: theme.color.textMuted, fontSize: 13, marginBottom: theme.spacing.xl },
  label: { color: theme.color.textDim, fontSize: 11, letterSpacing: 1.5, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: theme.color.surface, color: theme.color.text,
    borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  primary: {
    marginTop: theme.spacing.xl, backgroundColor: theme.color.brand,
    paddingVertical: 14, borderRadius: theme.radius.md, alignItems: 'center',
  },
  primaryText: { color: theme.color.onBrand, fontWeight: '700', letterSpacing: 1.5 },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.lg },
  linkDim: { color: theme.color.textMuted, fontSize: 13 },
  link: { color: theme.color.brand, fontSize: 13, fontWeight: '600' },
  err: { color: theme.color.error, marginTop: 8, fontSize: 12 },
  footnote: { color: theme.color.textMuted, fontSize: 10, textAlign: 'center', marginTop: theme.spacing.xl, letterSpacing: 1 },
});
