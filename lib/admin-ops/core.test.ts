import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cronHealth, CRONS, intervalOfSchedule } from './core'

const now = new Date('2026-10-26T15:00:00Z')
const run = (status: string, minutesAgo: number) => ({ status, startedAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(), finishedAt: null, ms: 10, httpStatus: status === 'FAILED' ? 500 : 200, error: null, summary: null })

describe('admin ops core', () => {
  it('the catalog mirrors vercel.json', () => {
    const v = JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons: { path: string; schedule: string }[] }
    expect(CRONS.map((c) => [c.path, c.schedule])).toEqual(v.crons.map((c) => [c.path, c.schedule]))
    expect(CRONS.map((c) => c.path)).toEqual(CRONS.map((c) => `/api/cron/${c.name}`))
  })
  it('reads the interval of a schedule', () => {
    expect(intervalOfSchedule('15 * * * *')).toBe(3_600_000)
    expect(intervalOfSchedule('50 */6 * * *')).toBe(6 * 3_600_000)
    expect(intervalOfSchedule('20 3 * * *')).toBe(24 * 3_600_000)
  })
  it('derives the health from the trail', () => {
    const hourly = { schedule: '15 * * * *' }
    expect(cronHealth(hourly, [], null, now)).toBe('NEVER')
    expect(cronHealth(hourly, [run('OK', 30)], null, now)).toBe('OK')
    expect(cronHealth(hourly, [run('SKIPPED', 30), run('OK', 90)], null, now)).toBe('OK')
    expect(cronHealth(hourly, [run('OK', 200)], null, now)).toBe('LATE')
    expect(cronHealth(hourly, [run('FAILED', 10), run('OK', 70)], null, now)).toBe('FAILING')
    expect(cronHealth(hourly, [run('FAILED', 10), run('FAILED', 70), run('OK', 300)], null, now)).toBe('FAILING')
    expect(cronHealth(hourly, [run('RUNNING', 1), run('OK', 61)], null, now)).toBe('RUNNING')
    expect(cronHealth(hourly, [run('OK', 30)], { lockedUntil: new Date(now.getTime() + 60_000).toISOString() }, now)).toBe('RUNNING')
    expect(cronHealth({ schedule: '20 3 * * *' }, [run('OK', 40 * 60)], null, now)).toBe('OK')
  })
})
