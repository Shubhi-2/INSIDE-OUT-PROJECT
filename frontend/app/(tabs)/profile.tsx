import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/auth';
import { ModelPicker } from '@/src/components/ModelPicker';
import { DEFAULT_GEMINI_MODEL } from '@/src/firebase/models';

export default function Profile() {
  const { user, token, signOut, updatePreferences, deleteAccount: removeAccount } = useAuth();
  const level = Math.max(1, Math.floor((user?.xp ?? 0) / 100) + 1);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savingModel, setSavingModel] = useState(false);
  const [prefModel, setPrefModel] = useState<string>(user?.preferred_model || DEFAULT_GEMINI_MODEL);

  const updateModel = async (id: string) => {
    setPrefModel(id);
    setSavingModel(true);
    try {
      await updatePreferences({ preferred_model: id });
    } catch {}
    setSavingModel(false);
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setErr(null);
    try {
      await removeAccount();
    } catch {
      setErr('Failed to delete account. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}>
        <Text style={styles.brand}>PROFILE</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || 'E').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name} testID="profile-name">{user?.name || 'Engineer'}</Text>
          <Text style={styles.email} testID="profile-email">{user?.email}</Text>
          <View style={styles.badge}>
            <Ionicons name="ribbon-outline" size={12} color={theme.color.brand} />
            <Text style={styles.badgeText}>{user?.experience_level || 'Beginner'}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label="XP" value={user?.xp ?? 0} />
          <Stat label="Projects" value={user?.projects_count ?? 0} />
          <Stat label="Level" value={level} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>DEFAULT AI MODEL</Text>
            {savingModel && <ActivityIndicator size="small" color={theme.color.brand} />}
          </View>
          <Text style={styles.sectionHint}>Used for image analysis and AI Engineer chat</Text>
          <ModelPicker
            value={prefModel}
            onChange={updateModel}
            token={token}
            testID="profile-model-picker"
          />
        </View>

        <Pressable testID="sign-out-button" style={styles.signOut} onPress={signOut}>
          <Ionicons name="log-out-outline" size={18} color={theme.color.error} />
          <Text style={styles.signOutText}>SIGN OUT</Text>
        </Pressable>

        {!confirming ? (
          <Pressable
            testID="delete-account-button"
            style={styles.deleteBtn}
            onPress={() => setConfirming(true)}
          >
            <Ionicons name="trash-outline" size={16} color={theme.color.textMuted} />
            <Text style={styles.deleteText}>Delete account</Text>
          </Pressable>
        ) : (
          <View style={styles.confirmBox} testID="delete-account-confirm">
            <Text style={styles.confirmTitle}>Delete your account?</Text>
            <Text style={styles.confirmDesc}>
              This permanently removes your profile, projects and chat history. This cannot be undone.
            </Text>
            {err && <Text style={styles.err}>{err}</Text>}
            <View style={styles.confirmRow}>
              <Pressable
                testID="delete-account-cancel"
                style={[styles.confirmBtn, styles.confirmCancel]}
                onPress={() => setConfirming(false)}
                disabled={deleting}
              >
                <Text style={styles.confirmCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                testID="delete-account-confirm-button"
                style={[styles.confirmBtn, styles.confirmDelete]}
                onPress={deleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmDeleteText}>DELETE FOREVER</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.footer}>INSIDE OUT · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  brand: { color: theme.color.brand, fontSize: 11, letterSpacing: 3, fontWeight: '600', marginBottom: theme.spacing.md },
  card: {
    alignItems: 'center', padding: theme.spacing.xl, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surface2,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: theme.color.brandTint, borderWidth: 2, borderColor: theme.color.brand,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { color: theme.color.brand, fontSize: 28, fontWeight: '700' },
  name: { color: theme.color.text, fontSize: 18, fontWeight: '600' },
  email: { color: theme.color.textMuted, fontSize: 12, marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill,
    backgroundColor: theme.color.brandTint, borderWidth: 1, borderColor: theme.color.brand,
    marginTop: 10,
  },
  badgeText: { color: theme.color.brand, fontSize: 11, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: theme.spacing.lg },
  statBox: {
    flex: 1, paddingVertical: 16, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surface2,
    alignItems: 'center',
  },
  statVal: { color: theme.color.brand, fontSize: 22, fontWeight: '700' },
  statLabel: { color: theme.color.textMuted, fontSize: 10, letterSpacing: 1.5, marginTop: 2 },
  section: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface2,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: theme.color.brand, fontSize: 11, letterSpacing: 2, fontWeight: '600' },
  sectionHint: { color: theme.color.textMuted, fontSize: 11, marginTop: 4, marginBottom: 12 },
  signOut: {
    marginTop: theme.spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.error,
  },
  signOutText: { color: theme.color.error, fontWeight: '700', letterSpacing: 1.5 },
  deleteBtn: {
    marginTop: theme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
  },
  deleteText: { color: theme.color.textMuted, fontSize: 12 },
  confirmBox: {
    marginTop: theme.spacing.md, padding: theme.spacing.lg, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.color.error, backgroundColor: theme.color.surface2,
  },
  confirmTitle: { color: theme.color.error, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  confirmDesc: { color: theme.color.textDim, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  confirmRow: { flexDirection: 'row', gap: 10 },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: theme.radius.md, alignItems: 'center' },
  confirmCancel: { borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surface },
  confirmCancelText: { color: theme.color.text, fontWeight: '600', letterSpacing: 1, fontSize: 12 },
  confirmDelete: { backgroundColor: theme.color.error },
  confirmDeleteText: { color: '#fff', fontWeight: '700', letterSpacing: 1, fontSize: 12 },
  err: { color: theme.color.error, fontSize: 12, marginBottom: 8 },
  footer: { color: theme.color.textMuted, fontSize: 10, textAlign: 'center', marginTop: theme.spacing.xxl, letterSpacing: 1 },
});
