// The calls of the App Artista (Início, Nova obra · câmera guiada, Vincular
// etiqueta, Carteira de escrituras, Avisos). Thin wrappers over `api()`: the
// server decides every rule (what a draft needs to be submitted, whether a
// tap is valid, whether a simulated tap is allowed here).
import { api, apiUpload, type LocalFile } from './client'
import type { ArtworkStatus } from './gallery'

/** GET /api/artist/home → { ok, home } */
export interface ArtistKpi { label: string; value: string; note?: string }
export interface ArtistAction { icon: string; title: string; subtitle: string; href: string }
export interface ArtistWork { id: number; title: string; year: number | null; artistName: string; status: ArtworkStatus; publicId: string | null; coverUrl: string | null }
export interface ArtistHome { dateLabel: string; name: string; initials: string; kpis: ArtistKpi[]; actions: ArtistAction[]; recent: ArtistWork[] }

/** GET /api/artist/certificates → { ok, items, orders } */
export type CertAction = 'WAIT_MARKER' | 'LINK_IN_APP' | 'SIGN' | 'ISSUE' | 'VIEW'
export interface CertItem { artworkId: number; certificateId: number | null; title: string; publicId: string | null; coverUrl: string | null; status: ArtworkStatus; stage: number; stageLabel: string; action: CertAction; actionLabel: string; version: number | null }
export interface MarkerOrderRow { id: number; quantity: number; status: string; createdAt: string }
export interface Certificates { items: CertItem[]; orders: MarkerOrderRow[] }

/** GET /api/artist/artworks/[id]/link → the head of "Vincular etiqueta". */
export interface LinkHead { artwork: { id: number; title: string; status: ArtworkStatus; publicId: string | null }; certificateId: number | null; signed: boolean; issued: boolean; simulateAllowed: boolean }

/** GET /api/artworks/[id] — only what the native wizard reads. */
export interface DraftArtwork {
  id: number; title: string; year: number | null; technique: string | null; status: ArtworkStatus
  heightMm: number | null; widthMm: number | null; depthMm: number | null
  media: { id: number; kind: string; publicUrl: string | null; quality: string | null }[]
  duplicateChecks: { id: number; similarityBps: number; candidate: { id: number; title: string; year: number | null; publicId: string | null } }[]
}

export interface UploadedMedia { media: { id: number; kind: string; publicUrl: string | null; quality: string | null }; duplicates: { id: number; candidateArtworkId: number; similarityBps: number }[] }
export interface ReadingResult { mode: string; filled: string[]; applied: Record<string, unknown>; toast: string }

/** GET /api/notifications → { unread, items } */
export interface NotificationRow { id: number; kind: string; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string }
export interface NotificationsList { unread: number; items: NotificationRow[] }

export const createDraft = async (title?: string): Promise<number> => (await api<{ id: number }>('/api/artworks', { body: { title: title || undefined } })).id
export const loadDraft = (id: number): Promise<DraftArtwork> => api<DraftArtwork>(`/api/artworks/${id}`)
export const patchDraft = (id: number, body: Record<string, unknown>): Promise<unknown> => api(`/api/artworks/${id}`, { method: 'PATCH', body })
export const uploadPhoto = (id: number, kind: string, file: LocalFile): Promise<UploadedMedia> => apiUpload<UploadedMedia>(`/api/artworks/${id}/media`, { kind }, file)
export const readPhotos = (id: number): Promise<ReadingResult> => api<ReadingResult>(`/api/artworks/${id}/read-photos`, { method: 'POST', body: {} })
export const decideDuplicate = (id: number, checkId: number, decision: 'DIFFERENT' | 'SAME'): Promise<unknown> => api(`/api/artworks/${id}/duplicates/${checkId}`, { body: { decision } })
export const submitDraft = (id: number): Promise<unknown> => api(`/api/artworks/${id}/submit`, { method: 'POST', body: {} })

export const linkHead = (artworkId: number): Promise<LinkHead> => api<LinkHead>(`/api/artist/artworks/${artworkId}/link`)
/** POST /api/markers/link — a real SUN read, or (dev only, the server decides) a simulated tap by UID. */
export const linkMarker = (body: { uid: string; ctr: number; cmac: string; artworkId: number } | { uid: string; artworkId: number; simulate: true }): Promise<{ ok: boolean; publicId: string; certificateId: number }> => api('/api/markers/link', { body })
export const signCertificate = (certificateId: number): Promise<unknown> => api(`/api/certificates/${certificateId}/sign`, { method: 'POST', body: {} })

export const markRead = (id: number): Promise<unknown> => api(`/api/notifications/${id}/read`, { method: 'POST', body: {} })
export const markAllRead = (): Promise<unknown> => api('/api/notifications', { method: 'POST', body: {} })
