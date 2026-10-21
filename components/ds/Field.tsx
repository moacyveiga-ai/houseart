// Input of the handoff: label (body-sm 600) + input (radius sm, border ink-300 →
// hover ink-500 → focus ink-900 + sand ring); error = alert border + caption;
// disabled = paper-200 border, paper-100 background, ink-300 text.
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

type Base = { label: ReactNode; error?: string; hint?: ReactNode; id?: boolean }

export function Field({ label, error, hint, id: isId, className = '', ...rest }: Base & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { className?: string }) {
  return (
    <label className={`ha-label${rest.disabled ? ' ha-label--disabled' : ''}`}>
      {label}
      <input {...rest} aria-invalid={error ? true : undefined} className={['ha-input', isId ? 'ha-input--id' : '', error ? 'ha-input--error' : '', className].filter(Boolean).join(' ')} />
      {error ? <span className="ha-field-error">{error}</span> : hint ? <span className="ha-caption">{hint}</span> : null}
    </label>
  )
}

export function SelectField({ label, error, hint, children, ...rest }: Base & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <label className={`ha-label${rest.disabled ? ' ha-label--disabled' : ''}`}>
      {label}
      <select {...rest} aria-invalid={error ? true : undefined} className={`ha-select${error ? ' ha-input--error' : ''}`}>{children}</select>
      {error ? <span className="ha-field-error">{error}</span> : hint ? <span className="ha-caption">{hint}</span> : null}
    </label>
  )
}

export function TextareaField({ label, error, hint, ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`ha-label${rest.disabled ? ' ha-label--disabled' : ''}`}>
      {label}
      <textarea {...rest} aria-invalid={error ? true : undefined} className={`ha-textarea${error ? ' ha-input--error' : ''}`} />
      {error ? <span className="ha-field-error">{error}</span> : hint ? <span className="ha-caption">{hint}</span> : null}
    </label>
  )
}
