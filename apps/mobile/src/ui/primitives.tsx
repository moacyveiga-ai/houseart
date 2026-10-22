import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type TextInputProps } from 'react-native'
import { theme } from '@/theme'

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return <Text style={styles.error} accessibilityRole="alert">{children}</Text>
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={theme.fgMuted} {...props} style={[styles.field, props.style]} />
}

export function Button({ title, variant = 'primary', loading, disabled, ...rest }: PressableProps & { title: string; variant?: 'primary' | 'ghost' | 'danger'; loading?: boolean }) {
  const off = disabled || loading
  return (
    <Pressable accessibilityRole="button" disabled={off} {...rest}
      style={({ pressed }) => [styles.btn, variant === 'primary' && styles.btnPrimary, variant === 'ghost' && styles.btnGhost, variant === 'danger' && styles.btnDanger, off && styles.btnOff, pressed && styles.btnPressed]}>
      {loading ? <ActivityIndicator color={variant === 'primary' ? theme.fg : theme.fgMuted} /> : <Text style={[styles.btnText, variant === 'ghost' && styles.btnTextGhost, variant === 'danger' && styles.btnTextDanger]}>{title}</Text>}
    </Pressable>
  )
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: 24, gap: 12 },
  centered: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '600', color: theme.fg, marginBottom: 4 },
  muted: { fontSize: 14, color: theme.fgMuted, lineHeight: 20 },
  error: { fontSize: 14, color: theme.error },
  field: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, color: theme.fg, borderRadius: theme.radiusSm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  btn: { borderRadius: theme.radiusSm, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  btnPrimary: { backgroundColor: theme.accent },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.error },
  btnOff: { opacity: 0.5 },
  btnPressed: { opacity: 0.8 },
  btnText: { fontSize: 16, fontWeight: '600', color: theme.fg },
  btnTextGhost: { color: theme.fgBody, fontWeight: '500' },
  btnTextDanger: { color: theme.error, fontWeight: '500' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 12 },
  rowLabel: { color: theme.fgMuted, fontSize: 14 },
  rowValue: { color: theme.fg, fontSize: 14, flexShrink: 1, textAlign: 'right' },
})
