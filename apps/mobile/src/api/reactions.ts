// Like / save on an artwork: POST /api/community/reactions (the server is the authority).
import { api } from './client'

export type ReactionKind = 'LIKE' | 'SAVE'

export async function toggleArtworkReaction(artworkId: number, kind: ReactionKind): Promise<boolean> {
  const r = await api<{ ok: boolean; on: boolean; count: number }>('/api/community/reactions', { body: { target: 'ARTWORK', targetId: artworkId, kind } })
  return !!r.on
}

export const reactionToast = (kind: ReactionKind, on: boolean): string =>
  kind === 'SAVE' ? (on ? 'Salva nos favoritos' : 'Removida dos favoritos') : on ? 'Curtida' : 'Curtida removida'
