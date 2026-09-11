/** Канал раздела. Одна регистрация, подкоманды разбираются внутри. */
import { CommunicationError, ItemNotFoundError } from './errors.js'
import type { CollectorStatus, ItemRow, RouteRow, Thread } from './model.js'
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

/** Справочник лейблов раздела: подпись и цвет живут здесь, в заявке — только идентификатор. */
export const LABELS = [
  { id: 'answer', text: 'нужен ответ', tone: 'answer' },
  { id: 'context', text: 'нужен контекст', tone: 'context' },
  { id: 'sprint', text: 'риск спринта', tone: 'sprint' },
  { id: 'quarter', text: 'риск квартала', tone: 'quarter' },
  { id: 'noise', text: 'фон', tone: 'noise' },
  { id: 'client', text: 'клиент', tone: 'client' },
] as const

const KNOWN = new Set<string>(LABELS.map((label) => label.id))

function labelOf(payload: unknown): { key: string; label: string; on: boolean } {
  const key = keyOf(payload)
  const raw = payload as { label?: unknown; on?: unknown }
  if (typeof raw.label !== 'string' || !KNOWN.has(raw.label)) {
    throw new CommunicationError(`неизвестный лейбл: ${String(raw.label)}`)
  }
  return { key, label: raw.label, on: raw.on !== false }
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
): RpcResult<InboxPage | Thread | { done: boolean } | { labels: string[] } | { rows: RouteRow[] }> {
  try {
    switch (endpoint) {
      case 'list':
        return ok({ items: store.list(), unresolved: store.count('inbox'), status: status() })
      case 'show':
        return ok(store.thread(keyOf(payload)))
      case 'done':
        return ok({ done: store.markDone(keyOf(payload)) })
      case 'label': {
        const { key, label, on } = labelOf(payload)
        return ok({ labels: store.setLabel(key, label, on) })
      }
      case 'routes':
        return ok({ rows: store.routeDistribution() })
      default:
        return fail('unknown-endpoint', `неизвестная подкоманда канала: ${endpoint}`)
    }
  } catch (error) {
    return failure(error)
  }
}
