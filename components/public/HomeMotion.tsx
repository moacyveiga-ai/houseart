'use client'
// The scroll motion of the Home prototype (Home.js › update()): parallax by
// `data-speed`, hero zoom by `data-zoom`, hero fade-out by `data-out` and the
// fade-in of blocks by `data-fade`, driven by one requestAnimationFrame per
// scroll/resize. `prefers-reduced-motion` turns everything off (the CSS gives
// every element its resting state). Renders nothing; works on `[data-home-motion]`.
import { useEffect } from 'react'

const INTENSITY = 1

function update(root: HTMLElement) {
  const vh = window.innerHeight
  root.querySelectorAll<HTMLElement>('[data-speed]').forEach((el) => {
    const parent = el.parentElement
    if (!parent) return
    const p = parent.getBoundingClientRect()
    if (p.bottom < -vh || p.top > vh * 2) return
    const c = p.top + p.height / 2 - vh / 2
    el.style.translate = `0 ${(c * parseFloat(el.dataset.speed ?? '0') * INTENSITY).toFixed(1)}px`
  })
  root.querySelectorAll<HTMLElement>('[data-zoom]').forEach((el) => {
    const s = el.closest('section')
    if (!s) return
    const p = s.getBoundingClientRect()
    const prog = Math.min(1, Math.max(0, -p.top / p.height))
    el.style.scale = (1.05 + prog * 0.18 * INTENSITY).toFixed(4)
  })
  root.querySelectorAll<HTMLElement>('[data-out]').forEach((el) => {
    const s = el.closest('section')
    if (!s) return
    const p = s.getBoundingClientRect()
    el.style.opacity = Math.max(0, 1 - -p.top / (vh * 0.55)).toFixed(3)
  })
  root.querySelectorAll<HTMLElement>('[data-fade]').forEach((el) => {
    const r = el.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (vh * 0.9 - r.top) / (vh * 0.45)))
    el.style.opacity = (0.12 + 0.88 * t).toFixed(3)
    el.style.translate = `0 ${((1 - t) * 40).toFixed(1)}px`
  })
}

export function HomeMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-home-motion]')
    if (!root) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduced.matches) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; update(root) })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    update(root)
    const t = setTimeout(() => update(root), 400)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
      clearTimeout(t)
      root.querySelectorAll<HTMLElement>('[data-speed],[data-zoom],[data-out],[data-fade]').forEach((el) => { el.style.translate = ''; el.style.scale = ''; el.style.opacity = '' })
    }
  }, [])
  return null
}
