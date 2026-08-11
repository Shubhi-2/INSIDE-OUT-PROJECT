import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { theme } from '@/src/theme';
import { listModels } from '@/src/firebase/ai';

export type ModelInfo = {
  id: string;
  label: string;
  tier: 'flagship' | 'balanced' | 'fast' | 'deep';
  desc: string;
};

let cache: { models: ModelInfo[]; default: string } | null = null;

export async function loadModels(_token?: string | null) {
  if (cache) return cache;
  const j = listModels();
  cache = { models: j.models as ModelInfo[], default: j.default };
  return cache;
}

const TIER_ICON: Record<string, string> = {
  flagship: '✦',
  balanced: '◆',
  fast: '⚡',
  deep: '◈',
};

export function ModelPicker({
  value,
  onChange,
  token: _token,
  compact = false,
  testID = 'model-picker',
}: {
  value: string;
  onChange: (id: string) => void;
  token: string | null;
  compact?: boolean;
  testID?: string;
}) {
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    (async () => {
      const res = await loadModels();
      setModels(res.models);
    })();
  }, []);

  if (!models.length) return null;

  return (
    <View testID={testID}>
      {!compact && (
        <Text style={styles.label}>AI MODEL</Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
      >
        {models.map((m) => {
          const active = value === m.id;
          return (
            <Pressable
              key={m.id}
              testID={`${testID}-${m.id}`}
              onPress={() => onChange(m.id)}
              style={[
                compact ? styles.chipCompact : styles.chip,
                active && styles.chipActive,
              ]}
            >
              <Text style={[styles.tierIcon, active && { color: theme.color.brand }]}>
                {TIER_ICON[m.tier] || '◆'}
              </Text>
              <View>
                <Text style={[styles.chipTitle, active && styles.chipTitleActive]}>
                  {m.label}
                </Text>
                {!compact && (
                  <Text style={[styles.chipDesc, active && { color: theme.color.brand }]}>
                    {m.desc}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: theme.color.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 8,
  },
  chip: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface2,
  },
  chipCompact: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface2,
    height: 32,
  },
  chipActive: {
    borderColor: theme.color.brand,
    backgroundColor: theme.color.brandTint,
  },
  tierIcon: {
    color: theme.color.textMuted,
    fontSize: 14,
  },
  chipTitle: {
    color: theme.color.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTitleActive: {
    color: theme.color.brand,
  },
  chipDesc: {
    color: theme.color.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
});
