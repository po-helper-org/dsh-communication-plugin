/**
 * Коллектор: догон пропущенного и подписка на поток.
 *
 * Клиент Telegram приходит портом, а не импортируется здесь: логика сбора проверяется
 * без сети и без аккаунта, а живой mtcute подставляется в `telegram.ts`.
 */
import type { Item } from './model.js'
import type { InboxStore } from './store.js'

/** Сообщение канала в форме, которой достаточно коллектору. */
export interface IncomingMessage {
  id: number
  chatId: string
  chatTitle: string | null
  author: string | null
  /** Время отправки в миллисекундах. */
  sentAt: number
  text: string
  hasMedia: boolean
  isService: boolean
}

/** Порт клиента канала. Ровно две способности: прочитать историю и слушать поток. */
export interface ChannelPort {
  /** Сообщения чата от свежих к старым. Коллектор сам остановится на курсоре. */
  history: (chat: string, limit: number) => AsyncIterable<IncomingMessage>
  /** Подписка на поток. Возвращает отписку. */
  subscribe: (handler: (message: IncomingMessage) => void) => () => void
}

export interface CollectorOptions {
  channel?: string
  delayBudgetMs?: number
  catchUpLimit?: number
  now?: () => number
}

const LINK_RE = /https?:\/\/[^\s<>"')]+/g

export function extractLinks(text: string): string[] {
  return text.match(LINK_RE) ?? []
}

/**
 * Заявка появляется только в состоянии `inbox` — других путей нет.
 * Класс пуст: разметчика в первой итерации нет, а поле уже на месте.
 */
export function toItem(message: IncomingMessage, options: CollectorOptions & { receivedAt: number }): Item {
  const channel = options.channel ?? 'telegram'
  const budget = options.delayBudgetMs ?? 5 * 60 * 1000
  return {
    key: `${channel}:${message.chatId}:${message.id}`,
    channel,
    chatId: message.chatId,
    chatTitle: message.chatTitle,
    msgId: message.id,
    threadKey: `${channel}:${message.chatId}`,
    author: message.author,
    sentAt: message.sentAt,
    receivedAt: options.receivedAt,
    delayed: options.receivedAt - message.sentAt > budget,
    text: message.text,
    hasMedia: message.hasMedia,
    links: extractLinks(message.text),
    state: 'inbox',
    class: null,
  }
}

export class Collector {
  constructor(
    private readonly store: InboxStore,
    private readonly port: ChannelPort,
    private readonly options: CollectorOptions = {},
  ) {}

  private now(): number {
    return (this.options.now ?? Date.now)()
  }

  private accept(message: IncomingMessage): boolean {
    if (message.isService) return false
    const item = toItem(message, { ...this.options, receivedAt: this.now() })
    const saved = this.store.save(item)
    if (saved) this.store.advanceCursor(item.chatId, item.msgId)
    return saved
  }

  /**
   * Догон пропущенного за простой машины: идём от свежих к старым до курсора, пишем
   * в обратном порядке, чтобы курсор двигался вперёд без дыр.
   */
  async catchUp(chat: string): Promise<number> {
    const limit = this.options.catchUpLimit ?? 300
    const pending: IncomingMessage[] = []
    for await (const message of this.port.history(chat, limit)) {
      if (message.id <= this.store.cursor(message.chatId)) break
      pending.push(message)
    }
    let saved = 0
    for (const message of pending.reverse()) {
      if (this.accept(message)) saved += 1
    }
    return saved
  }

  /** Подписка на поток. Чаты вне реестра игнорируются. */
  listen(watchedChatIds: ReadonlySet<string>): () => void {
    return this.port.subscribe((message) => {
      if (!watchedChatIds.has(message.chatId)) return
      this.accept(message)
    })
  }
}
