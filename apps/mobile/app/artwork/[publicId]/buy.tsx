import { useLocalSearchParams } from 'expo-router'
import { CheckoutScreen } from '@/screens/market/CheckoutScreen'

export default function Buy() {
  const { publicId } = useLocalSearchParams<{ publicId: string }>()
  return <CheckoutScreen publicId={String(publicId ?? '').toUpperCase()} />
}
