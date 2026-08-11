export const theme = {
  color: {
    surface: '#090D14',
    surface2: '#151B23',
    surface3: '#212836',
    text: '#F8FAFC',
    textDim: '#CBD5E1',
    textMuted: '#94A3B8',
    brand: '#00E5FF',
    brandDim: '#00B8D4',
    brandTint: 'rgba(0, 229, 255, 0.12)',
    onBrand: '#090D14',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
    unknown: '#64748B',
    border: '#30363D',
    borderStrong: '#00E5FF',
    divider: '#1F2937',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 4, md: 8, lg: 16, pill: 999 },
  font: {
    display: 'System',
    body: 'System',
  },
};

export const statusColors = {
  VERIFIED: theme.color.brand,
  INFERRED: theme.color.warning,
  ESTIMATED: theme.color.warning,
  UNKNOWN: theme.color.unknown,
};
