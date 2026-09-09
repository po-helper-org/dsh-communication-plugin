/**
 * Раздел «Управление коммуникацией», узловая половина.
 *
 * Поднимает хранилище заявок, канал RPC для панели и коллектор личного Telegram.
 * Коллектор — не обязательное условие работы раздела: без сессии или без реестра чатов
 * раздел поднимается, показывает пустой Inbox и честно говорит в панели, чего не хватает.
 */
import { fileURLToPath } from 'node:url'
import { isAbsolute, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { COMMUNICATION_CHANNEL, dispatch, type RpcResult } from './channel.js'
import { Collector } from './collector.js'
import { mergeEnv, readEnvFile } from './env-file.js'
import { Config, type PluginConfig } from './plugin-config.js'
import type { CollectorStatus } from './model.js'
import { InboxStore } from './store.js'
import { TelegramChannel, telegramOptionsFromEnv } from './telegram.js'

export const name = 'dsh-communication-plugin'
export { Config }

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

/**
 * Файл с ключом Telegram. По умолчанию `.env` в каталоге пакета: собранный модуль лежит
 * в `lib/`, поэтому корень пакета — на уровень выше.
 */
function resolveEnvPath(config: PluginConfig): string {
  if (config.envFile === '') return fileURLToPath(new URL('../.env', import.meta.url))
  if (isAbsolute(config.envFile) || config.workspaceRoot === '') return config.envFile
  return join(config.workspaceRoot, config.envFile)
}

function resolveDbPath(config: PluginConfig): string {
  if (isAbsolute(config.dbPath)) return config.dbPath
  if (config.workspaceRoot === '') return config.dbPath
  return join(config.workspaceRoot, config.dbPath)
}

export function apply(ctx: Context, config: PluginConfig): void {
  const store = new InboxStore(resolveDbPath(config))
  const status: CollectorStatus = {
    configured: config.watchedChats.length > 0,
    authorized: false,
    watching: [],
    lastError: config.watchedChats.length > 0 ? null : 'реестр отслеживаемых чатов пуст',
  }

  ctx.effect(() => () => { store.close() }, 'dsh-communication-plugin: база заявок')

  // Служба соединения берётся отложенной инъекцией: композиция без веб-интерфейса
  // (например одни только тесты канала) должна подниматься без неё.
  ctx.inject(['connection'], (scoped: Context) => {
    const connection = scoped.get('connection') as unknown as ConnectionLike
    scoped.effect(
      () => connection.rpc.handle(
        COMMUNICATION_CHANNEL,
        (endpoint, payload) => Promise.resolve(dispatch(store, () => status, endpoint, payload)),
        { authority: 'loopback' },
      ),
      'dsh-communication-plugin: канал /communication',
    )
  })

  if (!status.configured) return

  const envPath = resolveEnvPath(config)
  const options = telegramOptionsFromEnv(mergeEnv(readEnvFile(envPath), process.env))
  if (options === null) {
    status.lastError = `нет TG_API_ID и TG_API_HASH: ни в окружении харнесса, ни в ${envPath}`
    return
  }

  const channel = new TelegramChannel(options)
  let unsubscribe: (() => void) | undefined

  // Сбор запускается асинхронно и не задерживает подъём раздела: сеть может быть
  // недоступна, а панель со списком уже собранного обязана открыться в любом случае.
  void (async () => {
    try {
      await channel.open()
      status.authorized = true
      const chats = await channel.resolve(config.watchedChats)
      status.watching = [...chats.values()]
      const collector = new Collector(store, channel, { delayBudgetMs: config.delayBudgetSec * 1000 })
      for (const ref of chats.values()) await collector.catchUp(ref)
      unsubscribe = collector.listen(new Set(chats.keys()))
      status.lastError = null
    } catch (error) {
      status.lastError = error instanceof Error ? error.message : String(error)
    }
  })()

  ctx.effect(() => () => {
    unsubscribe?.()
    void channel.close()
  }, 'dsh-communication-plugin: коллектор Telegram')
}
