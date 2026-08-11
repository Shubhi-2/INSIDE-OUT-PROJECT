import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/auth';
import { listProjects } from '@/src/firebase/db';

type Project = { id: string; name: string; description: string; updated_at: string };

export default function Home() {
  const router = useRouter();
  const { user, token, refresh } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (token) setProjects(await listProjects(token));
      await refresh();
    } catch {}
    setLoading(false);
  }, [token, refresh]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.color.brand} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>INSIDE OUT</Text>
            <Text style={styles.hello} testID="home-greeting">
              Hello, {user?.name || 'Engineer'}
            </Text>
          </View>
          <View style={styles.xpBox}>
            <Text style={styles.xpLabel}>XP</Text>
            <Text style={styles.xpValue} testID="home-xp">{user?.xp ?? 0}</Text>
          </View>
        </View>

        <Text style={styles.tagline}>What do you want to understand today?</Text>

        {/* Primary Actions */}
        <ActionCard
          testID="action-scan"
          icon="camera-outline"
          title="Scan Something"
          desc="Point at a device — AI reveals what's inside"
          onPress={() => router.push('/scan?mode=explore')}
        />
        <ActionCard
          testID="action-reverse"
          icon="git-network-outline"
          title="Reverse Engineer"
          desc="Understand it, then rebuild it step-by-step"
          onPress={() => router.push('/scan?mode=reverse')}
        />
        <ActionCard
          testID="action-test-build"
          icon="checkmark-done-outline"
          title="Test My Build"
          desc="Compare your build against the original"
          onPress={() => router.push('/scan?mode=verify')}
        />

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox label="Projects" value={user?.projects_count ?? 0} />
          <StatBox label="XP" value={user?.xp ?? 0} />
          <StatBox label="Level" value={Math.max(1, Math.floor((user?.xp ?? 0) / 100) + 1)} />
        </View>

        {/* Recent projects */}
        <Text style={styles.sectionTitle}>CONTINUE LEARNING</Text>
        {loading && projects.length === 0 ? (
          <ActivityIndicator color={theme.color.brand} style={{ marginTop: 20 }} />
        ) : projects.length === 0 ? (
          <View style={styles.emptyBox} testID="home-empty-projects">
            <Ionicons name="scan-outline" size={40} color={theme.color.brand} />
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptyDesc}>Scan your first device to get started</Text>
          </View>
        ) : (
          projects.slice(0, 5).map((p) => (
            <Pressable
              key={p.id}
              testID={`home-project-${p.id}`}
              style={styles.projectRow}
              onPress={() => router.push(`/analysis/${p.id}`)}
            >
              <View style={styles.projectDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.projectName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.projectDesc} numberOfLines={1}>{p.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.color.textMuted} />
            </Pressable>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionCard({ icon, title, desc, onPress, testID }: any) {
  return (
    <Pressable testID={testID} style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]} onPress={onPress}>
      <LinearGradient
        colors={['rgba(0,229,255,0.14)', 'rgba(0,229,255,0.02)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={22} color={theme.color.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDesc}>{desc}</Text>
      </View>
      <Ionicons name="arrow-forward" size={20} color={theme.color.brand} />
    </Pressable>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  scroll: { padding: theme.spacing.lg, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: theme.color.brand, fontSize: 11, letterSpacing: 3, fontWeight: '600' },
  hello: { color: theme.color.text, fontSize: 22, fontWeight: '600', marginTop: 2 },
  xpBox: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.md,
    backgroundColor: theme.color.brandTint, borderWidth: 1, borderColor: theme.color.brand,
    alignItems: 'center',
  },
  xpLabel: { color: theme.color.brand, fontSize: 9, letterSpacing: 1.5 },
  xpValue: { color: theme.color.text, fontSize: 16, fontWeight: '700' },
  tagline: { color: theme.color.textMuted, fontSize: 13, marginTop: theme.spacing.lg, marginBottom: theme.spacing.md },
  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: theme.spacing.lg, marginBottom: theme.spacing.md,
    borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border,
    backgroundColor: theme.color.surface2, overflow: 'hidden',
  },
  actionIcon: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: theme.color.brandTint, borderWidth: 1, borderColor: theme.color.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: { color: theme.color.text, fontSize: 15, fontWeight: '600' },
  actionDesc: { color: theme.color.textMuted, fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: theme.spacing.md, marginBottom: theme.spacing.lg },
  statBox: {
    flex: 1, paddingVertical: 14, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surface2,
    alignItems: 'center',
  },
  statValue: { color: theme.color.brand, fontSize: 20, fontWeight: '700' },
  statLabel: { color: theme.color.textMuted, fontSize: 10, letterSpacing: 1.5, marginTop: 2 },
  sectionTitle: { color: theme.color.textMuted, fontSize: 11, letterSpacing: 2, marginTop: theme.spacing.md, marginBottom: theme.spacing.md },
  emptyBox: {
    alignItems: 'center', padding: theme.spacing.xl, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surface2,
  },
  emptyTitle: { color: theme.color.text, fontSize: 15, fontWeight: '600', marginTop: 8 },
  emptyDesc: { color: theme.color.textMuted, fontSize: 12, marginTop: 4 },
  projectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border,
    backgroundColor: theme.color.surface2,
  },
  projectDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.brand },
  projectName: { color: theme.color.text, fontSize: 14, fontWeight: '600' },
  projectDesc: { color: theme.color.textMuted, fontSize: 11, marginTop: 2 },
});
