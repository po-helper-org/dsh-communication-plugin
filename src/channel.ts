/** Канал раздела. Одна регистрация, подкоманды разбираются внутри. */
import { CommunicationError, ItemNotFoundError } from './errors.js'
import type { CollectorStatus, ItemRow, Thread } from './model.js'
import type { InboxStore } from './store.js'

export const COMMUNICATION_CHANNEL = '/communication'

export type RpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: object } }

export interface InboxPage {
  items: ItemRow[]
  unresolved: number
  status: CollectorStatus
}

function ok<T>(value: T): RpcResult<T> {
  return { ok: true, value }
}

function fail(code: string, message: string): RpcResult<never> {
  return { ok: false, error: { code, message, details: {} } }
}

function failure(error: unknown): RpcResult<never> {
  // Разбор исключения сам защищён: наружу канала всегда уходит значение, а не бросок.
  try {
    const message = error instanceof Error ? error.message : String(error)
    if (error instanceof ItemNotFoundError) return fail('item-not-found', message)
    if (error instanceof CommunicationError) return fail('communication', message)
    return fail('internal', message)
  } catch {
    return fail('internal', 'не удалось разобрать исключение')
  }
}

function keyOf(payload: unknown): string {
  const key = (payload as { key?: unknown } | null)?.key
  if (typeof key !== 'string' || key === '') throw new CommunicationError('не передан ключ заявки')
  return key
}

export function dispatch(
  store: InboxStore,
  status: () => CollectorStatus,
  endpoint: string,
  payload: unknown,
): RpcResult<InboxPage | Thread | { done: boolean }> {
  try {
    switch (endpoint) {
      case 'list':
        return ok({ items: store.list(), unresolved: store.count('inbox'), status: status() })
      case 'show':
        return ok(store.thread(keyOf(payload)))
      case 'done':
        return ok({ done: store.markDone(keyOf(payload)) })
      default:
        return fail('unknown-endpoint', `неизвестная подкоманда канала: ${endpoint}`)
    }
  } catch (error) {
    return failure(error)
  }
}
