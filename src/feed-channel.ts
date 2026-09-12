/**
 * Подкоманды канала для ленты: `feed.*`. Отдельно от `channel.ts`, чтобы тот
 * оставался чистым разбором заявок — принцип портов, `docs/PRINCIPLES.md`.
 *
 * Панель настроек читает и пишет пространство настроек напрямую через
 * `settingsScope` харнесса; сюда попадает только то, что требует узла: проверка
 * токена, счётчики, запись входа для фрейма и запуск перемаркировки.
 */
import type { RpcResult } from './channel.js'
import { FeedError, counts, relabel, seed, verify } from './feed.js'
import type { FeedSettings } from './feed-settings.js'

/** Форма области настроек, которой нам достаточно (узловая `SettingsScope`). */
export interface FeedScope {
  get(): FeedSettings
  watch(callback: (next: FeedSettings, prev: FeedSettings) => void): () => void
  update(patch: object): Promise<void>
}

function ok<T>(value: T): RpcResult<T> { return { ok: true, value } }
function fail(code: string, message: string): RpcResult<never> { return { ok: false, error: { code, message, details: {} } } }

export interface RelabelRunner { command: string; cwd?: string }

export async function dispatchFeed(
  scope: () => FeedScope | null,
  runner: RelabelRunner,
  endpoint: string,
  payload: unknown,
): Promise<RpcResult<unknown>> {
  const current = scope()
  if (current === null) return fail('no-settings', 'служба настроек харнесса недоступна — лента не настраивается')
  const settings = current.get()
  try {
    switch (endpoint) {
      case 'feed.verify': {
        const info = await verify(settings)
        return ok({ acct: info.acct, id: info.id })
      }
      case 'feed.counts':
        return ok(await counts(settings, settings.labels))
      case 'feed.seed':
        return ok(await seed(settings))
      case 'feed.relabel': {
        const apply = (payload as { apply?: unknown } | null)?.apply === true
        return ok(await relabel(runner.command, apply, runner.cwd))
      }
      case 'feed.relabel.available':
        return ok({ available: runner.command.trim() !== '' })
      default:
        return fail('unknown-endpoint', `неизвестная подкоманда канала: ${endpoint}`)
    }
  } catch (error) {
    if (error instanceof FeedError) return fail('feed', error.message)
    return fail('internal', error instanceof Error ? error.message : String(error))
  }
}
