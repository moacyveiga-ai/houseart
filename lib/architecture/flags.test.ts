// Feature-flag ratchet (ported from the Housebroker, QA section 6):
//  · nobody reads a flag from `process.env` outside lib/flags.ts;
//  · every flag name cited in code exists in the `FLAGS` registry;
//  · every registered flag is in .env.example;
//  · only FLAG_TENANT_SCOPE is born ON — money never is.
import { describe, expect, it } from 'vitest'
import { FLAGS, flagOn } from '../flags'
import { read, sourceFiles } from './source-graph'

const NAME = /\b(FLAG_[A-Z0-9_]+)\b/g
const READ = /\benv\??\.(FLAG_[A-Z0-9_]+)\b|\benv\[['"`](FLAG_[A-Z0-9_]+)|\{[^}]*\bFLAG_[A-Z0-9_]+\b[^}]*\}\s*=\s*process\.env/
const noComments = (code: string) => code.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
const files = [...sourceFiles('lib', 'app', 'components'), 'middleware.ts'].filter((f) => f !== 'lib/flags.ts')

describe('feature-flag ratchet', () => {
  it('no flag read from process.env outside lib/flags.ts', () => {
    const found: string[] = []
    for (const f of files) {
      noComments(read(f)).split('\n').forEach((line, i) => {
        if (READ.test(line) && !/^\s*(FLAG_[A-Z0-9_]+)\??:\s*string/.test(line)) found.push(`${f}:${i + 1}`)
      })
    }
    expect(found).toEqual([])
  })

  it('every flag name cited in code is registered', () => {
    const known = new Set(Object.keys(FLAGS))
    const unknown = new Set<string>()
    for (const f of files) for (const m of noComments(read(f)).matchAll(NAME)) if (!known.has(m[1])) unknown.add(`${m[1]} (${f})`)
    expect([...unknown]).toEqual([])
  })

  it('every registered flag is documented in .env.example', () => {
    const example = read('.env.example')
    expect(Object.keys(FLAGS).filter((n) => !new RegExp(`^#?\\s*${n}=`, 'm').test(example))).toEqual([])
  })

  it('flagOn accepts exactly the value each flag declares', () => {
    expect(flagOn('FLAG_DEALS', { FLAG_DEALS: '1' })).toBe(true)
    expect(flagOn('FLAG_DEALS', { FLAG_DEALS: ' 1' })).toBe(false)
    expect(flagOn('FLAG_DEALS', { FLAG_DEALS: 'true' })).toBe(false)
    expect(flagOn('FLAG_DEALS', {})).toBe(false)
    expect(flagOn('FLAG_FEDERATED_PROVISIONING', { FLAG_FEDERATED_PROVISIONING: ' 1 ' })).toBe(true)
    expect(flagOn('FLAG_PROVENANCE_CONSENT_REQUIRED', { FLAG_PROVENANCE_CONSENT_REQUIRED: 'on' })).toBe(true)
    expect(flagOn('FLAG_PROVENANCE_CONSENT_REQUIRED', { FLAG_PROVENANCE_CONSENT_REQUIRED: '1' })).toBe(false)
    expect(flagOn('FLAG_PROVENANCE_CHECKS_AUTO', { FLAG_PROVENANCE_CHECKS_AUTO: 'true' })).toBe(true)
    expect(flagOn('FLAG_PROVENANCE_CHECKS_AUTO', { FLAG_PROVENANCE_CHECKS_AUTO: '1' })).toBe(false)
  })

  it('only the tenant scope is born ON (`defaultOn`) — money flags never', () => {
    const born = Object.entries(FLAGS).filter(([, f]) => 'defaultOn' in f).map(([n]) => n)
    expect(born).toEqual(['FLAG_TENANT_SCOPE'])
    expect(flagOn('FLAG_TENANT_SCOPE', {})).toBe(true)
    expect(flagOn('FLAG_TENANT_SCOPE', { FLAG_TENANT_SCOPE: '0' })).toBe(false)
    for (const v of ['no', 'off', 'disabled', '00', 'n', 'yes']) expect(flagOn('FLAG_TENANT_SCOPE', { FLAG_TENANT_SCOPE: v }), v).toBe(false)
    for (const v of ['', ' ', '1', 'true', 'ON']) expect(flagOn('FLAG_TENANT_SCOPE', { FLAG_TENANT_SCOPE: v }), v).toBe(true)
  })
})
