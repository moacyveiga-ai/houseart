// Web build of VaultImage: an <img> cannot send the bearer, so the photo is
// fetched with the Authorization header (same-origin, never the panel cookie)
// and shown from a blob: URL that is revoked when the image unmounts. The token
// travels only in the header, never in a URL.
import { useEffect, useState } from 'react'
import { Image, View, type ImageStyle, type StyleProp } from 'react-native'
import { readToken } from '@/auth/token-store'
import { CLIENT_HEADER } from '@/config'
import { absUrl } from './format'

export function VaultImage({ url, style, label }: { url: string; style: StyleProp<ImageStyle>; label: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const uri = absUrl(url)

  useEffect(() => {
    if (!uri) return
    let live = true
    let objectUrl: string | null = null
    void (async () => {
      try {
        const token = await readToken()
        const headers: Record<string, string> = { ...CLIENT_HEADER }
        if (token) headers.authorization = `Bearer ${token}`
        const res = await fetch(uri, { headers, credentials: 'omit' })
        if (!res.ok) return
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        if (live) setSrc(objectUrl)
        else URL.revokeObjectURL(objectUrl)
      } catch {
        // Placeholder stays: same as the native build when the photo fails.
      }
    })()
    return () => {
      live = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setSrc(null)
    }
  }, [uri])

  if (!src) return <View style={style as never} />
  return <Image accessibilityLabel={label} source={{ uri: src }} style={style} resizeMode="cover" />
}
