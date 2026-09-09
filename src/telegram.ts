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
  sender?: { id?: number | string; displayName?: string }
  media?: { type?: string } | null
}

export function toIncoming(message: MessageLike): IncomingMessage {
  return {
    id: message.id,
    chatId: String(message.chat.id),
    chatTitle: message.chat.displayName ?? null,
    author: message.sender?.displayName ?? null,
    authorId: message.sender?.id === undefined ? null : String(message.sender.id),
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

  /**
   * Поднимает соединение на готовой сессии. Сессии нет — говорим об этом прямо.
   *
   * Поток обновлений запускается отдельным вызовом: `connect()` его не поднимает, и без
   * `startUpdatesLoop()` подписка на новые сообщения молча не срабатывает — коллектор
   * собирает историю и больше ничего. Проверено замером: пять маркеров подряд без единого
   * события.
   */
  async open(): Promise<string> {
    await this.client.connect()
    let name: string
    try {
      name = (await this.client.getMe()).displayName
    } catch {
      throw new NotAuthorizedError()
    }
    await this.client.startUpdatesLoop()
    return name
  }

  /** Идентификаторы отслеживаемых чатов: реестр задаётся ссылками, поток приходит с числами. */
  async resolve(refs: readonly string[]): Promise<Map<string, string>> {
    const resolved = new Map<string, string>()
    for (const ref of refs) {
      // getPeer, а не getChat: «Избранное» (`me`) и личные диалоги — это пользователь,
      // а не чат, и getChat на них отвечает отказом.
      const peer = await this.client.getPeer(ref)
      resolved.set(String(peer.id), ref)
    }
    return resolved
  }

  async *history(chat: string, limit: number): AsyncIterable<IncomingMessage> {
    for await (const message of this.client.iterHistory(chat, { limit })) {
      yield toIncoming(message as unknown as MessageLike)
    }
  }

  /** Последнее прочитанное входящее чата. Диалога нет — порога нет, вернём 0. */
  async lastRead(chat: string): Promise<number> {
    const [dialog] = await this.client.getPeerDialogs(chat)
    return dialog === null || dialog === undefined ? 0 : dialog.lastReadIngoing
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
