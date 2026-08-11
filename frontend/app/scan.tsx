import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/auth';
import { ModelPicker } from '@/src/components/ModelPicker';
import { DEFAULT_GEMINI_MODEL } from '@/src/firebase/models';
import { analyzeAndSaveProject } from '@/src/firebase/projects';

type Mode = 'explore' | 'reverse' | 'verify';

const MODE_META: Record<Mode, { title: string; sub: string }> = {
  explore: { title: 'Scan Something', sub: 'Point at a device — AI reveals what\'s inside' },
  reverse: { title: 'Reverse Engineer', sub: 'AI generates a rebuild pathway from the image' },
  verify:  { title: 'Test My Build',  sub: 'Upload your build — AI compares to the original' },
};

export default function Scan() {
  const { mode = 'explore' } = useLocalSearchParams<{ mode?: Mode }>();
  const router = useRouter();
  const { user, token } = useAuth();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [model, setModel] = useState<string>(user?.preferred_model || DEFAULT_GEMINI_MODEL);
  const meta = MODE_META[(mode as Mode) || 'explore'];

  const pick = async (source: 'camera' | 'library') => {
    setErr(null);
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setErr('Permission denied'); return; }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    };
    const res = source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setImageUri(res.assets[0].uri);
  };

  const analyze = async () => {
    if (!imageUri || !token) return;
    setLoading(true); setErr(null);
    setStatus('Preparing image...');
    try {
      const j = await analyzeAndSaveProject({
        uid: token,
        imageUri,
        experienceLevel: user?.experience_level || 'Beginner',
        model,
        preferredModel: user?.preferred_model,
        onStatus: setStatus,
      });
      router.replace(`/analysis/${j.project_id}`);
    } catch (e: any) {
      setErr(e?.message || 'AI analysis failed. Try another image.');
      setLoading(false);
      setStatus(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="scan-back" hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={theme.color.text} />
        </Pressable>
        <Text style={styles.brand}>{meta.title.toUpperCase()}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Text style={styles.subtitle}>{meta.sub}</Text>

        <View style={styles.previewBox}>
          {imageUri ? (
            <RNImage source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
          ) : (
            <View style={styles.previewEmpty}>
              <Ionicons name="scan-outline" size={64} color={theme.color.brand} />
              <Text style={styles.previewText}>No image selected</Text>
              <Text style={styles.previewHint}>Take a photo or upload from gallery</Text>
            </View>
          )}
          <View style={styles.corner1} />
          <View style={styles.corner2} />
          <View style={styles.corner3} />
          <View style={styles.corner4} />
        </View>

        <View style={styles.actionRow}>
          <Pressable testID="scan-camera" style={styles.actBtn} onPress={() => pick('camera')} disabled={loading}>
            <Ionicons name="camera" size={20} color={theme.color.brand} />
            <Text style={styles.actText}>CAMERA</Text>
          </Pressable>
          <Pressable testID="scan-gallery" style={styles.actBtn} onPress={() => pick('library')} disabled={loading}>
            <Ionicons name="images" size={20} color={theme.color.brand} />
            <Text style={styles.actText}>GALLERY</Text>
          </Pressable>
        </View>

        {imageUri && !loading && (
          <View style={{ marginTop: theme.spacing.lg }}>
            <ModelPicker value={model} onChange={setModel} token={token} testID="scan-model-picker" />
            <Pressable testID="scan-analyze" style={styles.primary} onPress={analyze}>
              <Ionicons name="sparkles" size={18} color={theme.color.onBrand} />
              <Text style={styles.primaryText}>ANALYZE WITH AI</Text>
            </Pressable>
          </View>
        )}

        {loading && (
          <View style={styles.loadingBox} testID="scan-loading">
            <ActivityIndicator color={theme.color.brand} />
            <Text style={styles.loadingText}>{status || 'Analyzing...'}</Text>
            <Text style={styles.loadingHint}>Gemini is inspecting your image</Text>
          </View>
        )}

        {err && <Text style={styles.err} testID="scan-error">{err}</Text>}

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>TIPS FOR BETTER RESULTS</Text>
          {['Good lighting', 'Show internal parts if possible', 'Fill the frame with the device', 'Take multiple angles later'].map((t) => (
            <View key={t} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const CORNER = 22;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.color.border,
  },
  brand: { color: theme.color.brand, fontSize: 12, letterSpacing: 2.5, fontWeight: '600' },
  subtitle: { color: theme.color.textMuted, fontSize: 13, marginBottom: theme.spacing.lg },
  previewBox: {
    aspectRatio: 1, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border,
    backgroundColor: theme.color.surface2, overflow: 'hidden', position: 'relative',
  },
  preview: { width: '100%', height: '100%' },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewText: { color: theme.color.text, fontSize: 14, fontWeight: '600', marginTop: 12 },
  previewHint: { color: theme.color.textMuted, fontSize: 11, marginTop: 4 },
  corner1: { position: 'absolute', top: 8, left: 8, width: CORNER, height: CORNER, borderTopWidth: 2, borderLeftWidth: 2, borderColor: theme.color.brand },
  corner2: { position: 'absolute', top: 8, right: 8, width: CORNER, height: CORNER, borderTopWidth: 2, borderRightWidth: 2, borderColor: theme.color.brand },
  corner3: { position: 'absolute', bottom: 8, left: 8, width: CORNER, height: CORNER, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: theme.color.brand },
  corner4: { position: 'absolute', bottom: 8, right: 8, width: CORNER, height: CORNER, borderBottomWidth: 2, borderRightWidth: 2, borderColor: theme.color.brand },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: theme.spacing.lg },
  actBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.brand, backgroundColor: theme.color.brandTint,
  },
  actText: { color: theme.color.brand, fontWeight: '600', letterSpacing: 1.5, fontSize: 12 },
  primary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: theme.spacing.lg, backgroundColor: theme.color.brand,
    paddingVertical: 14, borderRadius: theme.radius.md,
  },
  primaryText: { color: theme.color.onBrand, fontWeight: '700', letterSpacing: 1.5 },
  loadingBox: {
    marginTop: theme.spacing.lg, alignItems: 'center', padding: theme.spacing.lg,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.brand,
    backgroundColor: theme.color.brandTint,
  },
  loadingText: { color: theme.color.brand, fontSize: 13, fontWeight: '600', marginTop: 8, letterSpacing: 1 },
  loadingHint: { color: theme.color.textMuted, fontSize: 11, marginTop: 4 },
  err: { color: theme.color.error, marginTop: 10, fontSize: 12, textAlign: 'center' },
  tips: {
    marginTop: theme.spacing.xl, padding: theme.spacing.lg,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border,
    backgroundColor: theme.color.surface2,
  },
  tipsTitle: { color: theme.color.textMuted, fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  tipDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.color.brand },
  tipText: { color: theme.color.textDim, fontSize: 12 },
});
