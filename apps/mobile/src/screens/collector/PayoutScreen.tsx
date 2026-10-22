// Pix para receber vendas (handoff "HouseArt App Colecionador" › sheet `pix`,
// and the web PayoutAccountScreen): registered = the card with the masked key,
// "Trocar chave" and "Remover"; not registered = the form — the four key types
// (CPF · E-mail · Celular · Aleatória), the field with the prototype's masks,
// a hint to paste the random key (no clipboard module in this build) and
// "Cadastrar chave Pix". The server checks the
// key against the holder's own CPF and answers only the mask. Shared by the
// collector (Carteira, Vender) and by the gallery's "Pix para repasses".
// GET/PUT/DELETE /api/member/payout-account (401 = no seller member yet).
import { useCallback, useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSession } from '@/auth/session'
import { ApiError } from '@/api/client'
import { payoutAccount, removePayoutAccount, savePayoutAccount, type PayoutAccount, type PixKeyType } from '@/api/collector'
import { colors, theme } from '@/theme'
import { Input, Label, OptionCard } from '@/ui/forms'
import { Display, Icon, Loading, Toast, TopBar } from '@/ui/kit'
import { Button, ErrorText } from '@/ui/primitives'
import { PIX_TYPES, PIX_TYPE_LABEL, pixKeyInput, pixKeyProblem } from './collector-core'

export function PayoutScreen() {
  const insets = useSafeAreaInsets()
  const { me } = useSession()
  const [state, setState] = useState<'loading' | 'no-member' | 'ready'>('loading')
  const [account, setAccount] = useState<PayoutAccount | null>(null)
  const [editing, setEditing] = useState(false)
  const [type, setType] = useState<PixKeyType>('CPF')
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  useEffect(() => {
    let alive = true
    payoutAccount()
      .then((a) => { if (!alive) return; setAccount(a); setEditing(a === null); setState('ready') })
      .catch((e: unknown) => { if (!alive) return; if (e instanceof ApiError && e.status === 401) setState('no-member'); else { setError((e as Error).message); setEditing(true); setState('ready') } })
    return () => { alive = false }
  }, [])

  const t = PIX_TYPES.find((x) => x.key === type)!
  async function save() {
    if (busy || !key.trim()) return
    const local = pixKeyProblem(type, key)
    if (local) { setError(local); return }
    setBusy(true); setError(null)
    try {
      const a = await savePayoutAccount(type, key.trim(), me?.name ?? '')
      setAccount(a); setEditing(false); setKey('')
      setToast('Chave Pix confirmada no seu nome · pronta para receber')
    } catch (e) { setError((e as Error).message || 'Não foi possível cadastrar a chave.') } finally { setBusy(false) }
  }
  function remove() {
    Alert.alert('Remover chave Pix', 'Sem chave, as vendas não têm para onde ser pagas.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => void (async () => {
        try { await removePayoutAccount(); setAccount(null); setEditing(true); setType('CPF'); setKey(''); setToast('Chave Pix removida · cadastre outra para receber vendas') } catch (e) { setToast((e as Error).message) }
      })() },
    ])
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.fill, { paddingTop: insets.top }]}>
      <TopBar title="Pix para receber vendas" />
      {state === 'loading' ? <Loading /> : state === 'no-member' ? (
        <View style={styles.body}>
          <View style={styles.callout}><Icon name="info-outline" size={20} /><Text style={styles.calloutText}>A chave Pix é de quem vende. Ela aparece aqui depois que você cadastra a primeira obra na sua coleção.</Text></View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>{account ? 'Troque a chave onde você recebe o valor das vendas. Repasses em andamento vão para a chave anterior.' : 'É para esta chave que enviamos o valor das suas vendas, depois que o comprador confirma a entrega.'}</Text>
          {account && !editing ? (
            <View style={styles.saved}>
              <View style={styles.savedHead}>
                <View style={styles.savedIcon}><Icon name="account-balance" size={20} color={colors.verified500} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedK}>Chave Pix · {PIX_TYPE_LABEL[account.pixKeyType] ?? account.pixKeyType}</Text>
                  <Display size={18} line={24}>{account.pixKeyMask}</Display>
                  <Text style={styles.savedSub}>{account.holderName} · titular verificado</Text>
                </View>
              </View>
              <View style={styles.savedActions}>
                <View style={{ flex: 1 }}><Button title="Trocar chave" variant="ghost" onPress={() => { setEditing(true); setType('CPF'); setKey(''); setError(null) }} /></View>
                <View style={{ flex: 1 }}><Button title="Remover" variant="danger" onPress={remove} /></View>
              </View>
            </View>
          ) : (<>
            <Label>Tipo de chave</Label>
            <View style={styles.types}>
              {PIX_TYPES.map((x) => <View key={x.key} style={styles.typeCell}><OptionCard on={type === x.key} icon={x.icon} name={x.name} onPress={() => { setType(x.key); setKey(''); setError(null) }} /></View>)}
            </View>
            <Label>{t.label}</Label>
            <Input value={key} onChangeText={(v) => { setKey(pixKeyInput(type, v)); setError(null) }} placeholder={t.placeholder} keyboardType={t.keyboard} autoCapitalize="none" autoCorrect={false} error={!!error} />
            {type === 'RANDOM' ? <Text style={styles.noteText}>Copie a chave no app do seu banco e cole no campo (toque e segure).</Text> : null}
            <ErrorText>{error}</ErrorText>
            <View style={styles.note}><Icon name="verified-user" size={16} color={theme.fgMuted} /><Text style={styles.noteText}>A chave precisa estar no seu nome. Conferimos o titular antes de salvar; o número completo fica cifrado.</Text></View>
            <Button title={account ? 'Salvar nova chave' : 'Cadastrar chave Pix'} disabled={!key.trim()} loading={busy} onPress={() => void save()} />
            {account ? <Button title="Cancelar" variant="ghost" onPress={() => { setEditing(false); setError(null) }} /> : null}
          </>)}
        </ScrollView>
      )}
      <Toast message={toast} onDone={clearToast} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { padding: 16, gap: 12, paddingBottom: 32 },
  lead: { fontSize: 14, lineHeight: 20, color: theme.fgMuted },
  callout: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: theme.radiusMd, backgroundColor: theme.surface },
  calloutText: { flex: 1, fontSize: 13, lineHeight: 19, color: theme.fgBody },
  saved: { gap: 14, padding: 14, borderRadius: theme.radiusMd, borderWidth: 1, borderColor: theme.border },
  savedHead: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  savedIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.verified100, alignItems: 'center', justifyContent: 'center' },
  savedK: { fontSize: 12, fontWeight: '600', color: theme.fgMuted },
  savedSub: { fontSize: 12, color: theme.fgMuted },
  savedActions: { flexDirection: 'row', gap: 8 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeCell: { width: '48%', flexGrow: 1 },
  note: { flexDirection: 'row', gap: 6 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.fgMuted },
})
