import { useLocalSearchParams } from 'expo-router'
import { ConversationScreen } from '@/screens/ConversationScreen'
import { ErrorState } from '@/ui/kit'

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) return <ErrorState message="Conversa não encontrada." />
  return <ConversationScreen key={n} id={n} />
}
