// The design system in code (handoff 2026-10-21, Fase 1): every component of
// `houseart-design/handoff/designs/HouseArt Design System.dc.html` in every
// state, so a screen of the prototype and this page can be compared side by
// side. Public, no data, no session.
import type { Metadata } from 'next'
import { DesignSystemGallery } from '@/components/design-system/DesignSystemGallery'

export const metadata: Metadata = { title: 'Design System — HouseArt', robots: { index: false } }

export default function DesignSystemPage() {
  return <DesignSystemGallery />
}
