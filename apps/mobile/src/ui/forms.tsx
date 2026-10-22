// Form and sheet pieces shared by the market and community screens: labelled
// input, radio/check cards, key·value rows, step segments, bottom sheet.
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '@/theme'
import { Icon, IconButton, type IconName } from './kit'

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return <Text style={styles.label}>{children}{hint ? <Text style={styles.hint}> · {hint}</Text> : null}</Text>
}

export function Input({ error, ...props }: TextInputProps & { error?: boolean }) {
  return <TextInput placeholderTextColor={theme.fgDisabled} {...props} style={[styles.input, error && { borderColor: theme.error }, props.multiline && styles.multiline, props.style]} />
}

/** The prototype's selectable card: radio or check on the left, name + sub, an optional value on the right. */
export function OptionCard({ on, name, sub, right, icon, onPress, check, disabled }: { on: boolean; name: string; sub?: string; right?: string; icon?: IconName; onPress: () => void; check?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole={check ? 'checkbox' : 'radio'} accessibilityState={{ checked: on, disabled }} disabled={disabled} onPress={onPress} style={[styles.card, on && styles.cardOn, disabled && { opacity: 0.5 }]}>
      <Icon name={check ? (on ? 'check-box' : 'check-box-outline-blank') : on ? 'radio-button-checked' : 'radio-button-unchecked'} size={22} />
      {icon ? <Icon name={icon} size={22} /> : null}
      <View style={{ flex: 1 }}><Text style={styles.cardName}>{name}</Text>{sub ? <Text style={styles.cardSub}>{sub}</Text> : null}</View>
      {right ? <Text style={styles.cardRight}>{right}</Text> : null}
    </Pressable>
  )
}

export function KeyValue({ k, v, bold, onEdit }: { k: string; v: string; bold?: boolean; onEdit?: () => void }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvK}>{k}</Text>
      <Text style={[styles.kvV, bold && { fontWeight: '600' }]}>{v}</Text>
      {onEdit ? <Pressable accessibilityRole="button" onPress={onEdit} hitSlop={6}><Text style={styles.edit}>Editar</Text></Pressable> : null}
    </View>
  )
}

/** The step bars of the prototype ("Passo N de M" with filled segments). */
export function Segments({ total, current }: { total: number; current: number }) {
  return <View style={styles.segs}>{Array.from({ length: total }, (_, i) => <View key={i} style={[styles.seg, i < current && { backgroundColor: theme.fg }]} />)}</View>
}

export function Toggle({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress} style={[styles.sw, { backgroundColor: on ? theme.success : theme.fgDisabled, justifyContent: on ? 'flex-end' : 'flex-start' }]}>
      <View style={styles.swKnob} />
    </Pressable>
  )
}

/** A bottom sheet over the screen (the prototype's `sheet`): title, close, scrollable body, optional fixed footer. */
export function BottomSheet({ open, title, onClose, children, footer, height = '86%' }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; height?: `${number}%` }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} style={styles.scrim} />
      <View style={[styles.sheet, { height, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.sheetHead}><Text style={styles.sheetTitle}>{title}</Text><IconButton name="close" label="Fechar" onPress={onClose} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>{children}</ScrollView>
        {footer ? <View style={styles.sheetFoot}>{footer}</View> : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: theme.fg },
  hint: { fontWeight: '400', color: theme.fgMuted },
  input: { minHeight: 46, borderWidth: 1, borderColor: theme.fgDisabled, borderRadius: theme.radiusSm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: theme.fg, backgroundColor: theme.bg },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: theme.radiusMd, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg },
  cardOn: { borderColor: theme.fg, backgroundColor: theme.surface },
  cardName: { fontSize: 14, fontWeight: '600', color: theme.fg },
  cardSub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  cardRight: { fontSize: 13, fontWeight: '600', color: theme.fg },
  kv: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  kvK: { fontSize: 13, color: theme.fgMuted, width: 118 },
  kvV: { flex: 1, fontSize: 14, color: theme.fg },
  edit: { fontSize: 13, fontWeight: '600', color: theme.fg, textDecorationLine: 'underline' },
  segs: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: theme.border },
  sw: { width: 44, height: 26, borderRadius: 13, padding: 3 },
  swKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.bg },
  scrim: { flex: 1, backgroundColor: 'rgba(17,17,17,.45)' },
  sheet: { backgroundColor: theme.bg, borderTopLeftRadius: theme.radiusLg, borderTopRightRadius: theme.radiusLg },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 6, height: 52, borderBottomWidth: 1, borderBottomColor: theme.border },
  sheetTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.fg },
  sheetBody: { padding: 16, gap: 12 },
  sheetFoot: { padding: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border, gap: 8 },
})
