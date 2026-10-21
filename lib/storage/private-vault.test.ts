import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deleteVaultFile, isVaultRef, openVaultFileStream, readVaultFile, savePrivateFile } from './private-vault'

const cwd = process.cwd()
let dir = ''
beforeAll(() => { dir = mkdtempSync(path.join(os.tmpdir(), 'ha-vault-')); process.chdir(dir); delete process.env.VERCEL; delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN })
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }) })

describe('private vault (disk mode)', () => {
  it('saves under private/, reads back, streams and deletes', async () => {
    const ref = await savePrivateFile({ buffer: Buffer.from('%PDF-1.4 x'), contentType: 'application/pdf', prefix: 'artworks/7/../x' })
    expect(isVaultRef(ref)).toBe(true)
    expect(ref).toMatch(/^vault:private\/artworks\/7\/x\/\d+-[a-z0-9]+\.pdf$/)
    expect((await readVaultFile(ref)).toString()).toBe('%PDF-1.4 x')
    const s = await openVaultFileStream(ref)
    expect(s.size).toBe(10)
    await deleteVaultFile(ref)
    await expect(readVaultFile(ref)).rejects.toThrow()
  })
  it('refuses references outside private/', async () => {
    await expect(readVaultFile('vault:../etc/passwd')).rejects.toThrow('inválida')
    await expect(readVaultFile('vault:private/../x')).rejects.toThrow('inválida')
  })
})
