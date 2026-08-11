import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '@/src/theme';

const IDEAS = [
  { icon: 'flash-outline', name: 'Electric Bell', desc: 'Electromagnet + armature + hammer' },
  { icon: 'car-outline', name: 'Toy Car', desc: 'DC motor + driver + microcontroller' },
  { icon: 'radio-outline', name: 'Remote Control', desc: 'IR LED + microcontroller + buttons' },
  { icon: 'bulb-outline', name: 'LED Circuit', desc: 'Battery + resistor + LED' },
  { icon: 'thermometer-outline', name: 'Temperature Sensor', desc: 'Sensor → ADC → MCU → display' },
  { icon: 'wifi-outline', name: 'Wi-Fi Router', desc: 'SoC + RF frontend + antennas' },
];

export default function Explore() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}>
        <Text style={styles.brand}>EXPLORE</Text>
        <Text style={styles.title}>Technologies to understand</Text>
        <Text style={styles.sub}>Tap a concept to scan a similar device and see it broken down</Text>

        <View style={styles.grid}>
          {IDEAS.map((it) => (
            <Pressable
              key={it.name}
              testID={`explore-${it.name.toLowerCase().replace(/\s+/g, '-')}`}
              style={styles.card}
              onPress={() => router.push('/scan?mode=explore')}
            >
              <View style={styles.iconBox}>
                <Ionicons name={it.icon as any} size={22} color={theme.color.brand} />
              </View>
              <Text style={styles.cardName}>{it.name}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{it.desc}</Text>
            </Pressable>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48%', padding: theme.spacing.lg,
    borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border,
    backgroundColor: theme.color.surface2, marginBottom: 10,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: theme.color.brandTint, borderWidth: 1, borderColor: theme.color.brand,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  cardName: { color: theme.color.text, fontSize: 14, fontWeight: '600' },
  cardDesc: { color: theme.color.textMuted, fontSize: 11, marginTop: 4 },
});
