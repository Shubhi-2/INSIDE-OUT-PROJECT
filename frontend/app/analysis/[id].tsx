import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Image as RNImage,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, statusColors } from '@/src/theme';
import { useAuth } from '@/src/auth';
import { getProject } from '@/src/firebase/db';

const LAYERS = [
  { key: '1_surface', num: 1, name: 'Surface', desc: 'What am I looking at?' },
  { key: '2_components', num: 2, name: 'Components', desc: 'What are the parts?' },
  { key: '3_connections', num: 3, name: 'Connections', desc: 'How are they connected?' },
  { key: '4_physics', num: 4, name: 'Physics', desc: 'Why does it work?' },
  { key: '5_electronics', num: 5, name: 'Electronics', desc: 'How does signal flow?' },
  { key: '6_software', num: 6, name: 'Software', desc: 'What code / logic?' },
  { key: '7_system', num: 7, name: 'System', desc: 'How does it all fit together?' },
  { key: '8_build', num: 8, name: 'Build', desc: 'Can I recreate it?' },
];

function StatusBadge({ status, confidence }: { status?: string; confidence?: number }) {
  if (!status) return null;
  const color = statusColors[status as keyof typeof statusColors] || theme.color.unknown;
  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: color + '22' }]}>
      <Text style={[styles.badgeText, { color }]}>{status}{confidence != null ? ` · ${confidence}%` : ''}</Text>
    </View>
  );
}

export default function Analysis() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [proj, setProj] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLayer, setExpandedLayer] = useState<string | null>('1_surface');

  useEffect(() => {
    (async () => {
      try {
        if (token && id) {
          const project = await getProject(token, id);
          setProj(project);
        }
      } catch {}
      setLoading(false);
    })();
  }, [id, token]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ActivityIndicator color={theme.color.brand} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }
  if (!proj) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Text style={{ color: theme.color.text, textAlign: 'center', marginTop: 40 }}>Project not found</Text>
      </SafeAreaView>
    );
  }

  const a = proj.analysis || {};
  const obj = a.object || {};

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="analysis-back">
          <Ionicons name="arrow-back" size={22} color={theme.color.text} />
        </Pressable>
        <Text style={styles.brand}>ANALYSIS</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 120 }}>
        {(proj.imageUrl || proj.image_base64) && (
          <RNImage source={{ uri: proj.imageUrl || proj.image_base64 }} style={styles.hero} resizeMode="cover" />
        )}

        <Text style={styles.objName} testID="analysis-object-name">{obj.name || 'Unknown device'}</Text>
        <Text style={styles.oneLiner}>{obj.one_liner}</Text>
        <StatusBadge status={obj.status} confidence={obj.confidence} />

        <Section title="🔎 WHAT I SEE" body={a.what_i_see} />

        {a.components?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧩 COMPONENTS</Text>
            {a.components.map((c: any, i: number) => (
              <View key={i} style={styles.compRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.compName}>{c.name}</Text>
                  <Text style={styles.compPurpose} numberOfLines={2}>{c.purpose}</Text>
                  {(c.voltage || c.typical_cost_usd) ? (
                    <Text style={styles.compMeta}>
                      {c.voltage ? `⚡ ${c.voltage}` : ''}{c.voltage && c.typical_cost_usd ? '  ·  ' : ''}
                      {c.typical_cost_usd ? `💰 ${c.typical_cost_usd}` : ''}
                    </Text>
                  ) : null}
                </View>
                <StatusBadge status={c.status} confidence={c.confidence} />
              </View>
            ))}
          </View>
        )}

        {a.how_it_works?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚡ HOW IT WORKS</Text>
            {a.how_it_works.map((s: any, i: number) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepName}>{s.step}</Text>
                  <Text style={styles.stepDesc}>{s.explanation}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* INSIDE OUT LAYERS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎚 INSIDE OUT LAYERS</Text>
          {LAYERS.map((L) => {
            const content = a.layers?.[L.key];
            const expanded = expandedLayer === L.key;
            return (
              <Pressable
                key={L.key} testID={`layer-${L.num}`}
                style={[styles.layerRow, expanded && styles.layerRowActive]}
                onPress={() => setExpandedLayer(expanded ? null : L.key)}
              >
                <View style={styles.layerNum}><Text style={styles.layerNumText}>{L.num}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.layerName}>{L.name}</Text>
                  <Text style={styles.layerDesc}>{L.desc}</Text>
                  {expanded && content && (
                    <Text style={styles.layerBody}>{content}</Text>
                  )}
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.color.textMuted} />
              </Pressable>
            );
          })}
        </View>

        {a.bom?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.rowSpread}>
              <Text style={styles.sectionTitle}>💰 BILL OF MATERIALS</Text>
              {a.estimated_total_cost_usd ? (
                <Text style={styles.totalCost}>~{a.estimated_total_cost_usd}</Text>
              ) : null}
            </View>
            {a.bom.map((b: any, i: number) => (
              <View key={i} style={styles.bomRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bomName}>{b.component} <Text style={styles.bomQty}>×{b.quantity}</Text></Text>
                  <Text style={styles.bomSpec}>{b.spec}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.bomCost}>{b.cost_usd}</Text>
                  <StatusBadge status={b.status} />
                </View>
              </View>
            ))}
          </View>
        )}

        {a.rebuild_challenge && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎯 REBUILD CHALLENGE</Text>
            <Text style={styles.challengeTitle}>{a.rebuild_challenge.title}</Text>
            <View style={styles.badge}>
              <Text style={[styles.badgeText, { color: theme.color.brand }]}>{a.rebuild_challenge.difficulty}</Text>
            </View>
            {a.rebuild_challenge.steps?.map((s: string, i: number) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <Text style={[styles.stepDesc, { flex: 1 }]}>{s}</Text>
              </View>
            ))}
          </View>
        )}

        {a.safety?.length > 0 && (
          <View style={[styles.section, { borderColor: theme.color.warning }]}>
            <Text style={[styles.sectionTitle, { color: theme.color.warning }]}>⚠️ SAFETY</Text>
            {a.safety.map((s: string, i: number) => (
              <Text key={i} style={styles.safetyText}>• {s}</Text>
            ))}
          </View>
        )}

        {a.cannot_confirm?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>❓ WHAT I CANNOT CONFIRM</Text>
            {a.cannot_confirm.map((s: string, i: number) => (
              <Text key={i} style={styles.safetyText}>• {s}</Text>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating AI Engineer chat button — inset above system nav */}
      <Pressable
        testID="open-ai-chat"
        style={[styles.fab, { bottom: Math.max(insets.bottom, 12) + 12 }]}
        onPress={() => router.push(`/chat/${id}`)}
      >
        <Ionicons name="chatbubbles" size={20} color={theme.color.onBrand} />
        <Text style={styles.fabText}>AI ENGINEER</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Section({ title, body }: { title: string; body?: string }) {
  if (!body) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.color.border,
  },
  brand: { color: theme.color.brand, fontSize: 12, letterSpacing: 2.5, fontWeight: '600' },
  hero: { width: '100%', aspectRatio: 1.4, borderRadius: theme.radius.lg, marginBottom: theme.spacing.lg },
  objName: { color: theme.color.text, fontSize: 24, fontWeight: '700' },
  oneLiner: { color: theme.color.textMuted, fontSize: 13, marginTop: 4, marginBottom: 10 },
  badge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: theme.radius.pill, borderWidth: 1, marginTop: 4,
  },
  badgeText: { fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  section: {
    marginTop: theme.spacing.lg, padding: theme.spacing.lg,
    borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border,
    backgroundColor: theme.color.surface2,
  },
  sectionTitle: { color: theme.color.brand, fontSize: 11, letterSpacing: 2, fontWeight: '600', marginBottom: 10 },
  sectionBody: { color: theme.color.textDim, fontSize: 13, lineHeight: 20 },
  compRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.color.divider,
  },
  compName: { color: theme.color.text, fontSize: 14, fontWeight: '600' },
  compPurpose: { color: theme.color.textMuted, fontSize: 12, marginTop: 2 },
  compMeta: { color: theme.color.textDim, fontSize: 11, marginTop: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: theme.color.brandTint, borderWidth: 1, borderColor: theme.color.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { color: theme.color.brand, fontSize: 12, fontWeight: '700' },
  stepName: { color: theme.color.text, fontSize: 13, fontWeight: '600' },
  stepDesc: { color: theme.color.textDim, fontSize: 12, marginTop: 2, lineHeight: 18 },
  layerRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 12, marginBottom: 8, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surface,
  },
  layerRowActive: { borderColor: theme.color.brand, backgroundColor: theme.color.brandTint },
  layerNum: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: theme.color.brandTint, borderWidth: 1, borderColor: theme.color.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  layerNumText: { color: theme.color.brand, fontSize: 13, fontWeight: '700' },
  layerName: { color: theme.color.text, fontSize: 14, fontWeight: '600' },
  layerDesc: { color: theme.color.textMuted, fontSize: 11, marginTop: 2 },
  layerBody: { color: theme.color.textDim, fontSize: 12, marginTop: 8, lineHeight: 18 },
  rowSpread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalCost: { color: theme.color.brand, fontSize: 13, fontWeight: '700' },
  bomRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.color.divider,
  },
  bomName: { color: theme.color.text, fontSize: 13, fontWeight: '600' },
  bomQty: { color: theme.color.brand, fontSize: 12 },
  bomSpec: { color: theme.color.textMuted, fontSize: 11, marginTop: 2 },
  bomCost: { color: theme.color.text, fontSize: 12, fontWeight: '600' },
  challengeTitle: { color: theme.color.text, fontSize: 15, fontWeight: '600', marginBottom: 8 },
  safetyText: { color: theme.color.textDim, fontSize: 12, marginTop: 4, lineHeight: 18 },
  fab: {
    position: 'absolute', right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.color.brand, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: theme.radius.pill,
    shadowColor: theme.color.brand, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: theme.color.onBrand, fontWeight: '700', letterSpacing: 1.5, fontSize: 12 },
});
