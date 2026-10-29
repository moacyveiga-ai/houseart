// The five journeys of the brief, end to end over HTTP: entrance, artwork
// registration, certification kit, public marketplace + verification,
// billing + appraisal desk. Writes to the database it points at (dev only).
import { expect, test, type APIRequestContext } from '@playwright/test'

import { SMOKE } from './playwright.config'

const ARTIST = SMOKE.artist
const ADMIN = SMOKE.admin
const READONLY = SMOKE.readonly

async function login(request: APIRequestContext, who: { credential: string; password: string }) {
  const res = await request.post('/api/auth/login', { data: who })
  expect(res.status(), 'login').toBe(200)
}

test('1 · entrada: login, perfil e a lista de obras', async ({ page, request }) => {
  await page.goto('/login')
  await expect(page.locator('body')).toContainText('HouseArt')
  await login(request, ARTIST)
  const me = await request.get('/api/auth/me')
  expect(me.status()).toBe(200)
  const res = await request.get('/artworks')
  expect(res.status()).toBe(200)
  expect(await res.text()).toContain('obras')
})

test('2 · cadastro de obra em 6 passos (rascunho, ficha, estimativa)', async ({ request }) => {
  test.skip(READONLY, 'escreve no banco')
  await login(request, ARTIST)
  const created = await request.post('/api/artworks', { data: { title: 'Smoke · obra de teste' } })
  expect(created.status()).toBe(201)
  const { id } = await created.json() as { id: number }
  const patched = await request.patch(`/api/artworks/${id}`, { data: { year: 2025, technique: 'Acrílica sobre tela', heightCm: 80, widthCm: 60 } })
  expect([200, 400]).toContain(patched.status())
  const edit = await request.get(`/artworks/${id}/edit`)
  expect(edit.status()).toBe(200)
  expect(await edit.text()).toContain('Ficha técnica')
  const est = await request.get(`/api/artworks/${id}/estimate`)
  expect(est.status()).toBe(200)
  expect(await est.json()).toHaveProperty('estimate')
})

test('3 · certificação: a tela e o pedido do kit de etiquetas', async ({ request }) => {
  await login(request, ARTIST)
  const cert = await request.get('/certification')
  expect(cert.status()).toBe(200)
  expect(await cert.text()).toContain('Certifica')
  if (!READONLY) {
    const order = await request.post('/api/markers/orders', { data: { quantity: 1 } })
    expect([200, 201]).toContain(order.status())
  }
})

test('4 · marketplace público e verificação', async ({ page, request }) => {
  const list = await request.get('/api/public/artworks')
  expect(list.status()).toBe(200)
  const items = await list.json() as { publicId: string }[] | { items: { publicId: string }[] }
  const first = (Array.isArray(items) ? items : items.items)[0]
  if (first) {
    const pdp = await page.goto(`/e/artwork/${first.publicId}`)
    expect(pdp?.status()).toBe(200)
    const verify = await request.get(`/verify/${first.publicId}`)
    expect([200, 404]).toContain(verify.status())
  }
  const bad = await request.get('/verify/HA-L-2026-ZZZZ')
  expect(bad.status()).toBe(404)
})

test('5 · cobrança do membro e fila de laudos da equipe', async ({ request }) => {
  await login(request, ARTIST)
  const billing = await request.get('/api/billing')
  expect(billing.status()).toBe(200)
  const b = await billing.json() as { plan: { name: string } | null; bars: unknown[]; invoices: unknown[] }
  expect(b.plan?.name).toBeTruthy()
  const page = await request.get('/billing')
  expect(page.status()).toBe(200)
  expect(await page.text()).toContain('Faturas e notas fiscais')
  await request.post('/api/auth/logout')
  await login(request, ADMIN)
  const desk = await request.get('/appraisals')
  expect(desk.status()).toBe(200)
  // the team's desk (Admin › Laudos) and the appraiser's "Fila de laudos" share the route
  expect(await desk.text()).toMatch(/Laudos|Fila de laudos/)
})

// Noite de 2026-10-29: the pieces that entered after the first five journeys.
test('6 · ajuda pública e o app na web (simulador)', async ({ request }) => {
  const help = await request.get('/e/help')
  expect(help.status()).toBe(200)
  expect(await help.text()).toContain('Como podemos ajudar')
  const article = await request.get('/e/help/pagamento-em-garantia')
  expect(article.status()).toBe(200)
  expect(await article.text()).toContain('Pagamento em garantia')
  expect((await request.get('/e/help/nao-existe')).status()).toBe(404)
  const sim = await request.get('/simulator')
  expect(sim.status()).toBe(200)
  // the exported Expo app: /app and any deep link fall back to its index.html
  for (const path of ['/app', '/app/explore', '/app/login']) {
    const res = await request.get(path)
    expect(res.status(), path).toBe(200)
    expect(await res.text(), path).toContain('<div id="root"')
  }
})

test('7 · saúde operacional: a rotina das escrituras pendentes e a porta dela', async ({ request }) => {
  // without the CRON_SECRET bearer: 401 where the secret exists (a deploy); dev without a secret lets it run
  expect([200, 401]).toContain((await request.post('/api/cron/deal-complete-retry')).status())
  await login(request, ADMIN)
  const ops = await request.get('/admin/ops')
  expect(ops.status()).toBe(200)
  expect(await ops.text()).toContain('Escrituras pendentes')
})

test('8 · compra direta e oferta abrem para a primeira obra à venda', async ({ request }) => {
  const list = await request.get('/api/public/artworks')
  const items = await list.json() as { publicId: string }[] | { items: { publicId: string }[] }
  const first = (Array.isArray(items) ? items : items.items)[0]
  test.skip(!first, 'nenhuma obra à venda neste banco')
  for (const path of [`/e/artwork/${first!.publicId}/offer`, `/e/artwork/${first!.publicId}/buy`]) {
    const res = await request.get(path, { maxRedirects: 0 })
    expect(res.status(), path).toBeLessThan(500)
  }
})
