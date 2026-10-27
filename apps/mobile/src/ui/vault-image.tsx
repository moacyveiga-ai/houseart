// An image that lives behind a scoped route (the private vault: chat photos, packaging photos):
// the request carries the bearer, like every API call of the app.
import { useEffect, useState } from 'react'
import { Image, View, type ImageStyle, type StyleProp } from 'react-native'
import { readToken } from '@/auth/token-store'
import { absUrl } from './format'

export function VaultImage({ url, style, label }: { url: string; style: StyleProp<ImageStyle>; label: string }) {
  const [token, setToken] = useState<string | null | undefined>(undefined)
  useEffect(() => { let live = true; void readToken().then((t) => { if (live) setToken(t) }); return () => { live = false } }, [])
  const uri = absUrl(url)
  if (token === undefined || !uri) return <View style={style as never} />
  return <Image accessibilityLabel={label} source={{ uri, headers: token ? { authorization: `Bearer ${token}` } : undefined }} style={style} resizeMode="cover" />
}
