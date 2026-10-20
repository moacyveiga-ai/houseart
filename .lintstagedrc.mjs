// Só os arquivos staged passam por aqui. --max-warnings=0 faz aviso virar
// bloqueio (ex.: no-unused-vars). Desde 2026-09-21 (Fase 1) o repo tem zero
// avisos e `npm run lint` também roda com --max-warnings=0: aviso novo derruba
// o gate e a CI, não só este hook.
const config = {
  '*.{ts,tsx,mts,cts,mjs,js,jsx}': ['eslint --max-warnings=0 --no-warn-ignored'],
}

export default config
