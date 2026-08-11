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

const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Engineer'];

export default function SignUp() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setErr(null);
    if (!name || !email || !password) { setErr('Please fill all fields'); return; }
    if (password.length < 6) { setErr('Password must be 6+ chars'); return; }
    setLoading(true);
    try {
      await signUp(name.trim(), email.trim(), password, level);
    } catch (e: any) {
      setErr(e?.message || 'Registration failed');
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
      <LinearGradient colors={['#0B1220', '#090D14', '#050810']} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <Ionicons name="hardware-chip-outline" size={28} color={theme.color.brand} />
          </View>
          <View>
            <Text style={styles.brandTitle}>INSIDE OUT</Text>
            <Text style={styles.brandSub}>Join the engineering platform</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.h1}>Create account</Text>
          <Text style={styles.h2}>Start understanding technology from the inside out</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            testID="sign-up-name" value={name} onChangeText={setName}
            placeholder="Your name" placeholderTextColor={theme.color.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="sign-up-email" value={email} onChangeText={setEmail}
            placeholder="engineer@insideout.app" placeholderTextColor={theme.color.textMuted}
            autoCapitalize="none" keyboardType="email-address" style={styles.input}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="sign-up-password" value={password} onChangeText={setPassword}
            placeholder="6+ characters" placeholderTextColor={theme.color.textMuted}
            secureTextEntry style={styles.input}
          />
          <Text style={styles.label}>Experience level</Text>
          <View style={styles.chipsRow}>
            {LEVELS.map((l) => (
              <Pressable
                key={l}
                testID={`level-chip-${l.toLowerCase()}`}
                onPress={() => setLevel(l)}
                style={[styles.chip, level === l && styles.chipActive]}
              >
                <Text style={[styles.chipText, level === l && styles.chipTextActive]}>{l}</Text>
              </Pressable>
            ))}
          </View>

          {err && <Text style={styles.err} testID="sign-up-error">{err}</Text>}

          <Pressable
            testID="sign-up-submit-button"
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.8 }]}
            onPress={onSubmit} disabled={loading}
          >
            {loading ? <ActivityIndicator color={theme.color.onBrand} /> : (
              <Text style={styles.primaryText}>CREATE ACCOUNT</Text>
            )}
          </Pressable>

          <Pressable
            testID="go-to-sign-in-button"
            onPress={() => router.replace('/(auth)/sign-in')}
            style={styles.linkRow}
          >
            <Text style={styles.linkDim}>Already have an account? </Text>
            <Text style={styles.link}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: theme.spacing.xl, paddingTop: 60, paddingBottom: 60 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: theme.spacing.xl },
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
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill,
    borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surface,
  },
  chipActive: { borderColor: theme.color.brand, backgroundColor: theme.color.brandTint },
  chipText: { color: theme.color.textDim, fontSize: 12 },
  chipTextActive: { color: theme.color.brand, fontWeight: '600' },
  primary: {
    marginTop: theme.spacing.xl, backgroundColor: theme.color.brand,
    paddingVertical: 14, borderRadius: theme.radius.md, alignItems: 'center',
  },
  primaryText: { color: theme.color.onBrand, fontWeight: '700', letterSpacing: 1.5 },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.lg },
  linkDim: { color: theme.color.textMuted, fontSize: 13 },
  link: { color: theme.color.brand, fontSize: 13, fontWeight: '600' },
  err: { color: theme.color.error, marginTop: 8, fontSize: 12 },
});
