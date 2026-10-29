// Fictitious scenario over the REAL API (no Prisma, no seed shortcuts): every
// profile does what it does in the product — artists and the gallery register
// artworks with photos, ask for markers, link, sign and issue certificates and
// list; collectors save a card, make offers; sellers accept, counter, refuse;
// deals go through escrow, signatures, shipping and the tap; a collector resells
// on the secondary market and registers an own artwork; everyone talks and posts.
//
//   DEMO_BASE_URL=http://localhost:3019 node scripts/demo/scenario.mjs
//   DEMO_BASE_URL=https://www.houseart.com.br node scripts/demo/scenario.mjs
//
// Accounts come from scripts/demo/accounts.sql (apply it first). Idempotent
// enough to re-run: it creates new artworks every time, so run it once per
// environment. Prints one line per step; exits 1 on the first failure.
import { createCipheriv, scryptSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = (process.env.DEMO_BASE_URL ?? 'http://localhost:3019').replace(/\/$/, '')
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo-HouseArt-2026'
const ADMIN = { email: process.env.DEMO_ADMIN_EMAIL ?? 'admin@local.dev', password: process.env.DEMO_ADMIN_PASSWORD ?? 'admin123' }
const DIR = path.dirname(fileURLToPath(import.meta.url))
const STEP = (s) => console.log(`· ${s}`)
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1) }

// ── the mock SUN of the marker vendor (same math as lib/physical-markers/sun-core.ts) ──
function aesEcb(key, block) { const c = createCipheriv('aes-128-ecb', key, null); c.setAutoPadding(false); return Buffer.concat([c.update(block), c.final()]) }
function shiftLeft(b) { const out = Buffer.alloc(b.length); let carry = 0; for (let i = b.length - 1; i >= 0; i--) { out[i] = ((b[i] << 1) & 0xff) | carry; carry = b[i] & 0x80 ? 1 : 0 } return out }
function xor(a, b) { const out = Buffer.alloc(a.length); for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i]; return out }
function subkeys(key) { const l = aesEcb(key, Buffer.alloc(16)); const k1 = shiftLeft(l); if (l[0] & 0x80) k1[15] ^= 0x87; const k2 = shiftLeft(k1); if (k1[0] & 0x80) k2[15] ^= 0x87; return { k1, k2 } }
function aesCmac(key, message) {
  const { k1, k2 } = subkeys(key); const n = message.length === 0 ? 1 : Math.ceil(message.length / 16); const lastComplete = message.length > 0 && message.length % 16 === 0
  let x = Buffer.alloc(16)
  for (let i = 0; i < n - 1; i++) x = aesEcb(key, xor(x, message.subarray(i * 16, i * 16 + 16)))
  let last
  if (lastComplete) last = xor(message.subarray((n - 1) * 16), k1)
  else { const rest = message.subarray((n - 1) * 16); const padded = Buffer.alloc(16); rest.copy(padded); padded[rest.length] = 0x80; last = xor(padded, k2) }
  return aesEcb(key, xor(x, last))
}
const uidBytes = (uid) => Buffer.from(uid, 'hex')
const diversifiedKey = (master, uid) => aesCmac(master, Buffer.concat([Buffer.from([0x01]), uidBytes(uid), Buffer.from('HouseArt', 'utf8')]))
function sunMac(tagKey, uid, counter) {
  const ctr = Buffer.alloc(3); ctr[0] = counter & 0xff; ctr[1] = (counter >> 8) & 0xff; ctr[2] = (counter >> 16) & 0xff
  const sv2 = Buffer.concat([Buffer.from([0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80]), uidBytes(uid), ctr])
  const full = aesCmac(aesCmac(tagKey, sv2), Buffer.alloc(0))
  return Buffer.from([full[1], full[3], full[5], full[7], full[9], full[11], full[13], full[15]]).toString('hex').toUpperCase()
}
const mockMaster = scryptSync('houseart-marker-master-dev', 'houseart-marker-salt', 16)
const sun = (uid, counter) => ({ uid: uid.toLowerCase(), ctr: counter, cmac: sunMac(diversifiedKey(mockMaster, uid.toLowerCase()), uid.toLowerCase(), counter) })

// ── actors ─────────────────────────────────────────────────────────────────
class Actor {
  constructor(name, email, password = PASSWORD) { this.name = name; this.email = email; this.password = password; this.cookie = null; this.id = null }
  async login() {
    const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: this.email, password: this.password }) })
    const set = r.headers.get('set-cookie') ?? ''
    const m = set.match(/houseart_session=([0-9a-f]{64})/)
    if (!r.ok || !m) fail(`login ${this.email}: ${r.status} ${await r.text()}`)
    this.cookie = `houseart_session=${m[1]}`
    const me = await this.get('/api/auth/me'); this.id = me.id
    STEP(`login ${this.name} (${me.profile}${me.activeProfileKind ? ' · ' + me.activeProfileKind : ''})`)
    return me
  }
  async req(method, url, body, opts = {}) {
    const headers = { cookie: this.cookie, ...(body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...(opts.headers ?? {}) }
    const r = await fetch(`${BASE}${url}`, { method, headers, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) })
    const text = await r.text()
    let json = null; try { json = JSON.parse(text) } catch { json = null }
    if (!r.ok && !opts.allow?.includes(r.status)) fail(`${this.name} ${method} ${url} → ${r.status} ${text.slice(0, 300)}`)
    return json ?? { status: r.status, text }
  }
  get(url, opts) { return this.req('GET', url, undefined, opts) }
  post(url, body, opts) { return this.req('POST', url, body ?? {}, opts) }
  patch(url, body, opts) { return this.req('PATCH', url, body, opts) }
  async page(url) { const r = await fetch(`${BASE}${url}`, { headers: { cookie: this.cookie } }); return r.text() }
}

const admin = new Actor('Admin', ADMIN.email, ADMIN.password)
const joana = new Actor('Joana (artista)', 'joana.demo@houseart.test')
const marta = new Actor('Marta (artista)', 'marta.demo@houseart.test')
const ana = new Actor('Ana (galeria)', 'ana.demo@houseart.test')
const caio = new Actor('Caio (galeria · vendas)', 'caio.demo@houseart.test')
const helena = new Actor('Helena (consultora)', 'helena.demo@houseart.test')
const marina = new Actor('Marina (colecionadora)', 'marina.demo@houseart.test')
const marcelo = new Actor('Marcelo (colecionador)', 'marcelo.demo@houseart.test')
const lia = new Actor('Lia (colecionadora)', 'lia.demo@houseart.test')
const rui = new Actor('Rui (avaliador)', 'rui.demo@houseart.test')

const img = (name) => new File([readFileSync(path.join(DIR, 'images', name))], name, { type: 'image/jpeg' })
const MACROS = ['MACRO_TL', 'MACRO_TR', 'MACRO_BL', 'MACRO_BR']
async function upload(actor, artworkId, kind, file) {
  const fd = new FormData(); fd.append('kind', kind); fd.append('file', file)
  return actor.post(`/api/artworks/${artworkId}/media`, fd)
}

/** Registers an artwork with the six required photos and submits it for certification. */
async function registerArtwork(actor, a, imageIndex, artistId) {
  const draft = await actor.post('/api/artworks', { title: a.title, ...(artistId ? { artistId } : {}) })
  const id = draft.id
  await actor.patch(`/api/artworks/${id}`, { title: a.title, year: a.year, technique: a.technique, materials: a.materials ?? null, heightMm: a.h, widthMm: a.w, depthMm: a.d ?? null, category: a.category, conditionGrade: 'EXCELLENT', edition: a.edition ?? null, series: a.series ?? null, signatureLocation: a.signature ?? 'Frente, canto inferior direito' })
  await upload(actor, id, 'FRONT_COLOR_CARD', img(`front-${imageIndex}.jpg`))
  await upload(actor, id, 'BACK', img('back.jpg'))
  for (const [i, k] of MACROS.entries()) await upload(actor, id, k, img(`macro-${imageIndex}-${['tl', 'tr', 'bl', 'br'][i]}.jpg`))
  // a look-alike flagged by the perceptual hash blocks the submission until decided: keep "it is not the same"
  const sheet = await actor.get(`/api/artworks/${id}`)
  for (const d of sheet.duplicateChecks ?? []) if (d.decision === 'PENDING') await actor.post(`/api/artworks/${id}/duplicates/${d.id}`, { decision: 'DIFFERENT' }, { allow: [400, 404, 409] })
  await actor.post(`/api/artworks/${id}/submit`)
  STEP(`${actor.name}: obra "${a.title}" cadastrada e enviada para certificação (#${id})`)
  return id
}

/** Markers: the member asks for a kit, the staff ships it from a batch of known uids, the member links, signs and issues. */
let uidSeq = Date.now() % 0xfffff
const freshUid = () => `04${(uidSeq++).toString(16).padStart(12, '0')}`.slice(0, 14)
async function certify(actor, artworkIds) {
  const order = await actor.post('/api/markers/orders', { quantity: artworkIds.length })
  const uids = artworkIds.map(() => freshUid())
  const batch = await admin.post('/api/admin/markers/batches', { code: `${new Date().toISOString().slice(0, 7)}-D${Date.now().toString(36).toUpperCase()}`, quantity: uids.length, destination: actor.name, uids })
  await admin.post(`/api/admin/markers/orders/${order.id}/ship`, { batchId: batch.id })
  const out = []
  for (const [i, artworkId] of artworkIds.entries()) {
    const link = await actor.post('/api/markers/link', { ...sun(uids[i], 1), artworkId })
    await actor.post(`/api/certificates/${link.certificateId}/sign`)
    await actor.post(`/api/certificates/${link.certificateId}/issue`)
    out.push({ artworkId, uid: uids[i], publicId: link.publicId, ctr: 1 })
    STEP(`${actor.name}: etiqueta ${uids[i]} vinculada, certificado assinado e emitido → ${link.publicId}`)
  }
  return out
}

async function listForSale(actor, c, price, floor, opts = {}) {
  await actor.post(`/api/artworks/${c.artworkId}/list`, { listPriceCents: price, reservePriceCents: floor, autoNegotiatorOn: opts.negotiator ?? false, autoAcceptMinBps: opts.autoAccept ?? 9200, fixedPrice: opts.fixed ?? false })
  STEP(`${actor.name}: ${c.publicId} à venda por R$ ${(price / 100).toLocaleString('pt-BR')}`)
}

async function addCard(actor, number, holder) {
  const r = await actor.post('/api/collector/payment-methods', { number, exp: '12/29', cvc: '123', holder, cep: '40140-180', makeDefault: true })
  if (!r.ok) fail(`cartão ${actor.name}: ${JSON.stringify(r)}`)
  STEP(`${actor.name}: cartão •••• ${number.slice(-4)} salvo`)
  return r.method.id
}

async function offer(actor, c, cents, paymentMethodId, message) {
  const r = await actor.post('/api/public/offers', { publicId: c.publicId, buyerName: actor.name.split(' (')[0], buyerEmail: actor.email, buyerCity: 'Salvador/BA', offeredCents: cents, message, validityHours: 48, guaranteeMethod: 'CARD_HOLD', paymentMethodId, deliveryCep: '40140-180' })
  if (!r.ok || !r.confirmed) fail(`proposta ${actor.name} em ${c.publicId}: ${JSON.stringify(r)}`)
  STEP(`${actor.name}: proposta ${r.code} de R$ ${(cents / 100).toLocaleString('pt-BR')} em ${c.publicId}`)
  return r.code
}

async function sellerOffer(seller, code) {
  const rows = await seller.get('/api/offers')
  const o = (rows.items ?? rows).find((x) => x.code === code)
  if (!o) fail(`${seller.name} não vê a proposta ${code}`)
  return o
}

/** The buyer's deal id for an artwork, read from the Compras page (there is no list route for the buyer). */
async function dealIdOf(buyer, artworkTitle) {
  const html = (await buyer.page('/purchases')).replace(/\\"/g, '"')
  // the serialized deals of the page: {"id":N,"code":"DL-…",…,"artworkTitle":"…"}
  const re = /"id":(\d+),"code":"(DL-\d{4}-\d{6})"[^{}]*?"artworkTitle":"([^"]*)"/g
  const found = [...html.matchAll(re)].map((m) => ({ id: Number(m[1]), code: m[2], title: m[3] }))
  const d = found.filter((x) => !artworkTitle || x.title.startsWith(artworkTitle)).sort((a, b) => b.id - a.id)[0] ?? found[0]
  if (!d) fail(`${buyer.name}: nenhum negócio em /purchases (${html.length} bytes)`)
  return d
}

async function main() {
  console.log(`HouseArt · cenário fictício em ${BASE}`)
  for (const a of [admin, joana, marta, ana, caio, helena, marina, marcelo, lia, rui]) await a.login()

  // ── artworks ─────────────────────────────────────────────────────────
  const j1 = await registerArtwork(joana, { title: 'Construção nº 7', year: 2025, technique: 'Óleo sobre linho', h: 1000, w: 800, category: 'PAINTING', series: 'Construções' }, 0)
  const j2 = await registerArtwork(joana, { title: 'Voo baixo', year: 2024, technique: 'Óleo sobre linho', h: 1200, w: 1000, category: 'PAINTING' }, 1)
  const j3 = await registerArtwork(joana, { title: 'Estudo em vermelho', year: 2025, technique: 'Óleo sobre papel', h: 500, w: 500, category: 'PAINTING' }, 2)
  const m1 = await registerArtwork(marta, { title: 'Maré cheia', year: 2024, technique: 'Pigmento mineral sobre papel de algodão', h: 600, w: 900, category: 'PHOTOGRAPHY', edition: '2/5' }, 5)
  const m2 = await registerArtwork(marta, { title: 'Jangada ao amanhecer', year: 2023, technique: 'Pigmento mineral sobre papel de algodão', h: 600, w: 900, category: 'PHOTOGRAPHY', edition: '1/5' }, 6)
  const artists = (await ana.get('/api/gallery/artists')).artists
  const tomas = artists.find((x) => x.name === 'Tomás Barreto') ?? (await ana.post('/api/gallery/artists', { name: 'Tomás Barreto', kind: 'REPRESENTED', galleryBps: 5000 })).artists.find((x) => x.name === 'Tomás Barreto')
  const liaM = artists.find((x) => x.name === 'Lia Mendes') ?? (await ana.post('/api/gallery/artists', { name: 'Lia Mendes', kind: 'CONSIGNMENT', galleryBps: 4000 })).artists.find((x) => x.name === 'Lia Mendes')
  const g1 = await registerArtwork(ana, { title: 'Retábulo do Rio Vermelho', year: 1983, technique: 'Acrílica e folha de ouro sobre madeira', h: 1400, w: 1050, d: 40, category: 'PAINTING' }, 3, tomas.id)
  const g2 = await registerArtwork(ana, { title: 'Duas luas', year: 1977, technique: 'Acrílica sobre tela', h: 900, w: 900, category: 'PAINTING' }, 4, tomas.id)
  const g3 = await registerArtwork(ana, { title: 'Maré baixa, Itapuã', year: 2024, technique: 'Pigmento mineral · ed. 3/5', h: 600, w: 900, category: 'PHOTOGRAPHY', edition: '3/5' }, 7, liaM.id)
  const h1 = await registerArtwork(helena, { title: 'Sem título (coleção Prado)', year: 2019, technique: 'Serigrafia sobre papel', h: 700, w: 500, category: 'PRINT', edition: '12/30' }, 8)

  // ── certification ────────────────────────────────────────────────────
  const J = await certify(joana, [j1, j2, j3])
  const M = await certify(marta, [m1, m2])
  const G = await certify(ana, [g1, g2, g3])
  const H = await certify(helena, [h1])
  const by = (list, artworkId) => list.find((c) => c.artworkId === artworkId)

  // ── mandates (the floor never leaves the backend) ────────────────────
  await listForSale(joana, by(J, j1), 3_800_000, 3_200_000, { negotiator: true, autoAccept: 9500 })
  await listForSale(joana, by(J, j2), 4_400_000, 3_900_000)
  await listForSale(joana, by(J, j3), 980_000, 800_000, { fixed: true })
  await listForSale(marta, by(M, m1), 650_000, 520_000, { negotiator: true })
  await listForSale(marta, by(M, m2), 720_000, 600_000)
  await listForSale(ana, by(G, g1), 32_000_000, 28_000_000)
  await listForSale(ana, by(G, g2), 18_500_000, 16_000_000, { fixed: true })
  await listForSale(ana, by(G, g3), 780_000, 620_000, { negotiator: true })
  await listForSale(helena, by(H, h1), 420_000, 350_000)

  // ── gallery rules and the sales team ─────────────────────────────────
  await ana.req('PUT', '/api/gallery/rules', { refuseLow: true, refuseBelowBps: 7000, responseHours: 48, notifyTeam: true })
  STEP('Galeria: regras de ofertas (recusa abaixo de 70 %, 48 h, avisa a equipe)')

  // ── collectors: cards and offers ─────────────────────────────────────
  const marinaCard = await addCard(marina, '4242424242424242', 'MARINA LOPES')
  const marceloCard = await addCard(marcelo, '5555555555554444', 'MARCELO BASTOS')
  const liaCard = await addCard(lia, '4242424242424242', 'LIA SOUZA')
  const o1 = await offer(marina, by(J, j2), 4_400_000, marinaCard, 'Adorei a obra. Posso ver ao vivo na quinta?')       // → accepted → completed
  const o2 = await offer(marcelo, by(M, m1), 600_000, marceloCard, 'Fotografia para a sala de jantar.')               // → negotiator counters (below 95 %)
  const o3 = await offer(lia, by(G, g3), 700_000, liaCard, 'Tenho interesse na edição 3/5.')                           // → gallery accepts → escrow (left mid-way)
  const o4 = await offer(marcelo, by(G, g1), 20_000_000, marceloCard, 'É o que consigo agora.')                        // → below 70 %: refused by the gallery rule at once
  const o5 = await offer(lia, by(J, j1), 3_500_000, liaCard)                                                           // → Joana counters
  const o6 = await offer(marina, by(M, m2), 720_000, marinaCard, 'Fechado pelo preço pedido.')                        // → Marta accepts → completed

  // ── sellers answer ───────────────────────────────────────────────────
  const r1 = await sellerOffer(joana, o1); await joana.post(`/api/offers/${r1.id}/accept`); STEP(`Joana aceita ${o1}`)
  const r5 = await sellerOffer(joana, o5); await joana.post(`/api/offers/${r5.id}/counter`, { amountCents: 3_650_000, message: 'Consigo chegar a 3.650.' }); STEP(`Joana contrapropõe em ${o5}`)
  const r3 = await sellerOffer(ana, o3); await ana.post(`/api/offers/${r3.id}/accept`); STEP(`Galeria aceita ${o3}`)
  const r6 = await sellerOffer(marta, o6); await marta.post(`/api/offers/${r6.id}/accept`); STEP(`Marta aceita ${o6}`)
  const r4 = await sellerOffer(ana, o4); STEP(`Galeria: ${o4} ficou ${r4.statusLabel} (regra da galeria)`)
  const r2 = await sellerOffer(marta, o2); STEP(`Marta: ${o2} está ${r2.statusLabel} (negociador)`)

  // ── deals ────────────────────────────────────────────────────────────
  async function completeDeal(buyer, seller, cert, { shipping = true, deliver = true, title } = {}) {
    cert.dealCode = title
    const deal = await dealIdOf(buyer, cert.dealCode)
    // the card hold of the offer is captured into escrow on the accept; a deal without a hold pays now
    const esc = await buyer.post(`/api/deals/${deal.id}/escrow`, {}, { allow: [409] })
    STEP(`${buyer.name}: ${deal.code} em garantia${esc.code === 'WRONG_PHASE' ? ' (capturado do cartão no aceite)' : ''}`)
    await buyer.post(`/api/deals/${deal.id}/sign`); await seller.post(`/api/deals/${deal.id}/sign`); STEP(`${deal.code}: cessão assinada pelos dois lados`)
    if (!shipping) return deal
    await seller.post(`/api/deals/${deal.id}/shipping`, { carrier: 'ArtTrans', tracking: `AT-${deal.code.slice(-4)}`, insurer: 'Seguradora Demo', policyRef: `SD-${deal.code.slice(-4)}`, shippingCents: 85_000, insuranceCents: 32_000 }); STEP(`${deal.code}: transporte registrado`)
    if (!deliver) return deal
    cert.ctr += 1
    await buyer.post(`/api/deals/${deal.id}/confirm-delivery`, sun(cert.uid, cert.ctr)); STEP(`${deal.code}: entrega confirmada com o toque na etiqueta → escritura em nome de ${buyer.name.split(' (')[0]}`)
    return deal
  }
  await completeDeal(marina, joana, by(J, j2), { title: 'Voo baixo' })
  await completeDeal(marina, marta, by(M, m2), { title: 'Jangada' })
  await completeDeal(lia, ana, by(G, g3), { shipping: false, title: 'Maré baixa' })

  // ── the collector resells and registers an own artwork ───────────────
  const resold = by(J, j2)
  await marina.post(`/api/collector/artworks/${resold.artworkId}/sell`, { listPriceCents: 5_200_000, reservePriceCents: 4_700_000, autoNegotiatorOn: false, autoAcceptMinBps: 10000, fixedPrice: false })
  STEP(`Marina: ${resold.publicId} de volta ao marketplace no secundário por R$ 52.000`)
  const own = await marina.post('/api/collector/artworks', { title: 'Paisagem de Itapuã (herança)', artistName: 'Tomás Barreto', acquisitionKind: 'INHERITED', acquisitionYear: 2015, acquisitionFrom: 'Família', acquisitionPriceCents: '0' })
  STEP(`Marina: obra própria cadastrada como rascunho (#${own.id})`)
  await marina.post(`/api/collector/artworks/${resold.artworkId}/services`, { code: 'COLLECTION_INSURANCE' }); STEP('Marina: pedido de cotação de seguro para a obra')

  // ── appraisal: the holder asks, the appraiser issues ─────────────────
  const req = await marina.post('/api/appraisals', { artworkId: by(M, m2).artworkId, purpose: 'INSURANCE', requesterLabel: 'Colecionadora' })
  const reqId = req.id ?? req.request?.id ?? req.requestId
  await rui.post(`/api/appraisals/${reqId}/issue`, { minCents: 680_000, suggestedCents: 760_000, maxCents: 840_000, methodology: 'Comparáveis de vendas recentes da artista em edição e formato equivalentes; estado de conservação excelente; demanda crescente no mercado secundário.' })
  STEP(`Rui: laudo emitido para o pedido #${reqId}`)

  // ── messages ─────────────────────────────────────────────────────────
  const conv = await marcelo.post('/api/messages', { artworkId: by(G, g1).artworkId })
  await marcelo.post(`/api/messages/${conv.id}`, { body: 'Boa tarde. A obra está disponível para visita na galeria esta semana?' })
  await ana.post(`/api/messages/${conv.id}`, { body: 'Olá, Marcelo! Está sim — de terça a sábado, das 10h às 19h. Posso reservar quinta às 15h?' })
  await marcelo.post(`/api/messages/${conv.id}`, { body: 'Quinta às 15h fica ótimo. O condition report sai junto com a caixa?' })
  await ana.post(`/api/messages/${conv.id}`, { body: 'Sai sim, feito na saída e conferido na chegada.' })
  const blocked = await marcelo.post(`/api/messages/${conv.id}`, { body: 'Me liga no 71 99999-1234' }, { allow: [422] })
  STEP(`Mensagens: conversa Marcelo ↔ Galeria (${blocked.code === 'CONTACT' ? 'guarda de contato barrou o telefone' : 'ok'})`)
  const conv2 = await lia.post('/api/messages', { artworkId: by(J, j1).artworkId })
  await lia.post(`/api/messages/${conv2.id}`, { body: 'Joana, a nº 7 aceita visita ao ateliê?' })
  await joana.post(`/api/messages/${conv2.id}`, { body: 'Aceita! Sábado de manhã é o melhor horário.' })

  // ── community ────────────────────────────────────────────────────────
  const p1 = await joana.post('/api/community/posts', { kind: 'PHOTO', body: 'Ateliê hoje: fechando a série Construções. A nº 7 já está na Ladeira e aceita ofertas.', artworkId: by(J, j1).artworkId })
  const p2 = await ana.post('/api/community/posts', { kind: 'EVENT', body: 'Convite aberto a quem segue a galeria.', event: { title: 'Abertura · Joana Teixeira, Construções', venue: 'Galeria Ladeira, Santo Antônio Além do Carmo', startsOn: new Date(Date.now() + 12 * 86_400_000).toISOString().slice(0, 10), startsAt: '19h' } })
  const p3 = await helena.post('/api/community/posts', { kind: 'POLL', body: 'Para a coleção de 2027: que técnica vocês estão olhando?', pollOptions: ['Pintura', 'Fotografia', 'Escultura', 'Gravura'] })
  const p4 = await marta.post('/api/community/posts', { kind: 'PHOTO', body: 'Maré cheia chegou do ateliê em Recife. Visitas com hora marcada até sexta.', artworkId: by(M, m1).artworkId })
  await ana.post('/api/community/posts', { kind: 'TEXT', body: 'Semana de montagem na Ladeira: a sala 2 recebe a série Construções a partir de quinta.' })
  for (const [who, post] of [[marina, p1], [marcelo, p1], [lia, p1], [marina, p4], [marcelo, p2]]) await who.post('/api/community/reactions', { target: 'POST', targetId: post.id, kind: 'LIKE' })
  await marina.post('/api/community/reactions', { target: 'POST', targetId: p2.id, kind: 'RSVP' })
  await lia.post('/api/community/reactions', { target: 'POST', targetId: p2.id, kind: 'RSVP' })
  await marina.post('/api/community/reactions', { target: 'POST', targetId: p4.id, kind: 'SAVE' })
  const joanaMember = (await joana.get('/api/auth/me')).memberId
  for (const who of [marina, marcelo, lia]) await who.post('/api/community/reactions', { target: 'MEMBER', targetId: joanaMember, kind: 'FOLLOW' })
  await marina.post('/api/community/comments', { target: 'POST', targetId: p1.id, body: 'Que cor! A nº 7 é a minha favorita da série.' })
  await marcelo.post('/api/community/comments', { target: 'POST', targetId: p1.id, body: 'Vou na abertura.' })
  await joana.post('/api/community/comments', { target: 'POST', targetId: p1.id, body: 'Obrigada! Te espero lá.' })
  await marina.post(`/api/community/polls/${p3.id}/vote`, { option: 0 }); await marcelo.post(`/api/community/polls/${p3.id}/vote`, { option: 1 }); await lia.post(`/api/community/polls/${p3.id}/vote`, { option: 0 })
  for (const who of [marina, marcelo]) await who.post('/api/community/reactions', { target: 'ARTWORK', targetId: by(G, g1).artworkId, kind: 'LIKE' })
  await lia.post('/api/community/reactions', { target: 'ARTWORK', targetId: by(J, j3).artworkId, kind: 'SAVE' })
  STEP('Comunidade: 5 posts, curtidas, "Eu vou", salvos, 3 seguindo a Joana, comentários, enquete votada; favoritos de obras')

  // ── the sales staff of the gallery sees the offers too ───────────────
  const caioOffers = await caio.get('/api/offers')
  if (!(caioOffers.items ?? caioOffers).length) fail('Caio (vendas da galeria) não vê as propostas da galeria')
  const forbidden = await caio.post('/api/gallery/team', { email: 'ninguem@demo.test', role: 'SALES' }, { allow: [403] })
  STEP(`Caio (vendas) vê ${(caioOffers.items ?? caioOffers).length} propostas da galeria e ${forbidden.status === 403 || forbidden.error ? 'não gere a equipe (403)' : 'GERE A EQUIPE (?)'}`)

  console.log('\n✓ cenário completo')
  console.log(`  Obras: ${[...J, ...M, ...G, ...H].map((c) => c.publicId).join(', ')}`)
}

main().catch((e) => fail(e?.stack ?? String(e)))
