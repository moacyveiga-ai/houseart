// Admin › Auditoria — pure rules: the filters the desk types, the labels of entities and actions,
// where each entity opens, and the row the screen reads. The audit item
// (docs/audit-ux-2026-10-25/web-app.md §5) asked for the trail that was written but had no screen.

export const ENTITY_LABELS: Record<string, string> = {
  artwork: 'Obra', certificate: 'Certificado', review_item: 'Fila de revisão', deal: 'Negócio', deal_split: 'Repasse', offer: 'Proposta', offer_rules: 'Regras de ofertas',
  user: 'Conta', auth: 'Acesso', member: 'Membro', team_invite: 'Convite de equipe', artist: 'Artista', kyc_verification: 'KYC', ownership_transfer: 'Transferência',
  stripe_connect_account: 'Conta Stripe', payment_method: 'Forma de pagamento', payout_account: 'Pix de recebimento', plan_subscription: 'Plano', order: 'Pedido',
  marker_batch: 'Lote de etiquetas', marker_order: 'Pedido de kit', news_article: 'Notícia', agenda_event: 'Agenda', content_image: 'Imagem do site',
  artist_profile: 'Perfil do artista', gallery_public_profile: 'Perfil da galeria', appraisal: 'Laudo', appraisal_request: 'Pedido de laudo',
}
export const ACTION_LABELS: Record<string, string> = {
  create: 'criou', update: 'alterou', delete: 'apagou', approve: 'aprovou', reject: 'reprovou', revalidate: 'pediu nova verificação',
  block: 'bloqueou', unblock: 'desbloqueou', profile: 'trocou o papel', password_link: 'enviou link de senha', invite_resent: 'reenviou convite',
  split_paid_manually: 'marcou repasse como pago', transfer: 'transferiu pela Stripe', transfer_unrecorded: 'transferência sem registro', login: 'entrou', logout: 'saiu', login_failed: 'falhou ao entrar',
  assign: 'atribuiu avaliador', take: 'assumiu', due: 'mudou o prazo', cancel: 'cancelou', issue: 'emitiu',
}
export const ORIGIN_LABELS: Record<string, string> = { ui: 'tela', api: 'API', job: 'rotina', webhook: 'webhook', 'public-link': 'link público' }

export const PAGE_SIZE = 50
export const MAX_RANGE_DAYS = 92

export interface AuditQuery { entity: string; entityId: string; action: string; who: string; from: string; to: string; page: number }

/** `who` as a number only when it fits an INT4 id (`#42` or `42`); anything else is a name. */
export const whoIdOf = (who: string): number | null => { const m = /^#?(\d{1,9})$/.exec(who); return m ? Number(m[1]) : null }

const clean = (v: string | undefined, max: number) => (v ?? '').trim().slice(0, max)
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v)

/** The URL → the query: text filters trimmed, days validated, the page ≥ 1. */
export function parseQuery(sp: Record<string, string | undefined>): AuditQuery {
  const from = clean(sp.from, 10), to = clean(sp.to, 10)
  const page = Math.max(1, Math.min(200, Number.parseInt(sp.page ?? '1', 10) || 1))
  return { entity: clean(sp.entity, 40).toLowerCase(), entityId: clean(sp.id, 60), action: clean(sp.action, 40).toLowerCase(), who: clean(sp.who, 80), from: isDay(from) ? from : '', to: isDay(to) ? to : '', page }
}

export const queryString = (q: Partial<AuditQuery>) => {
  const p = new URLSearchParams()
  if (q.entity) p.set('entity', q.entity); if (q.entityId) p.set('id', q.entityId); if (q.action) p.set('action', q.action); if (q.who) p.set('who', q.who)
  if (q.from) p.set('from', q.from); if (q.to) p.set('to', q.to); if (q.page && q.page > 1) p.set('page', String(q.page))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export interface AuditRow {
  id: number; at: string; entity: string; entityLabel: string; entityId: string; action: string; actionLabel: string
  who: string | null; whoId: number | null; origin: string; originLabel: string; ip: string | null
  /** The stored JSON of before/after (already free of PII by the writers' rule): a preview for the closed row, the text (capped) for the open one. */
  before: string | null; after: string | null; beforeFull: string | null; afterFull: string | null
  href: string | null
}

/** Where the entity opens for the desk, when a screen exists (the artwork has no desk screen yet: the inventory ignores `?open=` for the team). */
export function hrefOf(entity: string, entityId: string): string | null {
  const id = /^\d+$/.test(entityId) ? entityId : null
  switch (entity) {
    case 'user': return id ? `/admin/users?q=%23${id}` : null
    case 'deal': case 'deal_split': return '/admin/deals?f=all'
    case 'kyc_verification': return '/admin/kyc?f=all'
    case 'review_item': return '/admin/review'
    case 'marker_batch': case 'marker_order': return '/admin/markers'
    case 'news_article': case 'agenda_event': return '/admin/content'
    default: return null
  }
}

export const FULL_TEXT_MAX = 4000
/** The stored JSON, shortened for the row (the open row shows up to FULL_TEXT_MAX). */
export function compact(json: string | null, max = 160): string | null {
  if (!json) return null
  const s = json.replace(/\s+/g, ' ')
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/** The day boundaries of the filter in the house's time zone; a range wider than MAX_RANGE_DAYS is cut from the end. */
export function rangeOf(q: Pick<AuditQuery, 'from' | 'to'>, now: Date): { from: Date | null; to: Date | null; cut: boolean } {
  const from = q.from ? new Date(`${q.from}T00:00:00-03:00`) : null
  let to = q.to ? new Date(`${q.to}T23:59:59.999-03:00`) : null
  let cut = false
  if (from && to && to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) { to = new Date(from.getTime() + MAX_RANGE_DAYS * 86_400_000); cut = true }
  if (from && from > now) return { from, to: from, cut }
  return { from, to, cut }
}

export interface AuditPage { rows: AuditRow[]; total: number; page: number; pages: number; cut: boolean; kpis: { today: number; week: number; entities: { entity: string; label: string; count: number }[] } }
