// "Adicionar cartão" (handoff App Colecionador › sheet `cartao`): número,
// validade, CVC, nome impresso, CEP da fatura, "tornar padrão". The server
// validates (Luhn, brand, expiry) and keeps only brand + last4; the masks
// here are the prototype's `onNcNum` / `onNcExp` / `onNcCep`.
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { addCard } from '@/api/market'
import type { PaymentMethodView } from '@/api/types'
import { theme } from '@/theme'
import { Icon } from './kit'
import { Button, ErrorText } from './primitives'

const brandOf = (d: string) => (/^3[47]/.test(d) ? 'amex' : /^4/.test(d) ? 'visa' : /^(5[1-5]|2[2-7])/.test(d) ? 'mastercard' : /^(606282|3841)/.test(d) ? 'hipercard' : '')
export const maskCardNumber = (raw: string) => { const d = raw.replace(/\D/g, ''); const amex = brandOf(d) === 'amex'; const digits = d.slice(0, amex ? 15 : 16); const groups = amex ? [4, 6, 5] : [4, 4, 4, 4]; const parts: string[] = []; let j = 0; for (const g of groups) { if (j < digits.length) parts.push(digits.slice(j, j + g)); j += g } return parts.join(' ') }
export const maskExpiry = (raw: string) => { const d = raw.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }
export const maskCep = (raw: string) => { const d = raw.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d }

export function CardForm({ holder, firstCard, onSaved, onCancel }: { holder: string; firstCard: boolean; onSaved: (m: PaymentMethodView) => void; onCancel?: () => void }) {
  const [form, setForm] = useState({ number: '', exp: '', cvc: '', holder: holder.toUpperCase(), cep: '', makeDefault: firstCard })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (p: Partial<typeof form>) => { setForm((f) => ({ ...f, ...p })); setError(null) }
  async function save() {
    if (busy) return
    setBusy(true); setError(null)
    try { onSaved(await addCard({ number: form.number, exp: form.exp, cvc: form.cvc, holder: form.holder, cep: form.cep }, form.makeDefault)) }
    catch (e) { setError((e as Error).message || 'Não foi possível guardar o cartão.') }
    finally { setBusy(false) }
  }
  return (
    <View style={styles.box}>
      <Text style={styles.label}>Número do cartão</Text>
      <TextInput value={form.number} onChangeText={(v) => set({ number: maskCardNumber(v) })} inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" placeholderTextColor={theme.fgDisabled} style={styles.input} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}><Text style={styles.label}>Validade</Text><TextInput value={form.exp} onChangeText={(v) => set({ exp: maskExpiry(v) })} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" placeholderTextColor={theme.fgDisabled} style={styles.input} /></View>
        <View style={{ flex: 1 }}><Text style={styles.label}>CVC</Text><TextInput value={form.cvc} onChangeText={(v) => set({ cvc: v.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" autoComplete="cc-csc" placeholder="123" placeholderTextColor={theme.fgDisabled} secureTextEntry style={styles.input} /></View>
      </View>
      <Text style={styles.label}>Nome impresso</Text>
      <TextInput value={form.holder} onChangeText={(v) => set({ holder: v.toUpperCase() })} autoComplete="cc-name" autoCapitalize="characters" placeholder="NOME NO CARTÃO" placeholderTextColor={theme.fgDisabled} style={styles.input} />
      <Text style={styles.label}>CEP da fatura</Text>
      <TextInput value={form.cep} onChangeText={(v) => set({ cep: maskCep(v) })} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" placeholderTextColor={theme.fgDisabled} style={styles.input} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.makeDefault }} onPress={() => set({ makeDefault: !form.makeDefault })} style={styles.check}>
        <Icon name={form.makeDefault ? 'check-box' : 'check-box-outline-blank'} size={22} />
        <Text style={styles.checkText}>Usar como cartão padrão</Text>
      </Pressable>
      <ErrorText>{error}</ErrorText>
      <Button title="Salvar cartão" loading={busy} onPress={() => void save()} />
      {onCancel ? <Button title="Cancelar" variant="ghost" onPress={onCancel} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: 8, padding: 12, borderRadius: theme.radiusMd, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg },
  label: { fontSize: 12, fontWeight: '600', color: theme.fgMuted },
  input: { height: 46, borderWidth: 1, borderColor: theme.fgDisabled, borderRadius: theme.radiusSm, paddingHorizontal: 12, fontSize: 16, color: theme.fg, backgroundColor: theme.bg },
  row: { flexDirection: 'row', gap: 10 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  checkText: { fontSize: 14, color: theme.fg },
})
