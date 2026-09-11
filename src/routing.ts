/**
 * Правило маршрутизации: куда уходит заявка из данного чата.
 *
 * Чистая функция без обращений к сети и хранилищу — проверяется таблицей значений,
 * а не поднятием коллектора. Вся политика разметки потока живёт здесь одной точкой:
 * менять её предстоит по итогам живого наблюдения.
 */
import { ROUTES, type ChatKind, type Route } from './model.js'

export interface RouteOverrides {
  feed: ReadonlySet<string>
  dialog: ReadonlySet<string>
  both: ReadonlySet<string>
}

/** Вид чата по умолчанию. Всё, чего здесь нет, считается разговором. */
const BY_KIND: Partial<Record<ChatKind, Route[]>> = {
  user: ['dialog'],
  bot: ['dialog'],
  group: ['dialog'],
  supergroup: ['dialog'],
  channel: ['feed'],
  gigagroup: ['feed'],
  // monoforum — переписка с администрацией канала, по сути разговор.
  monoforum: ['dialog'],
}

/** Канонический порядок: одинаковый набор обязан давать одинаковую строку в хранилище. */
function canonical(routes: readonly Route[]): Route[] {
  return ROUTES.filter((route) => routes.includes(route))
}

/**
 * Маршруты заявки. Переопределение реестра важнее вида чата: человек знает про свой
 * чат больше, чем Telegram сообщает его типом.
 *
 * Неизвестный вид уходит в диалоги намеренно: потерять рабочее сообщение в ленте
 * дороже, чем увидеть новость среди диалогов.
 */
export function routeFor(
  kind: ChatKind | null | undefined,
  chatId: string,
  overrides?: Partial<RouteOverrides>,
): Route[] {
  if (overrides?.both?.has(chatId) === true) return canonical(['dialog', 'feed'])
  if (overrides?.feed?.has(chatId) === true) return ['feed']
  if (overrides?.dialog?.has(chatId) === true) return ['dialog']
  if (kind === null || kind === undefined) return ['dialog']
  return canonical(BY_KIND[kind] ?? ['dialog'])
}

function list(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? '').split(',').map((item) => item.trim()).filter((item) => item !== ''),
  )
}

/** Переопределения из окружения коллектора: реестром чатов распоряжается он. */
export function parseOverrides(env: Record<string, string | undefined>): RouteOverrides {
  return {
    feed: list(env.ROUTE_FEED),
    dialog: list(env.ROUTE_DIALOG),
    both: list(env.ROUTE_BOTH),
  }
}
