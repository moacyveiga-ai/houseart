'use client'
// Admin › Auditoria: the filter form (GET, state in the URL), one row per record (when, who did
// what to which entity, from where) with the before/after on demand, and the pager.
import { useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Badge } from '@/components/ds/Badge'
import { ENTITY_LABELS, queryString, type AuditPage, type AuditQuery, type AuditRow } from '@/lib/admin-audit/core'

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Bahia', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const ENTITIES = Object.entries(ENTITY_LABELS).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))

export function AuditAdmin({ query, page }: { query: AuditQuery; page: AuditPage }) {
  const [open, setOpen] = useState<number | null>(null)
  const link = (p: number) => `/admin/audit${queryString({ ...query, page: p })}`
  return (
    <div className="ha-audit">
      <form className="ha-audit__filters" method="get" role="search">
        <label className="ha-audit__field">Entidade
          <select name="entity" className="ha-select ha-select--sm" defaultValue={query.entity}>
            <option value="">todas</option>
            {ENTITIES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="ha-audit__field">Id<input name="id" className="ha-input ha-audit__input" defaultValue={query.entityId} placeholder="da entidade" /></label>
        <label className="ha-audit__field">Ação<input name="action" className="ha-input ha-audit__input" defaultValue={query.action} placeholder="ex.: approve" /></label>
        <label className="ha-audit__field">Quem<input name="who" className="ha-input ha-audit__input" defaultValue={query.who} placeholder="nome ou #id" /></label>
        <label className="ha-audit__field">De<input name="from" type="date" className="ha-input ha-audit__input" defaultValue={query.from} /></label>
        <label className="ha-audit__field">Até<input name="to" type="date" className="ha-input ha-audit__input" defaultValue={query.to} /></label>
        <div className="ha-audit__buttons">
          <button type="submit" className="ha-btn ha-btn--primary ha-btn--sm"><Icon name="filter_list" size={18} />Filtrar</button>
          <Link href="/admin/audit" className="ha-btn ha-btn--ghost ha-btn--sm">Limpar</Link>
        </div>
      </form>
      {page.cut ? <p className="ha-muted ha-sm">O período foi limitado a 92 dias a partir da data inicial.</p> : null}
      <div className="ha-audit__list">
        {page.rows.length === 0 ? <p className="ha-empty">Nenhum registro neste filtro.</p> : null}
        {page.rows.map((r: AuditRow) => {
          const ab = open === r.id
          return (
            <article key={r.id} className="ha-audit__row">
              <button type="button" className="ha-audit__head" aria-expanded={ab} onClick={() => setOpen(ab ? null : r.id)}>
                <span className="ha-audit__when">{when(r.at)}</span>
                <span className="ha-audit__what"><b>{r.who ?? (r.origin === 'ui' ? 'alguém sem nome' : r.originLabel)}</b> {r.actionLabel} <span className="ha-audit__entity">{r.entityLabel} #{r.entityId}</span>{r.after ? <span className="ha-audit__preview"> · {r.after}</span> : null}</span>
                <span className="ha-audit__meta"><Badge tone="soft">{r.originLabel}</Badge>{r.action !== r.actionLabel ? null : <Badge tone="neutral">{r.action}</Badge>}</span>
                <Icon name={ab ? 'expand_less' : 'expand_more'} size={22} />
              </button>
              {ab ? (
                <div className="ha-audit__body">
                  <dl className="ha-audit__facts">
                    <div><dt>Ação</dt><dd><code>{r.action}</code> em <code>{r.entity}</code>{r.href ? <> · <Link href={r.href} className="ha-link">abrir</Link></> : null}</dd></div>
                    <div><dt>Quem</dt><dd>{r.who ?? '—'}{r.whoId ? <> · <Link href={`/admin/users?q=%23${r.whoId}`} className="ha-link">conta #{r.whoId}</Link></> : null}{r.ip ? ` · ${r.ip}` : ''}</dd></div>
                    {r.beforeFull ? <div><dt>Antes</dt><dd><code className="ha-audit__json">{r.beforeFull}</code></dd></div> : null}
                    {r.afterFull ? <div><dt>Depois</dt><dd><code className="ha-audit__json">{r.afterFull}</code></dd></div> : null}
                  </dl>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
      {page.pages > 1 ? (
        <nav className="ha-audit__pager" aria-label="Páginas">
          {page.page > 1 ? <Link href={link(page.page - 1)} className="ha-btn ha-btn--outline ha-btn--sm"><Icon name="chevron_left" size={18} />Mais recentes</Link> : <span />}
          <span className="ha-muted ha-sm">página {page.page} de {page.pages}</span>
          {page.page < page.pages ? <Link href={link(page.page + 1)} className="ha-btn ha-btn--outline ha-btn--sm">Mais antigos<Icon name="chevron_right" size={18} /></Link> : <span />}
        </nav>
      ) : null}
    </div>
  )
}
