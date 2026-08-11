import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';

export default function Build() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Text style={styles.brand}>BUILD</Text>
        <Text style={styles.title}>Test your build</Text>
        <Text style={styles.sub}>Upload photos of your rebuild. AI compares against the original and flags issues.</Text>

        <Pressable testID="start-build-test" style={styles.cta} onPress={() => router.push('/scan?mode=verify')}>
          <Ionicons name="camera" size={20} color={theme.color.onBrand} />
          <Text style={styles.ctaText}>UPLOAD BUILD PHOTO</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>How verification works</Text>
          {[
            'Upload multiple angles (front, back, close-up)',
            'AI compares visible components with the original BOM',
            'Flags missing / wrong components, polarity, alignment',
            'Clear separation of Observed / Inferred / Unknown',
          ].map((t, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <Text style={styles.stepText}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  brand: { color: theme.color.brand, fontSize: 11, letterSpacing: 3, fontWeight: '600' },
  title: { color: theme.color.text, fontSize: 22, fontWeight: '600', marginTop: 2 },
  sub: { color: theme.color.textMuted, fontSize: 12, marginTop: 4, marginBottom: theme.spacing.lg },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.color.brand, paddingVertical: 14, borderRadius: theme.radius.md,
    marginBottom: theme.spacing.lg,
  },
  ctaText: { color: theme.color.onBrand, fontWeight: '700', letterSpacing: 1.5 },
  card: {
    backgroundColor: theme.color.surface2, borderRadius: theme.radius.lg,
    padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.color.border,
  },
  cardTitle: { color: theme.color.text, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: theme.color.brandTint, borderWidth: 1, borderColor: theme.color.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { color: theme.color.brand, fontSize: 11, fontWeight: '700' },
  stepText: { color: theme.color.textDim, fontSize: 13, flex: 1, lineHeight: 18 },
});
