// Input of the handoff: label (body-sm 600) + input (radius sm, border ink-300 →
// hover ink-500 → focus ink-900 + sand ring); error = alert border + caption;
// disabled = paper-200 border, paper-100 background, ink-300 text.
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

type Base = { label: ReactNode; error?: string; hint?: ReactNode; id?: boolean }

/** The error or hint under the control, named so the control can point at it (`aria-describedby`). */
function Note({ id, error, hint }: { id: string; error?: string; hint?: ReactNode }) {
  if (error) return <span id={id} className="ha-field-error" role="alert">{error}</span>
  return hint ? <span id={id} className="ha-caption">{hint}</span> : null
}

export function Field({ label, error, hint, id: isId, className = '', ...rest }: Base & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { className?: string }) {
  const noteId = useId()
  return (
    <label className={`ha-label${rest.disabled ? ' ha-label--disabled' : ''}`}>
      {label}
      <input {...rest} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? noteId : undefined} className={['ha-input', isId ? 'ha-input--id' : '', error ? 'ha-input--error' : '', className].filter(Boolean).join(' ')} />
      <Note id={noteId} error={error} hint={hint} />
    </label>
  )
}

export function SelectField({ label, error, hint, children, ...rest }: Base & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const noteId = useId()
  return (
    <label className={`ha-label${rest.disabled ? ' ha-label--disabled' : ''}`}>
      {label}
      <select {...rest} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? noteId : undefined} className={`ha-select${error ? ' ha-input--error' : ''}`}>{children}</select>
      <Note id={noteId} error={error} hint={hint} />
    </label>
  )
}

export function TextareaField({ label, error, hint, ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const noteId = useId()
  return (
    <label className={`ha-label${rest.disabled ? ' ha-label--disabled' : ''}`}>
      {label}
      <textarea {...rest} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? noteId : undefined} className={`ha-textarea${error ? ' ha-input--error' : ''}`} />
      <Note id={noteId} error={error} hint={hint} />
    </label>
  )
}
