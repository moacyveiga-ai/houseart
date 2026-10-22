import { useLocalSearchParams } from 'expo-router'
import { OfferScreen } from '@/screens/market/OfferScreen'

export default function Offer() {
  const { publicId } = useLocalSearchParams<{ publicId: string }>()
  return <OfferScreen publicId={String(publicId ?? '').toUpperCase()} />
}
