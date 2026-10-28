'use client'
// Perfil › Aparência: Claro · Pastel · Escuro. The choice lives in this browser (localStorage,
// lib/theme.ts) and applies at once; the public site and the entry screens stay light.
import { useTheme } from '@/lib/theme'
import type { Theme } from '@/lib/theme-routes'
import { Icon } from '@/components/ds/Icon'
import './theme-picker.css'

const OPTIONS: { value: Theme; label: string; sub: string; swatch: [string, string, string] }[] = [
  { value: 'light', label: 'Claro', sub: 'Papel e tinta', swatch: ['#FBFAF7', '#ECE7DF', '#111111'] },
  { value: 'pastel', label: 'Pastel', sub: 'Lilás suave', swatch: ['#F8F4FC', '#E1D6F0', '#2B2340'] },
  { value: 'dark', label: 'Escuro', sub: 'Para a noite', swatch: ['#141414', '#34312D', '#F4F1EC'] },
]

export function ThemePicker() {
  const [theme, setTheme] = useTheme()
  const current = theme === 'system' ? 'light' : theme
  return (
    <section className="ha-account-sec" aria-label="Aparência">
      <span className="ha-account-sec__k">Aparência</span>
      <div className="ha-theme-pick" role="radiogroup" aria-label="Tema do painel">
        {OPTIONS.map((o) => {
          const on = current === o.value
          return (
            <button key={o.value} type="button" role="radio" aria-checked={on} className={`ha-theme-pick__opt${on ? ' is-on' : ''}`} onClick={() => setTheme(o.value)}>
              <span className="ha-theme-pick__sw" aria-hidden="true" style={{ background: o.swatch[0], borderColor: o.swatch[1] }}>
                <span style={{ background: o.swatch[1] }} />
                <span style={{ background: o.swatch[2] }} />
              </span>
              <span className="ha-theme-pick__txt"><span className="ha-theme-pick__n">{o.label}</span><span className="ha-theme-pick__s">{o.sub}</span></span>
              {on ? <Icon name="check_circle" size={20} filled className="ha-theme-pick__ok" /> : null}
            </button>
          )
        })}
      </div>
      <span className="ha-theme-pick__note">Vale neste aparelho. O site público continua claro.</span>
    </section>
  )
}
