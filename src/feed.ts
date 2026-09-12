/**
 * Узловая половина ленты: то, что нельзя сделать из браузера.
 *
 * - `verify` — проверить токен: узел ходит в инстанс сам, и браузеру не нужен
 *   доверенный сертификат самоподписанного стенда.
 * - `counts` — сколько постов под каждой меткой: пустая метка во фрейме показала
 *   бы «tag not found», поэтому её пилюля гасится заранее.
 * - `seed` — запись входа для клиента ленты: `localStorage.accounts` Phanpy это
 *   `[{info, instanceURL, accessToken, lastAccessedAt}]`, где `info` — учётка из
 *   `verify_credentials`. Проверено делом: посеянная запись + перезагрузка — и
 *   клиент открывает Home без страницы входа (которую во фрейме и не показать:
 *   инстанс отдаёт x-frame-options: DENY).
 * - `relabel` — перемаркировка отдельным процессом, как коллектор: код меток
 *   живёт в poh-feed-poc на Python, и вторая реализация здесь разошлась бы с ней.
 */
import { spawn } from 'node:child_process'
import type { FeedSettings, LabelSpec } from './feed-settings.js'

export class FeedError extends Error {}

export interface AccountInfo { id: string; acct: string; [key: string]: unknown }

function apiBase(settings: FeedSettings): string {
  const base = settings.hostApiUrl.trim() || settings.instanceUrl.trim()
  if (base === '') throw new FeedError('не задан адрес инстанса')
  return base.replace(/\/$/, '')
}

async function api<T>(settings: FeedSettings, path: string, signal?: AbortSignal): Promise<T> {
  if (settings.token.trim() === '') throw new FeedError('не задан токен человека')
  let response: Response
  try {
    response = await fetch(`${apiBase(settings)}${path}`, {
      headers: { Authorization: `Bearer ${settings.token.trim()}` },
      signal: signal ?? AbortSignal.timeout(15_000),
    })
  } catch (error) {
    // Самоподписанный сертификат узел не примет — и это самая частая причина.
    // Называем её вместе с выходом, а не голым «fetch failed».
    const reason = error instanceof Error ? (error.cause instanceof Error ? error.cause.message : error.message) : String(error)
    throw new FeedError(`инстанс не отвечает: ${reason}. Если сертификат самоподписанный — укажите в настройках http-адрес инстанса для узла`)
  }
  if (!response.ok) throw new FeedError(`инстанс ответил ${response.status} на ${path}`)
  return await response.json() as T
}

export async function verify(settings: FeedSettings): Promise<AccountInfo> {
  return api<AccountInfo>(settings, '/api/v1/accounts/verify_credentials')
}

/** Сколько постов под меткой; `null` — тег ещё ни разу не использовался (404). */
export async function counts(settings: FeedSettings, labels: LabelSpec[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {}
  for (const label of labels) {
    try {
      const posts = await api<unknown[]>(settings, `/api/v1/timelines/tag/${encodeURIComponent(label.id)}?limit=40`)
      out[label.id] = posts.length
    } catch (error) {
      if (error instanceof FeedError && /ответил 404/.test(error.message)) out[label.id] = null
      else throw error
    }
  }
  return out
}

/** Что положить в `localStorage` клиента ленты, чтобы он вошёл этой учёткой. */
export async function seed(settings: FeedSettings): Promise<{ accounts: string; currentAccount: string }> {
  const info = await verify(settings)
  const instanceURL = settings.instanceUrl.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
  const account = { info, instanceURL, accessToken: settings.token.trim(), lastAccessedAt: 0 }
  return { accounts: JSON.stringify([account]), currentAccount: info.id }
}

/**
 * Запуск перемаркировки. Команда задаётся конфигурацией плагина, не настройками
 * из браузера: строка, которую узел выполнит оболочкой, — это не то, что должно
 * редактироваться из веб-формы.
 */
export function relabel(command: string, apply: boolean, cwd?: string): Promise<{ code: number; output: string }> {
  if (command.trim() === '') return Promise.reject(new FeedError('команда перемаркировки не задана в конфигурации плагина (relabelCommand)'))
  return new Promise((resolve) => {
    const child = spawn('/bin/sh', ['-c', apply ? `${command} --apply` : command], { cwd, env: process.env })
    let output = ''
    const take = (chunk: Buffer) => { output += chunk.toString('utf8'); if (output.length > 60_000) output = output.slice(-60_000) }
    child.stdout.on('data', take)
    child.stderr.on('data', take)
    child.on('error', (error) => resolve({ code: 127, output: `${output}\nне удалось запустить: ${error.message}` }))
    child.on('close', (code) => resolve({ code: code ?? 1, output }))
  })
}
