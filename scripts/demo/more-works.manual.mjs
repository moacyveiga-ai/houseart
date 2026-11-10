// More REAL public-domain works for the demo marketplace (runs after scenario.mjs): downloads each work from
// Wikimedia Commons (or the house public media), cuts the four corner details, registers, certifies and lists it,
// and posts a few of them in the community. Authors dead for more than 70 years; the sale is simulated.
// Rerunnable: a work already sent (same title, same seller) is skipped; a work whose image does not come is skipped.
//   DEMO_BASE_URL=https://www.houseart.com.br DEMO_ADMIN_EMAIL=… DEMO_ADMIN_PASSWORD=… node scripts/demo/more-works.manual.mjs
//   DEMO_FAKE_IMAGES=1 uses the synthetic images of scripts/demo/images (local run without network; needs no sharp)
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCipheriv, scryptSync } from 'node:crypto'

const BASE = (process.env.DEMO_BASE_URL ?? 'http://localhost:3019').replace(/\/$/, '')
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo-HouseArt-2026'
const ADMIN = { email: process.env.DEMO_ADMIN_EMAIL ?? 'admin@local.dev', password: process.env.DEMO_ADMIN_PASSWORD ?? 'admin123' }
const FAKE = process.env.DEMO_FAKE_IMAGES === '1'
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
const vangogh = new Actor('Van Gogh (artista)', 'joana.demo@houseart.test')
const hokusai = new Actor('Hokusai (artista)', 'marta.demo@houseart.test')
const gallery = new Actor('Ana (galeria)', 'ana.demo@houseart.test')
const advisor = new Actor('Helena (consultora)', 'helena.demo@houseart.test')
const SELLERS = { vangogh, hokusai, gallery, advisor }

const M = `${BASE}/api/public/media/content/artists/2`
const commons = (file) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1600`
const NOTE = ' Obra em domínio público; anúncio de demonstração.'
// seller · artist (the gallery and the advisor name theirs) · sheet (cm) · price and floor in cents · image candidates
const WORKS = [
  { s: 'vangogh', title: 'Terraço do café à noite', year: 1888, tech: 'Óleo sobre tela', h: 80.7, w: 65.3, price: 4_600_000, about: 'A Place du Forum, em Arles, pintada à noite, ao ar livre, em setembro de 1888.', img: [commons('Vincent Willem van Gogh - Cafe Terrace at Night (Yorck).jpg'), commons('Van Gogh - Terrasse des Cafés an der Place du Forum in Arles am Abend1.jpeg')] },
  { s: 'vangogh', title: 'Amendoeira em flor', year: 1890, tech: 'Óleo sobre tela', h: 73.3, w: 92.4, price: 5_200_000, about: 'Pintada em Saint-Rémy em fevereiro de 1890, para o nascimento do sobrinho do artista.', img: [commons('Vincent van Gogh - Almond blossom - Google Art Project.jpg')] },
  { s: 'vangogh', title: 'Campo de trigo com corvos', year: 1890, tech: 'Óleo sobre tela', h: 50.2, w: 103, price: 4_900_000, about: 'Uma das últimas telas, pintada em Auvers-sur-Oise em julho de 1890.', img: [commons('Vincent van Gogh - Wheatfield with crows - Google Art Project.jpg')] },
  { s: 'vangogh', title: 'Autorretrato', year: 1889, tech: 'Óleo sobre tela', h: 65, w: 54.5, price: 6_800_000, about: 'Pintado em Saint-Rémy em setembro de 1889; o fundo em espirais repete o gesto da Noite estrelada.', img: [commons('Vincent van Gogh - Self-Portrait - Google Art Project.jpg'), commons('Vincent van Gogh - Self-Portrait - Google Art Project (454045).jpg')] },
  { s: 'hokusai', title: 'Tempestade sob o cume', year: 1831, tech: 'Xilogravura policromada sobre papel', h: 25.7, w: 38, cat: 'PRINT', series: 'Trinta e seis vistas do monte Fuji', price: 590_000, about: 'O monte Fuji acima das nuvens, com um raio na encosta; da mesma série da Grande onda.', img: [commons('Lightnings below the summit.jpg'), commons('Katsushika Hokusai - Thunderstorm Beneath the Summit - Google Art Project.jpg')] },
  { s: 'gallery', artist: 'Claude Monet', title: 'Mulher com sombrinha', year: 1875, tech: 'Óleo sobre tela', h: 100, w: 81, price: 9_800_000, about: 'Camille Monet e o filho Jean num dia de vento, pintados de baixo para cima, ao ar livre.', img: [commons('Claude Monet - Woman with a Parasol - Madame Monet and Her Son - Google Art Project.jpg')] },
  { s: 'gallery', artist: 'Johannes Vermeer', title: 'A leiteira', year: 1658, tech: 'Óleo sobre tela', h: 45.5, w: 41, price: 21_000_000, about: 'Uma criada verte leite numa cozinha de Delft; a luz entra pela janela à esquerda.', img: [commons('Johannes Vermeer - Het melkmeisje - Google Art Project.jpg')] },
  { s: 'gallery', artist: 'Johannes Vermeer', title: 'Vista de Delft', year: 1661, tech: 'Óleo sobre tela', h: 96.5, w: 115.7, price: 26_000_000, about: 'A cidade natal do pintor vista do sul, depois da chuva.', img: [commons('Vermeer-view-of-delft.jpg'), commons('Johannes Vermeer - Gezicht op Delft - Google Art Project.jpg')] },
  { s: 'gallery', artist: 'Gustav Klimt', title: 'O beijo', year: 1908, tech: 'Óleo e folha de ouro sobre tela', h: 180, w: 180, price: 34_000_000, about: 'A obra central da fase dourada de Klimt, pintada em Viena entre 1907 e 1908.', img: [`${M}/1793215394012-87qkmwurdcs.jpg`] },
  { s: 'gallery', artist: 'Gustav Klimt', title: 'Retrato de Adele Bloch-Bauer I', year: 1907, tech: 'Óleo, ouro e prata sobre tela', h: 138, w: 138, price: 31_000_000, about: 'O primeiro dos dois retratos de Adele Bloch-Bauer, concluído em 1907.', img: [commons('Gustav Klimt 046.jpg')] },
  { s: 'gallery', artist: 'Georges Seurat', title: 'Uma tarde de domingo na Ilha de La Grande Jatte', year: 1886, tech: 'Óleo sobre tela', h: 207.5, w: 308.1, price: 28_000_000, about: 'Dois anos de trabalho em pequenos pontos de cor: a tela que fundou o pontilhismo.', img: [`${M}/1793215401232-u6o12av21i.jpg`] },
  { s: 'gallery', artist: 'Sandro Botticelli', title: 'O nascimento de Vênus', year: 1485, tech: 'Têmpera sobre tela', h: 172.5, w: 278.5, price: 45_000_000, about: 'Vênus chega à praia sobre uma concha, soprada pelos ventos; pintada em Florença por volta de 1485.', img: [`${M}/1793215403954-fai9nezvqo.jpg`] },
  { s: 'gallery', artist: 'Leonardo da Vinci', title: 'Mona Lisa', year: 1506, tech: 'Óleo sobre madeira de álamo', h: 77, w: 53, price: 90_000_000, about: 'Retrato de Lisa Gherardini, iniciado em Florença por volta de 1503.', img: [commons('Mona Lisa, by Leonardo da Vinci, from C2RMF retouched.jpg')] },
  { s: 'gallery', artist: 'Rembrandt van Rijn', title: 'A ronda noturna', year: 1642, tech: 'Óleo sobre tela', h: 363, w: 437, price: 60_000_000, about: 'A companhia do capitão Frans Banninck Cocq em movimento; retrato de grupo pintado em Amsterdã.', img: [commons('The Night Watch - HD.jpg'), commons('La ronda de noche, por Rembrandt van Rijn.jpg')] },
  { s: 'gallery', artist: 'Diego Velázquez', title: 'As meninas', year: 1656, tech: 'Óleo sobre tela', h: 318, w: 276, price: 58_000_000, about: 'A infanta Margarida com suas damas no ateliê do pintor, que se retrata diante da tela.', img: [commons('Las Meninas, by Diego Velázquez, from Prado in Google Earth.jpg')] },
  { s: 'gallery', artist: 'Pierre-Auguste Renoir', title: 'Baile no Moulin de la Galette', year: 1876, tech: 'Óleo sobre tela', h: 131, w: 175, price: 19_000_000, about: 'Uma tarde de domingo em Montmartre, com a luz filtrada pelas árvores.', img: [commons('Pierre-Auguste Renoir, Le Moulin de la Galette.jpg'), commons('Auguste Renoir - Dance at Le Moulin de la Galette - Musée d\'Orsay RF 2739 (derivative work - AutoContrast edit in LCH space).jpg')] },
  { s: 'gallery', artist: 'Pierre-Auguste Renoir', title: 'O almoço dos barqueiros', year: 1881, tech: 'Óleo sobre tela', h: 129.9, w: 172.7, price: 17_500_000, about: 'Amigos do pintor na varanda da Maison Fournaise, à beira do Sena.', img: [commons('Pierre-Auguste Renoir - Luncheon of the Boating Party - Google Art Project.jpg')] },
  { s: 'gallery', artist: 'Edgar Degas', title: 'A aula de dança', year: 1874, tech: 'Óleo sobre tela', h: 85, w: 75, price: 12_500_000, about: 'Bailarinas da Ópera de Paris ao fim de uma aula com o mestre Jules Perrot.', img: [commons('Edgar Degas - The Ballet Class - Google Art Project.jpg')] },
  { s: 'gallery', artist: 'Paul Cézanne', title: 'Os jogadores de cartas', year: 1895, tech: 'Óleo sobre tela', h: 47.5, w: 57, price: 15_000_000, about: 'Dois camponeses de Aix-en-Provence diante de uma mesa; da série pintada entre 1890 e 1895.', img: [commons('Les Joueurs de cartes, par Paul Cézanne.jpg'), commons('Paul Cézanne 222.jpg')] },
  { s: 'advisor', artist: 'Almeida Júnior', title: 'O violeiro', year: 1899, tech: 'Óleo sobre tela', h: 141, w: 172, price: 3_900_000, about: 'Um casal do interior paulista à janela; ele toca viola, ela canta.', img: [commons('Almeida Júnior - O Violeiro, 1899.jpg'), commons('Almeida Júnior - O Violeiro.jpg'), commons('O violeiro - Almeida Júnior.jpg')] },
  { s: 'advisor', artist: 'Almeida Júnior', title: 'Saudade', year: 1899, tech: 'Óleo sobre tela', h: 197, w: 101, price: 4_200_000, about: 'Uma mulher de luto lê uma carta junto à janela; uma das últimas telas do pintor.', img: [commons('Almeida Júnior - Saudade, 1899.jpg'), commons('Almeida Júnior - Saudade - Google Art Project.jpg')] },
  { s: 'advisor', artist: 'Pedro Américo', title: 'Independência ou morte', year: 1888, tech: 'Óleo sobre tela', h: 415, w: 760, price: 22_000_000, about: 'O grito do Ipiranga, pintado em Florença por encomenda do governo imperial.', img: [commons('Pedro Américo - Independência ou Morte - Google Art Project.jpg'), commons('Independence of Brazil 1888.jpg')] },
  { s: 'advisor', artist: 'Victor Meirelles', title: 'Primeira missa no Brasil', year: 1860, tech: 'Óleo sobre tela', h: 268, w: 356, price: 18_000_000, about: 'A missa de 26 de abril de 1500, a partir da carta de Pero Vaz de Caminha; pintada em Paris.', img: [commons('Meirelles-primeiramissa2.jpg'), commons('Victor Meirelles - Primeira Missa no Brasil - Google Art Project.jpg')] },
  { s: 'advisor', artist: 'Belmiro de Almeida', title: 'Arrufos', year: 1887, tech: 'Óleo sobre tela', h: 89, w: 116, price: 2_600_000, about: 'Uma briga de casal num interior burguês do Rio de Janeiro.', img: [commons('Belmiro de Almeida - Arrufos, 1887.jpg'), commons('Belmiro de Almeida - Arrufos.jpg')] },
  { s: 'advisor', artist: 'Edvard Munch', title: 'O grito', year: 1893, tech: 'Óleo, têmpera e pastel sobre cartão', h: 91, w: 73.5, price: 40_000_000, about: 'Uma figura na ponte sobre o fiorde de Oslo, sob um céu vermelho.', img: [commons('Edvard Munch, 1893, The Scream, oil, tempera and pastel on cardboard, 91 x 73 cm, National Gallery of Norway.jpg'), commons('The Scream.jpg')] },
  { s: 'advisor', artist: 'Utagawa Hiroshige', title: 'Chuva repentina sobre a ponte Shin-Ōhashi', year: 1857, tech: 'Xilogravura policromada sobre papel', h: 34, w: 24, cat: 'PRINT', series: 'Cem vistas famosas de Edo', price: 480_000, about: 'Pessoas correm da chuva sobre a ponte de Atake; Van Gogh copiou esta gravura a óleo em 1887.', img: [commons('Hiroshige Atake sous une averse soudaine.jpg'), commons('Hiroshige - Sudden Shower at the Atake Bridge.jpg')] },
]
const POSTS = {
  'Mona Lisa': 'Mona Lisa (c. 1503–1506), de Leonardo da Vinci. Óleo sobre madeira de álamo, 77 × 53 cm.',
  'As meninas': 'As meninas (1656), de Diego Velázquez: o pintor se retrata no próprio quadro, e o espelho ao fundo mostra o rei e a rainha.',
  'O beijo': 'O beijo (1907–1908), de Gustav Klimt. Óleo e folha de ouro sobre tela, 180 × 180 cm.',
  'Independência ou morte': 'Independência ou morte (1888), de Pedro Américo. São 4,15 × 7,60 m: veja em "Ver em parede" o tamanho ao lado de um sofá.',
  'O grito': 'O grito (1893), de Edvard Munch: óleo, têmpera e pastel sobre cartão.',
  'Terraço do café à noite': 'Terraço do café à noite (1888): a primeira vez em que pintei um céu estrelado, em Arles.',
}

let sharp = null
async function images(w, i) {
  if (FAKE) {
    const n = i % 9; const f = (name) => readFileSync(path.join(DIR, 'images', name))
    return { front: f(`front-${n}.jpg`), macros: ['tl', 'tr', 'bl', 'br'].map((k) => f(`macro-${n}-${k}.jpg`)) }
  }
  sharp ??= (await import('sharp')).default
  let src = null
  for (const url of w.img) {
    const r = await fetch(url, { headers: { 'user-agent': 'houseart-demo/1.0 (demo content; public domain works)' }, redirect: 'follow' })
    if (r.ok && (r.headers.get('content-type') ?? '').startsWith('image/')) { src = Buffer.from(await r.arrayBuffer()); break }
  }
  if (!src) return null
  const front = await sharp(src).rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
  const { width, height } = await sharp(front).metadata()
  const cw = Math.round(width * 0.42), ch = Math.round(height * 0.42)
  const macros = []
  for (const [left, top] of [[0, 0], [width - cw, 0], [0, height - ch], [width - cw, height - ch]]) macros.push(await sharp(front).extract({ left, top, width: cw, height: ch }).resize({ width: 1200 }).jpeg({ quality: 86 }).toBuffer())
  return { front, macros }
}
const file = (buf, name) => new File([buf], name, { type: 'image/jpeg' })
async function upload(actor, artworkId, kind, f) { const fd = new FormData(); fd.append('kind', kind); fd.append('file', f); return actor.post(`/api/artworks/${artworkId}/media`, fd) }

let uidSeq = Date.now() % 0xfffff
const freshUid = () => `04${(uidSeq++).toString(16).padStart(12, '0')}`.slice(0, 14)

async function main() {
  console.log(`HouseArt · mais obras reais em ${BASE}`)
  for (const a of [admin, vangogh, hokusai, gallery, advisor]) await a.login()
  const back = readFileSync(path.join(DIR, 'images', 'back.jpg'))
  const artistIds = {}
  for (const key of ['gallery', 'advisor']) {
    const actor = SELLERS[key]
    let list = (await actor.get('/api/gallery/artists')).artists ?? []
    for (const name of [...new Set(WORKS.filter((w) => w.s === key).map((w) => w.artist))]) {
      if (!list.find((x) => x.name === name)) list = (await actor.post('/api/gallery/artists', { name, kind: 'REPRESENTED', galleryBps: 5000 })).artists
      artistIds[`${key}:${name}`] = list.find((x) => x.name === name)?.id
    }
  }
  const done = [], skipped = []
  for (const [i, w] of WORKS.entries()) {
    const actor = SELLERS[w.s]
    const mine = (await actor.get('/api/artworks')).items ?? []
    if (mine.find((x) => x.title === w.title && x.status !== 'DRAFT')) { STEP(`"${w.title}" já existe`); continue }
    const img = await images(w, i)
    if (!img) { skipped.push(w.title); STEP(`"${w.title}": imagem não veio — pulada`); continue }
    const artistId = w.artist ? artistIds[`${w.s}:${w.artist}`] : undefined
    const id = (await actor.post('/api/artworks', { title: w.title, ...(artistId ? { artistId } : {}) })).id
    await actor.patch(`/api/artworks/${id}`, { title: w.title, year: w.year, technique: w.tech, heightMm: w.h, widthMm: w.w, category: w.cat ?? 'PAINTING', conditionGrade: 'EXCELLENT', series: w.series ?? null, description: w.about + NOTE, signatureLocation: 'Sem assinatura aparente' })
    await upload(actor, id, 'FRONT_COLOR_CARD', file(img.front, 'front.jpg'))
    await upload(actor, id, 'BACK', file(back, 'back.jpg'))
    for (const [k, kind] of ['MACRO_TL', 'MACRO_TR', 'MACRO_BL', 'MACRO_BR'].entries()) await upload(actor, id, kind, file(img.macros[k], `${kind}.jpg`))
    const sheet = await actor.get(`/api/artworks/${id}`)
    for (const d of sheet.duplicateChecks ?? []) if (d.decision === 'PENDING') await actor.post(`/api/artworks/${id}/duplicates/${d.id}`, { decision: 'DIFFERENT' }, { allow: [400, 404, 409] })
    await actor.post(`/api/artworks/${id}/submit`)
    // one marker per work: asked, shipped from a batch of one, linked, signed, issued
    const order = await actor.post('/api/markers/orders', { quantity: 1 })
    const uid = freshUid()
    const batch = await admin.post('/api/admin/markers/batches', { code: `${new Date().toISOString().slice(0, 7)}-M${Date.now().toString(36).toUpperCase()}`, quantity: 1, destination: actor.name, uids: [uid] })
    await admin.post(`/api/admin/markers/orders/${order.id}/ship`, { batchId: batch.id })
    const link = await actor.post('/api/markers/link', { ...sun(uid, 1), artworkId: id })
    await actor.post(`/api/certificates/${link.certificateId}/sign`)
    await actor.post(`/api/certificates/${link.certificateId}/issue`)
    await actor.post(`/api/artworks/${id}/list`, { listPriceCents: w.price, reservePriceCents: Math.round(w.price * 0.85), autoNegotiatorOn: i % 3 === 0, autoAcceptMinBps: 9500, fixedPrice: i % 4 === 3 })
    if (POSTS[w.title]) await actor.post('/api/community/posts', { kind: 'PHOTO', body: POSTS[w.title], artworkId: id }, { allow: [400, 403, 404, 409, 422] })
    done.push(link.publicId)
    STEP(`${actor.name}: "${w.title}" certificada e à venda → ${link.publicId}`)
  }
  console.log(`\n✓ ${done.length} obras novas${skipped.length ? ` · puladas (sem imagem): ${skipped.join(', ')}` : ''}`)
}

main().catch((e) => fail(e?.stack ?? String(e)))
