/**
 * Сценарий 1 плейбука: открыть ленту, увидеть столбец и фильтр по меткам.
 * Шаги и кадры — в том же порядке, что в docs/guides/plugin-playbooks/01-feed-column.md.
 */
import { expect, test } from '@playwright/test'
import { column, feedFrame, openHarness, pill, requireHarness, sectionButton, shot } from './support/harness.ts'

const S = '01-feed-column'

test('лента открывается столбцом и фильтруется меткой', async ({ page }) => {
  const url = await requireHarness()
  await openHarness(page, url)
  await shot(page, S, '01-open', sectionButton(page))

  await sectionButton(page).click()
  await expect(column(page)).toBeVisible()
  await expect(pill(page, 'Все')).toHaveAttribute('data-active')
  // Автовход: профиль браузера пустой, а фрейм обязан открыть Home, а не страницу входа.
  await expect(feedFrame(page).getByRole('heading', { name: /^(Домашняя|Home)$/ })).toBeVisible({ timeout: 30_000 })
  await shot(page, S, '02-column')

  await pill(page, 'Продукт').click()
  await expect(pill(page, 'Продукт')).toHaveAttribute('data-active')
  await expect(feedFrame(page).getByText('#продукт', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
  await shot(page, S, '03-label', pill(page, 'Продукт'))

  // Пустая метка погашена, а не спрятана: видно, что фильтр есть, а постов под ним нет.
  await expect(pill(page, 'GDS')).toHaveAttribute('data-empty')
  await shot(page, S, '04-empty', pill(page, 'GDS'))

  await column(page).getByRole('button', { name: 'Закрыть раздел' }).click()
  await expect(column(page)).toBeHidden()
})
