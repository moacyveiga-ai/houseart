// Native share sheet of the artwork's public page.
import { Share } from 'react-native'
import { API_URL } from '@/config'

export async function shareArtwork(a: { publicId: string; title: string; artist: string }): Promise<void> {
  const url = `${API_URL}/e/artwork/${a.publicId}`
  try { await Share.share({ message: `${a.title} — ${a.artist}\n${url}`, url, title: a.title }) } catch { /* the person closed the sheet */ }
}
