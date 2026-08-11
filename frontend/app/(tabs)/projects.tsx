import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/auth';
import { listProjects } from '@/src/firebase/db';

export default function Projects() {
  const router = useRouter();
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (token) setItems(await listProjects(token));
    } catch {}
    setLoading(false);
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.color.brand} />}
      >
        <Text style={styles.brand}>PROJECTS</Text>
        <Text style={styles.title}>Your engineering journal</Text>

        {loading && items.length === 0 ? (
          <ActivityIndicator color={theme.color.brand} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty} testID="projects-empty">
            <Ionicons name="folder-open-outline" size={40} color={theme.color.brand} />
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptyDesc}>Scan a device to create your first project</Text>
            <Pressable style={styles.cta} onPress={() => router.push('/scan?mode=explore')}>
              <Text style={styles.ctaText}>START SCANNING</Text>
            </Pressable>
          </View>
        ) : (
          items.map((p) => (
            <Pressable
              key={p.id}
              testID={`project-item-${p.id}`}
              style={styles.row}
              onPress={() => router.push(`/analysis/${p.id}`)}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="cube-outline" size={20} color={theme.color.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.rowDesc} numberOfLines={1}>{p.description}</Text>
                <Text style={styles.rowDate}>{new Date(p.updated_at).toLocaleDateString()}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.color.textMuted} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  brand: { color: theme.color.brand, fontSize: 11, letterSpacing: 3, fontWeight: '600' },
  title: { color: theme.color.text, fontSize: 22, fontWeight: '600', marginTop: 2, marginBottom: theme.spacing.lg },
  empty: { alignItems: 'center', padding: theme.spacing.xl, marginTop: 40 },
  emptyTitle: { color: theme.color.text, fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyDesc: { color: theme.color.textMuted, fontSize: 12, marginTop: 4, marginBottom: 16 },
  cta: { backgroundColor: theme.color.brand, paddingHorizontal: 20, paddingVertical: 12, borderRadius: theme.radius.md },
  ctaText: { color: theme.color.onBrand, fontWeight: '700', letterSpacing: 1.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: theme.spacing.md, marginBottom: 10,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border,
    backgroundColor: theme.color.surface2,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: theme.color.brandTint, borderWidth: 1, borderColor: theme.color.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  rowName: { color: theme.color.text, fontSize: 14, fontWeight: '600' },
  rowDesc: { color: theme.color.textMuted, fontSize: 11, marginTop: 2 },
  rowDate: { color: theme.color.textMuted, fontSize: 10, marginTop: 2 },
});
