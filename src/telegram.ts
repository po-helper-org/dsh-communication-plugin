/**
 * Адаптер личного аккаунта Telegram к порту коллектора.
 *
 * Библиотека — mtcute: TypeScript совпадает со стеком раздела, нативной сборки нет,
 * хранилище сессии идёт из коробки. Разбор кандидатов — `docs/spike-mtproto.md`.
 *
 * Вход в аккаунт здесь не выполняется: Telegram присылает код в приложение, и спросить
 * его некому — харнесс поднимает раздел без терминала. Сессия заводится один раз
 * командой `node bin/login.mjs`, дальше адаптер только переиспользует её файл.
 */
import { TelegramClient } from '@mtcute/node'
import { NotAuthorizedError } from './errors.js'
import type { ChannelPort, IncomingMessage } from './collector.js'

export interface TelegramOptions {
  apiId: number
  apiHash: string
  sessionPath: string
}

/** Читает ключ приложения из окружения: в конфигурации плагина секретам не место. */
export function telegramOptionsFromEnv(env: NodeJS.ProcessEnv): TelegramOptions | null {
  const apiId = Number(env.TG_API_ID)
  const apiHash = env.TG_API_HASH
  if (!Number.isFinite(apiId) || apiId <= 0 || apiHash === undefined || apiHash === '') return null
  return { apiId, apiHash, sessionPath: env.TG_SESSION ?? 'tg.session' }
}

interface MessageLike {
  id: number
  isService: boolean
  text: string
  date: Date
  chat: { id: number | string; displayName?: string }
  sender?: { displayName?: string }
  media?: { type?: string } | null
}

export function toIncoming(message: MessageLike): IncomingMessage {
  return {
    id: message.id,
    chatId: String(message.chat.id),
    chatTitle: message.chat.displayName ?? null,
    author: message.sender?.displayName ?? null,
    sentAt: message.date.getTime(),
    text: message.text,
    hasMedia: message.media != null && message.media.type !== 'unsupported',
    isService: message.isService,
  }
}

export class TelegramChannel implements ChannelPort {
  private readonly client: TelegramClient

  constructor(options: TelegramOptions) {
    this.client = new TelegramClient({
      apiId: options.apiId,
      apiHash: options.apiHash,
      storage: options.sessionPath,
    })
  }

  /** Поднимает соединение на готовой сессии. Сессии нет — говорим об этом прямо. */
  async open(): Promise<string> {
    await this.client.connect()
    try {
      const me = await this.client.getMe()
      return me.displayName
    } catch {
      throw new NotAuthorizedError()
    }
  }

  /** Идентификаторы отслеживаемых чатов: реестр задаётся ссылками, поток приходит с числами. */
  async resolve(refs: readonly string[]): Promise<Map<string, string>> {
    const resolved = new Map<string, string>()
    for (const ref of refs) {
      const chat = await this.client.getChat(ref)
      resolved.set(String(chat.id), ref)
    }
    return resolved
  }

  async *history(chat: string, limit: number): AsyncIterable<IncomingMessage> {
    for await (const message of this.client.iterHistory(chat, { limit })) {
      yield toIncoming(message as unknown as MessageLike)
    }
  }

  subscribe(handler: (message: IncomingMessage) => void): () => void {
    const wrapped = (message: unknown) => { handler(toIncoming(message as MessageLike)) }
    this.client.onNewMessage.add(wrapped)
    return () => { this.client.onNewMessage.remove(wrapped) }
  }

  async close(): Promise<void> {
    await this.client.disconnect()
  }
}
