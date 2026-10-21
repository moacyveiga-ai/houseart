export const PASSWORD_MIN = 8
export function passwordProblem(p: string): string | null {
  if (typeof p !== 'string' || p.length < PASSWORD_MIN) return `A senha precisa ter ao menos ${PASSWORD_MIN} caracteres.`
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'A senha precisa ter letras e números.'
  return null
}
