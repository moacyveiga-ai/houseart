// Conteúdo do site (equipe da casa): notícias e agenda da Home e de /e/news.
import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { canEditPublicContent } from '@/lib/auth'
import { listAgendaForEditor, listNewsForEditor } from '@/lib/public-content/editor-server'
import { Tabs } from '@/components/ds/Tabs'
import { NewsEditor } from '@/components/content-editor/NewsEditor'
import { AgendaEditor } from '@/components/content-editor/AgendaEditor'
import '@/components/content-editor/content-editor.css'

export const metadata = { title: 'Conteúdo do site — HouseArt' }

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user } = await requirePanelPage('/admin/content')
  if (!canEditPublicContent(user)) notFound()
  const tab = (await searchParams).tab === 'agenda' ? 'agenda' : 'news'
  const [news, events] = await Promise.all([listNewsForEditor(), listAgendaForEditor()])
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Conteúdo do site</h1></div>
      <Tabs active={tab} items={[
        { key: 'news', label: 'Notícias', href: '/admin/content', count: news.length },
        { key: 'agenda', label: 'Agenda', href: '/admin/content?tab=agenda', count: events.length },
      ]} />
      {tab === 'news' ? <NewsEditor initial={news} /> : <AgendaEditor initial={events} />}
    </div>
  )
}
