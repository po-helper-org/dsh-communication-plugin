/**
 * Состояние коллектора для панели.
 *
 * Коллектор — отдельный процесс, поэтому раздел судит о нём по отметкам в общей базе.
 * Отметок нет или они протухли — раздел обязан сказать это прямо, а не показывать
 * пустой Inbox как норму.
 */
import type { CollectorStatus } from './model.js'
import type { InboxStore } from './store.js'

/** Коллектор считается живым, если отметился не позже этого срока. */
export const HEARTBEAT_STALE_MS = 2 * 60 * 1000

export function readStatus(store: InboxStore, now: number): CollectorStatus {
  const seenAt = Number(store.getMeta('collector.seenAt') ?? 0)
  const watching = (store.getMeta('collector.watching') ?? '').split(',').filter((chat) => chat !== '')
  const lastError = store.getMeta('collector.lastError')
  const alive = seenAt > 0 && now - seenAt < HEARTBEAT_STALE_MS
  return {
    configured: watching.length > 0,
    authorized: alive && store.getMeta('collector.authorized') === 'да',
    watching,
    lastError: alive
      ? (lastError === '' || lastError === null ? null : lastError)
      : 'коллектор не запущен: `node bin/collect.mjs` в каталоге плагина',
  }
}
