/**
 * Общий слой E2E-прогонов: где харнесс, как открыть раздел, как снять кадр для плейбука.
 *
 * Прогоны идут против ЖИВОГО харнесса, а не поднятого тестом: собрать композицию
 * профиля, плагинов и воркспейса внутри теста — отдельный проект, а живой уже стоит и
 * ровно его видит PO. Отсюда правило: ничего в документе настроек не меняется —
 * сценарии только читают карточку и запускают перемаркировку в режиме показа.
 *
 * Адрес харнесса — `DSH_E2E_URL`; без неё — `http://127.0.0.1:3082`, где он стоит на
 * этой машине. Харнесса нет — прогоны пропускаются, а не падают.
 */
import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'

export function harnessUrl(): string {
  return process.env.DSH_E2E_URL?.trim() || 'http://127.0.0.1:3082'
}

export async function requireHarness(): Promise<string> {
  const url = harnessUrl()
  let alive = false
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) })
    alive = response.ok
  } catch {}
  test.skip(!alive, `харнесс не отвечает на ${url}: задайте DSH_E2E_URL или поднимите его`)
  return url
}

export async function openHarness(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await expect(sectionButton(page)).toBeVisible()
}

/** Кнопка раздела в подвале левой панели. */
export function sectionButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Управление коммуникацией', exact: true })
}

/** Столбец с лентой — `<section aria-label="Лента контура">`. */
export function column(page: Page): Locator {
  return page.getByRole('region', { name: 'Лента контура' })
}

/** Фрейм с клиентом ленты внутри столбца. */
export function feedFrame(page: Page) {
  return page.frameLocator('iframe[title="Лента контура"]')
}

export function pill(page: Page, title: string): Locator {
  return column(page).getByRole('button', { name: title, exact: true })
}

/** Открыть Настройки → Плагины → карточку раздела; вернуть локатор карточки. */
export async function openCard(page: Page): Promise<Locator> {
  await page.getByText('Settings', { exact: true }).click()
  await page.getByText('Plugins', { exact: true }).click()
  // Точное имя: у кнопки раздела в подвале то же название без префикса.
  const head = page.getByRole('button', { name: /^(Показать|Скрыть) настройки: Управление коммуникацией$/ })
  await expect(head).toBeVisible()
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click()
  const card = head.locator('xpath=ancestor::li[1]')
  await expect(card.getByText('Подключение', { exact: true })).toBeVisible()
  return card
}

/**
 * Кадр шага для плейбука. Пишется только при заданном `PLAYBOOK_SHOTS_DIR` — обычный
 * прогон проверяет поведение и картинок не производит. `highlight` обводит элемент, о
 * котором идёт речь на шаге.
 *
 * Перед снимком страница обезличивается (`redact`): логотип сборки и фото пользователя
 * прячутся, названия воркспейсов заменяются на `ws-1`, `ws-2`…, названия чужих сессий в
 * левой панели — на «Сессия». Лента во фрейме не трогается —
 * кадры сценариев намеренно снимаются на срезах с постами агентов и публичных каналов;
 * перед публикацией наружу кадры смотрят глазами.
 */
export async function shot(page: Page, scenario: string, name: string, highlight?: Locator): Promise<void> {
  const root = process.env.PLAYBOOK_SHOTS_DIR
  if (!root) return
  const dir = path.resolve(root, scenario)
  fs.mkdirSync(dir, { recursive: true })
  const previous = highlight === undefined
    ? undefined
    : await highlight.evaluate((element) => {
      const el = element as HTMLElement
      const before = el.style.cssText
      el.style.outline = '3px solid #ff5f57'
      el.style.outlineOffset = '3px'
      return before
    })
  const restore = await redact(page)
  try {
    await page.screenshot({ path: path.join(dir, `${name}.png`), animations: 'disabled' })
  } finally {
    await restore()
    if (highlight !== undefined) {
      await highlight.evaluate((element, before) => { (element as HTMLElement).style.cssText = before }, previous ?? '')
    }
  }
}

/**
 * Обезличивание левой панели харнесса: логотип сборки, фото пользователя, названия
 * воркспейсов и сессий — не часть раздела и не должны попадать в публичные кадры.
 * Возвращает откат.
 */
async function redact(page: Page): Promise<() => Promise<void>> {
  await page.evaluate(() => {
    const changed: Array<[Node, 'style' | 'text', string]> = []
    const left = (el: Element) => el.getBoundingClientRect().right < 300
    const hide = (el: HTMLElement | SVGElement) => {
      changed.push([el, 'style', el.style.cssText])
      el.style.visibility = 'hidden'
    }
    const setText = (node: Node, text: string) => {
      changed.push([node, 'text', node.textContent ?? ''])
      node.textContent = text
    }
    for (const img of document.querySelectorAll<HTMLImageElement>('img')) {
      if (left(img)) hide(img)
    }
    // Логотип сборки — листья в левом верхнем углу, кроме кнопок (переключатель панели).
    for (const el of document.querySelectorAll<HTMLElement | SVGElement>('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || r.right > 220 || r.bottom > 64) continue
      if (el.closest('button, [role="button"]')) continue
      const leaf = el.children.length === 0 || el instanceof SVGSVGElement
      if (leaf && !el.closest('svg:not(:scope)')) hide(el)
    }
    // Строка сессии — `[role=treeitem]` с дочерней меткой времени вида «45min», «14h», «2d»;
    // строка воркспейса — раскрываемый `[role=treeitem]` без метки времени.
    const text = (n: Element) => n.textContent?.trim() ?? ''
    const workspaces = new Map<string, string>()
    for (const row of document.querySelectorAll<HTMLElement>('[role="treeitem"]')) {
      if (!left(row)) continue
      const own = [...row.querySelectorAll('*')].filter((n) => n.closest('[role="treeitem"]') === row)
      const stamp = own.find((n) => /^\d+\s?(min|h|d|ч|м|д)$/.test(text(n)))
      const leaves = own.filter((n) => n !== stamp && n.children.length === 0)
      if (stamp) {
        const title = leaves.find((n) => text(n).length > 3)
        if (title) setText(title, 'Сессия')
      } else if (row.hasAttribute('aria-expanded')) {
        const title = leaves.find((n) => /\p{L}/u.test(text(n)))
        if (title && !workspaces.has(text(title))) workspaces.set(text(title), `ws-${workspaces.size + 1}`)
      }
    }
    // Название воркспейса меняется везде вне фрейма, в том числе в выборе у поля ввода.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const alias = workspaces.get(node.textContent?.trim() ?? '')
      if (alias) setText(node, alias)
    }
    ;(window as unknown as { __commRedact?: typeof changed }).__commRedact = changed
  })
  return async () => {
    await page.evaluate(() => {
      const w = window as unknown as { __commRedact?: Array<[Node, 'style' | 'text', string]> }
      for (const [node, kind, before] of (w.__commRedact ?? []).reverse()) {
        if (kind === 'style') (node as HTMLElement).style.cssText = before
        else node.textContent = before
      }
      delete w.__commRedact
    })
  }
}
