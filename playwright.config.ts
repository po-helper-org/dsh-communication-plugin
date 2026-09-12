/**
 * E2E-прогоны раздела против живого харнесса (см. e2e/support/harness.ts, почему живого).
 *
 * Один воркер намеренно: прогоны делят один документ настроек. Браузер — системный
 * Chrome (`channel: 'chrome'`): ничего не скачивается, тот же движок, что у PO. Профиль
 * у прогона свой, пустой — значит клиент ленты во фрейме ничего о входе не знает, и
 * каждый прогон заодно проверяет автовход через seed.html.
 */
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: 'e2e/.artifacts/test-results',
  use: {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
})
