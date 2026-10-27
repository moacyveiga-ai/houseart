// Perfil › Dados pessoais (audit colecionador §16, prototype `ctDados`): the "Sobre você" line and
// the profile photo. Pure.
import { hasContactLeak } from '@/lib/messaging/core'

export const ABOUT_MAX = 280
/** The avatar is a square crop of this side (JPEG), small enough for every place it shows. */
export const AVATAR_SIDE = 512

/** "Sobre você": one short text, spaces collapsed; empty clears it; contacts are refused, as in the chat. */
export function cleanAbout(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (value.length > ABOUT_MAX) return { ok: false, error: `Escreva até ${ABOUT_MAX} caracteres.` }
  if (value && hasContactLeak(value)) return { ok: false, error: 'Sem telefone, e-mail ou redes sociais no texto: os contatos seguem pela HouseArt.' }
  return { ok: true, value }
}

