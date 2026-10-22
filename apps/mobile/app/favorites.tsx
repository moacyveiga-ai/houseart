import { useLocalSearchParams } from 'expo-router'
import { FavoritesScreen } from '@/screens/FavoritesScreen'

export default function Favorites() {
  const { tab } = useLocalSearchParams<{ tab?: string }>()
  return <FavoritesScreen initialTab={tab === 'liked' ? 'liked' : 'saved'} />
}
