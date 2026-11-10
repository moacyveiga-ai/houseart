// Layout audit (manual): every page × profile × viewport (1440 · 1280 · 768 · 390 · 360). Measures horizontal
// page scroll, elements past the right edge, text spilling or clipped without ellipsis, words broken mid-word,
// button text wrapped to two lines, .ha-btn heights off the 32/40/48 scale and side-by-side buttons of different
// heights. Writes <outdir>/results.json and a full-page screenshot of every page with a finding.
//
// Needs the local dev server with the demo data: scripts/demo/accounts.sql → scripts/demo/scenario.mjs →
// scripts/demo/content.sql (see scripts/demo/README.md). The page list uses the ids/codes the demo creates on a
// fresh database; adjust PROFILES if yours differ.
//
//   node scripts/layout-audit.manual.mjs /tmp/audit [onlyPathSubstring]
//   AUDIT_BASE_URL=http://localhost:3019 PLAYWRIGHT_CHROMIUM_PATH=… node scripts/layout-audit.manual.mjs /tmp/audit
//
// Expected leftovers: 44 px topbar/menu buttons on the phone (tap targets), two-line option cards (title +
// subtitle) and the .ha-sr screen-reader texts (clipped by design).
import { chromium } from 'playwright'
import fs from 'node:fs'
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:3019'
const OUT = process.argv[2]
const ONLY = process.argv[3] || ''
const PW = 'Demo-HouseArt-2026'

const PUBLIC = ['/e', '/e/how-it-works', '/e/marketplace', '/e/artists', '/e/artwork/HA-2026-K6QE-H3V1', '/e/artist/joana-teixeira-demo', '/e/galleries', '/e/gallery/galeria-ladeira-demo', '/e/guide', '/e/help', '/e/news', '/e/news/colecionadores-jovens-demo', '/verify', '/verify/HA-2026-K6QE-H3V1', '/login', '/signup', '/recover-password', '/install', '/terms', '/privacy', '/design-system', '/simulator']
const PROFILES = {
  admin: { email: 'admin@local.dev', password: 'admin123', pages: ['/admin/review', '/admin/review/1', '/admin/review/artworks', '/admin/users', '/admin/kyc', '/admin/deals', '/admin/transfers', '/admin/tenants', '/admin/audit', '/admin/ops', '/admin/catalog', '/admin/content', '/admin/markers', '/appraisals', '/billing', '/search?q=joana', '/account', '/notifications'] },
  artist: { email: 'joana.demo@houseart.test', pages: ['/', '/artworks', '/artworks/new', '/artworks/1/edit', '/certification', '/certification/link/3', '/sales', '/royalty', '/billing', '/profile/public', '/community', '/messages', '/notifications', '/account', '/account/devices', '/account/receipts', '/marketplace', '/crm', '/transfer', '/search?q=mar', '/instagram'] },
  gallery: { email: 'ana.demo@houseart.test', pages: ['/', '/artworks', '/artworks?open=6', '/artworks/6/listing', '/artworks/register', '/sales', '/sales?tab=deals', '/sales/rules', '/sales/payout', '/gallery/account', '/gallery/account/data', '/gallery/team', '/gallery/artists', '/gallery/public', '/certification', '/community', '/messages', '/billing', '/crm', '/marketplace', '/royalty'] },
  advisor: { email: 'helena.demo@houseart.test', pages: ['/', '/artworks', '/sales', '/gallery/account', '/community'] },
  collector: { email: 'marina.demo@houseart.test', pages: ['/explore', '/wallet', '/wallet?own=2', '/wallet/cards', '/wallet/register', '/favorites', '/purchases', '/purchases/offer/OFR-2026-000001', '/sales', '/community', '/community/news/colecionadores-jovens-demo', '/messages', '/messages/1', '/account', '/account?view=data', '/account/addresses', '/notifications', '/search?q=joana', '/e/artwork/HA-2026-K6QE-H3V1/offer', '/e/artwork/HA-2026-K6QE-H3V1/buy', '/e/offer/OFR-2026-000001'] },
  appraiser: { email: 'rui.demo@houseart.test', pages: ['/appraisals', '/account'] },
}
const VIEWPORTS = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'laptop', width: 1280, height: 800 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'mobile', width: 390, height: 844 }, { name: 'small', width: 360, height: 740 }]

function probe() {
  const vw = window.innerWidth
  const out = []
  const sel = (el) => { let s = el.tagName.toLowerCase(); const c = [...el.classList].filter((x) => !x.startsWith('__')).slice(0, 3).join('.'); if (c) s += '.' + c; return s }
  const path = (el) => { const a = []; let e = el; for (let i = 0; e && i < 3; i++, e = e.parentElement) a.unshift(sel(e)); return a.join(' > ') }
  const txt = (el) => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70)
  const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0 }
  const clippedByAncestor = (el) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.overflowX !== 'visible' || cs.overflow !== 'visible') { const pr = e.getBoundingClientRect(); if (pr.right <= vw + 1) return true } if (cs.position === 'fixed') return false } return false }
  const de = document.scrollingElement || document.documentElement
  if (de.scrollWidth > vw + 1) out.push({ t: 'hscroll', s: 'page', x: `${de.scrollWidth}px > ${vw}px` })
  const all = [...document.querySelectorAll('body *')].filter((el) => !el.closest('[aria-hidden="true"], [inert], nextjs-portal, script, style, svg'))
  // past the right edge (top-most offender only)
  const offenders = new Set()
  for (const el of all) {
    if (!visible(el)) continue
    const r = el.getBoundingClientRect()
    if (r.right > vw + 2 && r.left < vw && !clippedByAncestor(el)) {
      if (el.parentElement && offenders.has(el.parentElement)) { offenders.add(el); continue }
      offenders.add(el); out.push({ t: 'offscreen', s: path(el), x: `right ${Math.round(r.right)} > ${vw}`, txt: txt(el) })
    }
  }
  // text spilling / clipped without ellipsis
  for (const el of all) {
    if (!visible(el)) continue
    const tag = el.tagName
    const textual = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
    if (!textual) continue
    if (['TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'PRE', 'CODE'].includes(tag)) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'inline') continue
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      if (cs.textOverflow === 'ellipsis') continue
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll')) continue
      out.push({ t: cs.overflowX === 'hidden' || cs.overflow === 'hidden' ? 'clipped' : 'spill', s: path(el), x: `${el.scrollWidth} > ${el.clientWidth}`, txt: txt(el) })
    }
  }
  // words broken across lines
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n, words = 0
  const range = document.createRange()
  const brokenSeen = new Set()
  while ((n = walker.nextNode()) && words < 6000) {
    const p = n.parentElement
    if (!p || p.closest('[aria-hidden="true"], [inert], script, style, svg, nextjs-portal, textarea, .material-symbols-rounded, .ha-icon')) continue
    if (!visible(p)) continue
    const s = n.textContent
    const re = /[^\s\-–—/·]{4,}/g
    let m
    while ((m = re.exec(s))) {
      words++
      range.setStart(n, m.index); range.setEnd(n, m.index + m[0].length)
      const rects = [...range.getClientRects()].filter((r) => r.width > 0.5)
      if (rects.length > 1) {
        const tops = new Set(rects.map((r) => Math.round(r.top)))
        if (tops.size > 1) { const k = path(p) + '|' + m[0]; if (!brokenSeen.has(k)) { brokenSeen.add(k); out.push({ t: 'brokenword', s: path(p), txt: m[0] }) } }
      }
    }
  }
  // buttons: wrapped text and heights off the 32/40/48 scale
  const btns = [...document.querySelectorAll('.ha-btn, button, [role="button"], a.hp-btn-ink, a.hp-btn-paper, a[class*="btn"]')].filter((b) => visible(b) && !b.closest('[aria-hidden="true"], [inert]'))
  for (const b of btns) {
    const r = b.getBoundingClientRect()
    const t = txt(b)
    if (t.length >= 2) {
      // lines of TEXT only (icons excluded), merged by vertical overlap
      const rects = []
      const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT)
      let tn
      while ((tn = tw.nextNode())) {
        if (!tn.textContent.trim() || tn.parentElement.closest('.material-symbols-rounded, .ha-icon, .ha-avatar, [aria-hidden="true"]')) continue
        const rg = document.createRange(); rg.selectNodeContents(tn)
        for (const x of rg.getClientRects()) if (x.width > 1) rects.push(x)
      }
      const lines = []
      for (const x of rects.sort((a, c) => a.top - c.top)) { const mid = (x.top + x.bottom) / 2; if (!lines.some((l) => mid > l.top && mid < l.bottom)) lines.push({ top: x.top, bottom: x.bottom }) }
      if (lines.length > 1 && (b.classList.contains('ha-btn') || b.tagName === 'BUTTON' && b.innerText.trim().split(/\s+/).length <= 4)) out.push({ t: 'btnwrap', s: path(b), x: `h ${Math.round(r.height)} lines ${lines.length}`, txt: t })
    }
    out.push({ t: 'btnsize', s: [...b.classList].filter((c) => /btn|act|opt/.test(c)).join('.') || b.tagName.toLowerCase(), x: String(Math.round(r.height)), txt: t.slice(0, 30), quiet: true })
    if (b.classList.contains('ha-btn')) {
      const h = Math.round(r.height)
      if (![32, 40, 48].some((v) => Math.abs(h - v) <= 1)) out.push({ t: 'btnheight', s: path(b), x: `h ${h}`, txt: t })
    }
  }
  // buttons side by side with different heights
  const rows = new Map()
  for (const b of btns) { const p = b.parentElement; if (!p) continue; const cs = getComputedStyle(p); if (!cs.display.includes('flex') && !cs.display.includes('grid')) continue; if (!rows.has(p)) rows.set(p, []); rows.get(p).push(b) }
  for (const [p, list] of rows) {
    if (list.length < 2) continue
    const byLine = new Map()
    for (const b of list) { const r = b.getBoundingClientRect(); const k = Math.round(r.top / 6); if (!byLine.has(k)) byLine.set(k, []); byLine.get(k).push(Math.round(r.height)) }
    for (const hs of byLine.values()) { if (hs.length > 1 && Math.max(...hs) - Math.min(...hs) > 3) out.push({ t: 'rowmismatch', s: path(p), x: hs.join('/'), txt: txt(p).slice(0, 50) }) }
  }
  return out
}

;(async () => {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {})
  const results = []
  const runs = [{ profile: 'public', pages: PUBLIC }, ...Object.entries(PROFILES).map(([profile, p]) => ({ profile, pages: p.pages, login: p }))]
  for (const run of runs) {
    let cookies = []
    if (run.login) {
      const res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: run.login.email, password: run.login.password || PW }) })
      const sc = res.headers.getSetCookie()
      if (!res.ok) { console.log('login failed', run.profile, res.status); continue }
      cookies = sc.map((c) => { const [nv] = c.split(';'); const i = nv.indexOf('='); return { name: nv.slice(0, i), value: nv.slice(i + 1), domain: 'localhost', path: '/' } })
    }
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
      if (cookies.length) await ctx.addCookies(cookies)
      const page = await ctx.newPage()
      for (const url of run.pages) {
        if (ONLY && !url.includes(ONLY)) continue
        try {
          const resp = await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 90000 })
          await page.waitForTimeout(400)
          const finalUrl = page.url().replace(BASE, '')
          const issues = await page.evaluate(probe)
          results.push({ profile: run.profile, vp: vp.name, url, finalUrl, status: resp && resp.status(), issues })
          if (issues.length) await page.screenshot({ path: `${OUT}/${run.profile}_${vp.name}_${url.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: true }).catch(() => {})
          process.stdout.write(`${run.profile} ${vp.name} ${url} → ${resp && resp.status()} ${issues.length}\n`)
        } catch (e) { results.push({ profile: run.profile, vp: vp.name, url, error: String(e).slice(0, 200) }); process.stdout.write(`ERR ${run.profile} ${vp.name} ${url}\n`) }
      }
      await ctx.close()
    }
  }
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1))
  await browser.close()
})()
