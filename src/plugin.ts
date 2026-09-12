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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { COMMUNICATION_CHANNEL, dispatch, type RpcResult } from './channel.js'
import { dispatchFeed, type FeedScope } from './feed-channel.js'
import { FEED_NAMESPACE, FeedSettingsSchema, labelsFileBody, validateLabels, type FeedSettings } from './feed-settings.js'
import { Config, type PluginConfig } from './plugin-config.js'
import { readStatus } from './status.js'
import { InboxStore } from './store.js'

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

export function resolveDbPath(config: PluginConfig): string {
  return resolvePath(config, config.dbPath)
}

export function resolvePath(config: PluginConfig, path: string): string {
  if (isAbsolute(path)) return path
  if (config.workspaceRoot === '') return path
  return join(config.workspaceRoot, path)
}

/** Форма службы настроек харнесса, которой нам достаточно. */
interface SettingsLike {
  register: (
    ns: string, schema: unknown, options?: { base?: object; validate?: (value: FeedSettings) => void },
  ) => FeedScope
}

export function apply(ctx: Context, config: PluginConfig): void {
  const store = new InboxStore(resolveDbPath(config))
  ctx.effect(() => () => { store.close() }, 'dsh-communication-plugin: база заявок')

  // Пространство настроек ленты. Служба настроек — необязательная: без неё
  // раздел живёт как прежде, а карточка в «Настройки → Плагины» не появляется —
  // и это видно, а не молчит: вкладка показывает только обслуживаемые пространства.
  let feedScope: FeedScope | null = null
  ctx.inject(['settings'], (scoped: Context) => {
    const settings = scoped.get('settings') as unknown as SettingsLike
    const scope = settings.register(FEED_NAMESPACE, FeedSettingsSchema, {
      validate: (value) => { validateLabels(value.labels) },
    })
    feedScope = scope
    // Зеркало меток для Python-писателей: пишется при каждом принятом изменении.
    const path = resolvePath(config, config.labelsPath)
    const mirror = (value: FeedSettings) => {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, labelsFileBody(value.labels), 'utf8')
    }
    // Первый запуск: документ настроек пуст, а файл меток уже есть — метки жили
    // в нём до появления карточки. Импортируем файл в документ, а не зеркалим
    // пустоту поверх него: иначе семь меток владельца стёрлись бы при старте
    // молча, с успешным кодом.
    const current = scope.get()
    if (current.labels.length === 0 && existsSync(path)) {
      try {
        const parsed = JSON.parse(readFileSync(path, 'utf8')) as { labels?: unknown }
        if (Array.isArray(parsed.labels) && parsed.labels.length > 0) {
          validateLabels(parsed.labels as FeedSettings['labels'])
          void scope.update({ labels: parsed.labels })
        } else {
          mirror(current)
        }
      } catch (error) {
        // Сломанный файл не импортируем и не перетираем: называем и оставляем.
        console.warn(`dsh-communication-plugin: labels.json не импортирован: ${String(error)}`)
      }
    } else {
      try { mirror(current) } catch (error) {
        console.warn(`dsh-communication-plugin: зеркало меток не записано: ${String(error)}`)
      }
    }
    scoped.effect(() => scope.watch((next) => { mirror(next) }), 'dsh-communication-plugin: зеркало labels.json')
    scoped.effect(() => () => { feedScope = null }, 'dsh-communication-plugin: пространство настроек ленты')
  })

  // Служба соединения берётся отложенной инъекцией: композиция без веб-интерфейса
  // (например одни только тесты канала) должна подниматься без неё.
  ctx.inject(['connection'], (scoped: Context) => {
    const connection = scoped.get('connection') as unknown as ConnectionLike
    scoped.effect(
      () => connection.rpc.handle(
        COMMUNICATION_CHANNEL,
        (endpoint, payload) => endpoint.startsWith('feed.')
          ? dispatchFeed(
            () => feedScope,
            { command: config.relabelCommand, cwd: config.relabelCwd || config.workspaceRoot || undefined },
            endpoint, payload,
          )
          : Promise.resolve(dispatch(store, () => readStatus(store, Date.now()), endpoint, payload)),
        { authority: 'loopback' },
      ),
      'dsh-communication-plugin: канал /communication',
    )
  })
}
