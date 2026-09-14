/**
 * Сценарий 3: подключение Telegram из интерфейса — по спецификации
 * docs/telegram-setup-spec.md, шаги HowToDemo один к одному.
 *
 * Реализации ещё нет: каждый прогон помечен `test.fail` с номером шага, на котором он
 * обязан споткнуться сегодня. Playwright считает такой прогон пройденным, пока он
 * ПАДАЕТ, и загорится «unexpectedly passed», когда шаг заработает, — тогда пометку
 * снимают. Так суите зелёная сейчас и не даст забыть, что спецификация ещё не код.
 *
 * Оговорка, которую надо помнить: прогон в режиме ожидаемого падения падает на первом
 * же ненайденном элементе и дальше не идёт. Локаторы после этой точки не проверены —
 * их правят вместе с реализацией.
 *
 * Telegram — заглушка брокера (ФТ-4): ключ `1` / `e2e-fake` — вход по коду `12345`,
 * три папки, три сообщения за час; `e2e-broken` — вход всегда падает. Настоящий
 * Telegram в прогоне не участвует: код из приложения спросить некому.
 *
 * Ничего не сохраняется: значения вводятся в форму, «Сохранить» не нажимается,
 * а вход в заглушку сессии не заводит.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { column, openCard, openHarness, requireHarness, shot } from './support/harness.ts'

const S = '03-telegram-setup'
const FAKE = { apiId: '1', apiHash: 'e2e-fake', phone: '+70000000000', code: '12345' }

/** Иконка Telegram в полосе каналов карточки. Состояние — в `data-state` (ПТ-1). */
function telegramIcon(card: Locator): Locator {
  return card.getByRole('button', { name: /^Telegram/ })
}

/** Раскрытый блок Telegram (ПТ-2). */
function telegramBlock(card: Locator): Locator {
  return card.getByRole('region', { name: 'Telegram' })
}

// Сначала проверка видимости, потом действие: отказ проверки — это «failed», который
// `test.fail` принимает; зависший клик — «timedOut», который он не принимает.
async function fill(block: Locator, label: string, value: string): Promise<void> {
  const input = block.getByLabel(label)
  await expect(input).toBeVisible()
  await input.fill(value)
}

async function openTelegram(page: Page): Promise<{ card: Locator; block: Locator }> {
  const card = await openCard(page)
  const icon = telegramIcon(card)
  await expect(icon).toBeVisible()
  await icon.click()
  const block = telegramBlock(card)
  await expect(block).toBeVisible()
  return { card, block }
}

test.describe('подключение Telegram из интерфейса', () => {
  test('шаги 4–6: иконка, блок, инструкция в столбце', async ({ page }) => {
    test.fail(true, 'спецификация: шаг 4 — полосы каналов в карточке ещё нет')
    const url = await requireHarness()
    await openHarness(page, url)
    const card = await openCard(page)

    // 4. Иконка Telegram в полосе каналов; состояние по умолчанию — «не настроен».
    const icon = telegramIcon(card)
    await expect(icon).toBeVisible()
    await expect(icon).toHaveAttribute('data-state', 'unconfigured')
    await shot(page, S, '01-channels', icon)

    // 5. Раскрытие блока.
    await icon.click()
    const block = telegramBlock(card)
    await expect(block.getByLabel('App ID')).toBeVisible()
    await expect(block.getByLabel('API hash')).toBeVisible()
    await expect(block.getByLabel('Телефон')).toBeVisible()
    await shot(page, S, '02-block')

    // 6. «Смотреть инструкцию» — Markdown в столбце справа.
    await block.getByRole('link', { name: 'Смотреть инструкцию' }).click()
    await expect(column(page)).toBeVisible()
    await expect(column(page).getByRole('heading', { name: /my\.telegram\.org/ })).toBeVisible()
    await expect(column(page).locator('img').first()).toBeVisible()
    await shot(page, S, '03-guide')
  })

  test('шаги 7–8: код, вход, подтверждение', async ({ page }) => {
    test.fail(true, 'спецификация: шаг 7 — формы входа ещё нет')
    const url = await requireHarness()
    await openHarness(page, url)
    const { card, block } = await openTelegram(page)

    // 7. Ключ приложения и телефон; код приходит после «Получить код».
    await fill(block, 'App ID', FAKE.apiId)
    await fill(block, 'API hash', FAKE.apiHash)
    await fill(block, 'Телефон', FAKE.phone)
    await block.getByRole('button', { name: 'Получить код' }).click()
    await expect(block.getByLabel('Код из Telegram')).toBeVisible()
    await shot(page, S, '04-code-sent')

    await fill(block, 'Код из Telegram', FAKE.code)
    await block.getByRole('button', { name: 'Войти' }).click()

    // 8. Подтверждение: имя учётки из заглушки.
    await expect(block.getByText(/Вошли как/)).toBeVisible()
    await expect(telegramIcon(card)).toHaveAttribute('data-state', 'needs-test')
    await shot(page, S, '05-signed-in', block.getByText(/Вошли как/))
  })

  test('шаги 9–11: папки из Telegram и «Читать все»', async ({ page }) => {
    test.fail(true, 'спецификация: шаг 9 — выбора папок ещё нет')
    const url = await requireHarness()
    await openHarness(page, url)
    const { block } = await openTelegram(page)
    await fill(block, 'App ID', FAKE.apiId)
    await fill(block, 'API hash', FAKE.apiHash)
    await fill(block, 'Телефон', FAKE.phone)
    await block.getByRole('button', { name: 'Получить код' }).click()
    await fill(block, 'Код из Telegram', FAKE.code)
    await block.getByRole('button', { name: 'Войти' }).click()
    await expect(block.getByText(/Вошли как/)).toBeVisible()

    // 9–10. Список папок появляется после входа и грузится при раскрытии.
    const readAll = block.getByRole('checkbox', { name: 'Читать все' })
    await expect(readAll).toBeChecked()
    await block.getByRole('button', { name: 'Папки' }).click()
    const folders = block.getByRole('group', { name: 'Папки Telegram' })
    await expect(folders.getByRole('checkbox')).toHaveCount(3)
    await shot(page, S, '06-folders')

    // 11. Взаимоисключение: отметка папки снимает «Читать все», и наоборот.
    const first = folders.getByRole('checkbox').first()
    await first.check()
    await expect(readAll).not.toBeChecked()
    await readAll.check()
    await expect(first).not.toBeChecked()
    await expect(folders.getByRole('checkbox', { checked: true })).toHaveCount(0)
    await shot(page, S, '07-read-all')
  })

  test('шаги 12–13: тест — лента за час, иконка «подключено»', async ({ page }) => {
    test.fail(true, 'спецификация: шаг 12 — кнопки «Тест» ещё нет')
    const url = await requireHarness()
    await openHarness(page, url)
    const { card, block } = await openTelegram(page)
    await fill(block, 'App ID', FAKE.apiId)
    await fill(block, 'API hash', FAKE.apiHash)
    await fill(block, 'Телефон', FAKE.phone)
    await block.getByRole('button', { name: 'Получить код' }).click()
    await fill(block, 'Код из Telegram', FAKE.code)
    await block.getByRole('button', { name: 'Войти' }).click()
    await expect(block.getByText(/Вошли как/)).toBeVisible()

    // 12. Демо-режим в столбце: сообщения заглушки за последний час.
    await block.getByRole('button', { name: 'Тест' }).click()
    const demo = column(page).getByRole('list', { name: 'Сообщения за последний час' })
    await expect(demo.getByRole('listitem')).toHaveCount(3)
    await shot(page, S, '08-test-feed')

    // 13. Иконка — «подключено».
    await expect(telegramIcon(card)).toHaveAttribute('data-state', 'connected')
    await shot(page, S, '09-connected', telegramIcon(card))
  })

  test('шаг 14: ошибка — текст и подсказка про /dsh-communication fix-telegram', async ({ page }) => {
    test.fail(true, 'спецификация: шаг 14 — режима ошибки в столбце ещё нет')
    const url = await requireHarness()
    await openHarness(page, url)
    const { card, block } = await openTelegram(page)
    await fill(block, 'App ID', FAKE.apiId)
    await fill(block, 'API hash', 'e2e-broken')
    await fill(block, 'Телефон', FAKE.phone)
    await block.getByRole('button', { name: 'Получить код' }).click()

    // Отказ заглушки — не «внутренняя ошибка», а текст для человека и команда.
    const failure = column(page).getByRole('alert')
    await expect(failure).toBeVisible()
    await expect(failure).not.toContainText(/internal|undefined|\[object/)
    await expect(failure).toContainText('/dsh-communication fix-telegram')
    await expect(telegramIcon(card)).toHaveAttribute('data-state', 'error')
    await shot(page, S, '10-error', failure)
  })
})
