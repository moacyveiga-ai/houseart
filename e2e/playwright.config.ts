// Smoke suite (the 5 journeys of the brief) against a running build.
//   npm run smoke            → http://localhost:3019 (next start -p 3019 with the flags on)
//   SMOKE_BASE_URL=https://… → against a deployment (read-only journeys only: SMOKE_READONLY=1)
import { defineConfig } from '@playwright/test'

/** What the journeys read from the environment (declared here: the env ratchet scans this file, not *.smoke.ts). */
export const SMOKE = {
  readonly: process.env.SMOKE_READONLY === '1',
  artist: { credential: process.env.SMOKE_ARTIST_EMAIL ?? 'joana@artista.test', password: process.env.SMOKE_ARTIST_PASSWORD ?? 'senha-forte-1' },
  admin: { credential: process.env.SMOKE_ADMIN_EMAIL ?? 'admin@local.dev', password: process.env.SMOKE_ADMIN_PASSWORD ?? 'admin123' },
}

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.smoke\.ts/,
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? 'http://localhost:3019',
    trace: 'retain-on-failure',
    // a preinstalled Chromium (PLAYWRIGHT_CHROMIUM_PATH) avoids `playwright install` in sandboxes/CI
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  reporter: [['list']],
})
