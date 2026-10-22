import { useLocalSearchParams } from 'expo-router'
import { OfferStatusScreen } from '@/screens/market/OfferStatusScreen'

export default function Offer() {
  const { code } = useLocalSearchParams<{ code: string }>()
  return <OfferStatusScreen code={String(code ?? '').toUpperCase()} />
}
