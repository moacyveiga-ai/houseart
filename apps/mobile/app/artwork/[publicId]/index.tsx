import { useLocalSearchParams } from 'expo-router'
import { ArtworkScreen } from '@/screens/ArtworkScreen'

export default function Artwork() {
  const { publicId, mine } = useLocalSearchParams<{ publicId: string; mine?: string }>()
  return <ArtworkScreen publicId={String(publicId ?? '').toUpperCase()} mine={mine === '1'} />
}
