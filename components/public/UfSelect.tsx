'use client'
// The UF <select> of the galleries list: submits its GET form on change
// (without JS the <noscript> button next to it does it).
export function UfSelect({ ufs, value }: { ufs: string[]; value: string }) {
  return (
    <select id="galleries-uf" name="uf" defaultValue={value} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      <option value="">Todos</option>
      {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
    </select>
  )
}
