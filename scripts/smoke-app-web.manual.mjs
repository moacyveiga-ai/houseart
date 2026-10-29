// Prova do app nativo exportado para a web (/app), contra um deploy, com as
// contas demo (scripts/demo/README.md). Só LÊ: entra, escolhe o perfil e abre
// cada tela por URL direta; nunca envia proposta, compra ou mensagem.
//
// Falha (código 1) quando uma tela mostra "Tela não encontrada", fica em
// branco, lança erro de página ou recebe 4xx/5xx de /api/.
//
// Local:   SMOKE_BASE_URL=http://localhost:3019 node scripts/smoke-app-web.manual.mjs
// Sandbox da Vercel (a rede desta máquina não alcança *.vercel.app):
//   npm i playwright@1.56.1 && PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 \
//     npx playwright install chromium-headless-shell
//   PLAYWRIGHT_MODULE=$PWD/node_modules/playwright/index.js \
//   PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 node smoke-app-web.manual.mjs > out.txt
// Senha das contas demo: SMOKE_PASSWORD (padrão: a do README da demo).

const pw = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const chromium = pw.chromium ?? pw.default.chromium

const BASE = (process.env.SMOKE_BASE_URL ?? 'https://houseart-housemapp.vercel.app').replace(/\/$/, '')
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'Demo-HouseArt-2026'
const DEMO_ARTWORK = process.env.SMOKE_ARTWORK ?? 'HA-2026-DEMP-0001'

const ROUNDS = [
  {
    email: 'marina.demo@houseart.test',
    profile: 'Colecionador',
    paths: [
      'explore', 'wallet', 'community', 'messages', 'profile', 'search', 'favorites',
      'purchases', 'sales/collector', 'wallet/cards', 'wallet/register', 'verify', 'settings',
      `artwork/${DEMO_ARTWORK}`, `artwork/${DEMO_ARTWORK}/offer`, `artwork/${DEMO_ARTWORK}/buy`,
    ],
  },
  {
    email: 'ana.demo@houseart.test',
    profile: 'Galeria',
    paths: [
      'home', 'artworks', 'sales', 'messages', 'community', 'sales/rules', 'sales/payout',
      'gallery/team', 'gallery/artists', 'gallery/account',
    ],
  },
  {
    email: 'joana.demo@houseart.test',
    profile: 'Artista',
    paths: ['home', 'artworks', 'certification', 'messages', 'notifications', 'artworks/new'],
  },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const failures = []

async function bodyText(page) {
  const parts = []
  for (const frame of page.frames()) {
    try { parts.push(await frame.locator('body').innerText({ timeout: 2000 })) } catch { /* frame em navegação */ }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

async function round({ email, profile, paths }) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } })
  await ctx.addInitScript(() => localStorage.setItem('houseart.app.onboarding.v1', '1'))
  const page = await ctx.newPage()
  let where = 'login'
  page.on('pageerror', (e) => failures.push(`${email} ${where}: erro de página — ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    const url = r.url()
    if (url.includes('/api/') && r.status() >= 400) failures.push(`${email} ${where}: API ${r.status()} ${url.replace(BASE, '').slice(0, 100)}`)
  })

  console.log(`=== ${profile} (${email})`)
  await page.goto(`${BASE}/app/login`)
  await sleep(3000)
  const inputs = page.locator('input')
  await inputs.nth(0).fill(email)
  await inputs.nth(1).fill(PASSWORD)
  await page.getByText('Entrar', { exact: true }).last().click()
  await sleep(5000)
  if (page.url().includes('/profiles')) {
    await page.getByText(profile, { exact: true }).first().click()
    await sleep(5000)
  }
  console.log(`  depois do login: ${page.url().replace(BASE, '')}`)
  if (page.url().includes('/login')) failures.push(`${email}: não entrou`)

  for (const path of paths) {
    where = path
    await page.goto(`${BASE}/app/${path}`)
    await sleep(5000)
    const text = await bodyText(page)
    const url = page.url().replace(BASE, '')
    console.log(`  ${path} -> ${url} | ${text.slice(0, 140)}`)
    if (/Tela não encontrada|Unmatched Route/i.test(text)) failures.push(`${email} ${path}: Tela não encontrada`)
    else if (text.length < 20) failures.push(`${email} ${path}: tela em branco`)
    if (url.includes('/login')) failures.push(`${email} ${path}: caiu no login`)
  }
  await browser.close()
}

for (const r of ROUNDS) {
  try { await round(r) } catch (e) { failures.push(`${r.email}: ${e.message.slice(0, 200)}`) }
}

if (failures.length) {
  console.log(`\nFALHOU (${failures.length}):`)
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('\nOK: todas as telas abriram')
