/**
 * Раздел «Управление коммуникацией», узловая половина.
 *
 * Раздел только читает: хранилище заявок и канал RPC для панели. Сбор идёт отдельным
 * процессом (`bin/collect.mjs`), и это не вкусовщина. Клиент Telegram тянет нативный
 * модуль хранилища сессии, а несовместимый бинарь в процессе харнесса роняет весь
 * харнесс целиком, а не свой раздел — проверено на живом стенде.
 *
 * Разделение заодно совпадает с принципом портов: раздел знает хранилище, а не канал.
 */
import { isAbsolute, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { COMMUNICATION_CHANNEL, dispatch, type RpcResult } from './channel.js'
import { Config, type PluginConfig } from './plugin-config.js'
import type { CollectorStatus } from './model.js'
import { InboxStore } from './store.js'

export const name = 'dsh-communication-plugin'
export { Config }

/** Коллектор считается живым, если отметился в базе не позже этого срока. */
const HEARTBEAT_STALE_MS = 2 * 60 * 1000

/** Форма службы соединения, которой нам достаточно. */
interface ConnectionLike {
  rpc: {
    handle: (
      channel: string,
      handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<RpcResult<unknown>>,
      options?: { authority?: string },
    ) => () => Promise<void> | void
  }
}

function resolveDbPath(config: PluginConfig): string {
  if (isAbsolute(config.dbPath)) return config.dbPath
  if (config.workspaceRoot === '') return config.dbPath
  return join(config.workspaceRoot, config.dbPath)
}

/** Состояние коллектора собирается из отметок, которые он оставляет в той же базе. */
function readStatus(store: InboxStore, now: number): CollectorStatus {
  const seenAt = Number(store.getMeta('collector.seenAt') ?? 0)
  const watching = (store.getMeta('collector.watching') ?? '').split(',').filter((chat) => chat !== '')
  const lastError = store.getMeta('collector.lastError')
  const alive = seenAt > 0 && now - seenAt < HEARTBEAT_STALE_MS
  return {
    configured: watching.length > 0,
    authorized: alive && store.getMeta('collector.authorized') === 'да',
    watching,
    lastError: alive
      ? (lastError === '' ? null : lastError)
      : 'коллектор не запущен: `node bin/collect.mjs` в каталоге плагина',
  }
}

export function apply(ctx: Context, config: PluginConfig): void {
  const store = new InboxStore(resolveDbPath(config))
  ctx.effect(() => () => { store.close() }, 'dsh-communication-plugin: база заявок')

  // Служба соединения берётся отложенной инъекцией: композиция без веб-интерфейса
  // (например одни только тесты канала) должна подниматься без неё.
  ctx.inject(['connection'], (scoped: Context) => {
    const connection = scoped.get('connection') as unknown as ConnectionLike
    scoped.effect(
      () => connection.rpc.handle(
        COMMUNICATION_CHANNEL,
        (endpoint, payload) => Promise.resolve(
          dispatch(store, () => readStatus(store, Date.now()), endpoint, payload),
        ),
        { authority: 'loopback' },
      ),
      'dsh-communication-plugin: канал /communication',
    )
  })
}
