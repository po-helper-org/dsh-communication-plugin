/**
 * Сценарий 2 плейбука: карточка раздела в Настройки → Плагины — подключение, метки,
 * проверка токена и перемаркировка в режиме показа. Ничего не сохраняется.
 */
import { expect, test } from '@playwright/test'
import { openCard, openHarness, requireHarness, shot } from './support/harness.ts'

const S = '02-settings'

test('карточка настроек: подключение, метки, проверка, показ перемаркировки', async ({ page }) => {
  const url = await requireHarness()
  await openHarness(page, url)
  const card = await openCard(page)
  await shot(page, S, '01-card', card.getByText('Подключение', { exact: true }))

  await card.getByRole('button', { name: 'Проверить' }).click()
  await expect(card.getByText(/токен принят/)).toBeVisible({ timeout: 20_000 })
  await shot(page, S, '02-verify', card.getByText(/токен принят/))

  const labels = card.getByText('Метки', { exact: true })
  await labels.scrollIntoViewIfNeeded()
  await shot(page, S, '03-labels', labels)

  const dry = card.getByRole('button', { name: 'Что изменится' })
  await dry.scrollIntoViewIfNeeded()
  await dry.click()
  const output = card.getByLabel('Вывод перемаркировки')
  await expect(output).toContainText(/без изменений|править/, { timeout: 110_000 })
  await output.scrollIntoViewIfNeeded()
  await shot(page, S, '04-relabel-dry', output)
})
