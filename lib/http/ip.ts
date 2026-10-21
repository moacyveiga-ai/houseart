// ════════════════════════════════════════════════════════════════════════════
//  HTTP — o IP de quem chamou, para os limitadores por IP (PURO)
// ────────────────────────────────────────────────────────────────────────────
//  Uma leitura só para toda superfície pública da casa (HouseCredito, rede de
//  membros, páginas públicas por token). A regra que importa:
//
//    `x-vercel-forwarded-for` → o ÚLTIMO valor de `x-forwarded-for` →
//    `x-real-ip` → `'no-ip'`   (revisão da Fase 3, 2026-09-21: `x-real-ip`
//    saiu da frente porque não há garantia de que o proxy o sobrescreva —
//    se repassar o do cliente, o atacante escolhe a chave do balde)
//
//  IPv6 entra pelo prefixo /64 (um cliente comum tem 2^64 endereços; sem
//  isso trocar de endereço a cada request dá baldes infinitos).
//
//  O ÚLTIMO, e não o primeiro: `x-forwarded-for` é uma cadeia em que o
//  cliente escreve o começo e cada proxy acrescenta ao fim — quem quer furar
//  o limitador manda `X-Forwarded-For: 1.2.3.4` e ganha um balde novo por
//  requisição se lermos o primeiro. O último salto é o que a Vercel
//  acrescentou, o único que o cliente não controla. Sem cabeçalho nenhum
//  (dev, roteiro) o balde é único: `'no-ip'`.
//
//  Até 2026-09-07 esta regra vivia copiada em lib/housecredito/http.ts e em
//  lib/rede/publico-http.ts (os dois agora reexportam daqui). Desde
//  2026-10-02 (QA geral) o HouseValor público, o portal da negociação, a
//  revelação de CPF, a recuperação de senha e os contextos de auditoria
//  (`contextoRequest`, `contextoSessao`) usam `ipOf` (balde) e `rawIpOf`
//  (evidência e Turnstile) — nenhuma leitura do 1.º salto sobrou.
// ════════════════════════════════════════════════════════════════════════════

/** Teto do que entra no balde do limitador — chave de mapa não vira vetor de memória. */
export const MAX_IP = 120

/** "a, b, c" → "c" (o ÚLTIMO valor não vazio); "" / null → null. */
export function lastValue(bruto: string | null): string | null {
  if (!bruto) return null
  const partes = bruto.split(',').map((p) => p.trim()).filter(Boolean)
  return partes.length > 0 ? partes[partes.length - 1] : null
}

/** IP a partir de um `Headers` — o de `NextRequest.headers` nas rotas, o de `await headers()` nas páginas. */
export function ipFromHeaders(h: Headers): string {
  const bruto =
    lastValue(h.get('x-vercel-forwarded-for')) ??
    lastValue(h.get('x-forwarded-for')) ??
    lastValue(h.get('x-real-ip')) ??
    'no-ip'
  return normalizeIp(bruto).slice(0, MAX_IP)
}

/**
 * O endereço EXATO, sem o /64 — para o `remoteip` do Turnstile (que exige um
 * IP válido) e para evidência de consentimento (artefato probatório). Para
 * chave de balde, use `ipFromHeaders`/`ipOf`.
 */
export function rawIpFromHeaders(h: Headers): string {
  const bruto =
    lastValue(h.get('x-vercel-forwarded-for')) ??
    lastValue(h.get('x-forwarded-for')) ??
    lastValue(h.get('x-real-ip')) ??
    'no-ip'
  return bruto.slice(0, MAX_IP)
}

export function rawIpOf(req: { headers: Headers }): string {
  return rawIpFromHeaders(req.headers)
}

/** IPv6 → prefixo /64 (`2001:db8:1:2::/64`); IPv4 e o resto passam como vieram. */
export function normalizeIp(ip: string): string {
  const semPorta = ip.replace(/^\[(.*)\]:\d+$/, '$1')
  if (!semPorta.includes(':')) return semPorta
  const v4Mapeado = semPorta.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (v4Mapeado) return v4Mapeado[1]
  // Expande `::` para 8 grupos e fica com os 4 primeiros.
  const [cabeca, cauda = ''] = semPorta.split('::')
  const a = cabeca ? cabeca.split(':') : []
  const b = cauda ? cauda.split(':') : []
  const grupos = [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b]
  if (grupos.length !== 8 || grupos.some((g) => !/^[0-9a-f]{0,4}$/i.test(g))) return semPorta
  return `${grupos.slice(0, 4).map((g) => g.toLowerCase() || '0').join(':')}::/64`
}

/** IP de quem chamou, a partir de qualquer objeto com `headers` (`NextRequest`, `Request`). */
export function ipOf(req: { headers: Headers }): string {
  return ipFromHeaders(req.headers)
}
