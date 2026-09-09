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
  authorId: string | null
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
  /**
   * Идентификатор последнего прочитанного сообщения чата. Всё, что новее, лежит
   * в непрочитанных и обязано попасть в Inbox при первом же запуске.
   */
  lastRead?: (chat: string) => Promise<number>
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
    authorId: message.authorId,
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
   * Догон пропущенного: идём от свежих к старым до порога, пишем в обратном порядке,
   * чтобы курсор двигался вперёд без дыр.
   *
   * Порог — не только наш курсор. Непрочитанное в чате может быть старше него (сообщение
   * собрано прошлым запуском, но человеком не прочитано), поэтому берётся меньшее из двух:
   * что мы уже собрали и что человек уже прочитал. Дубли отсекает ключ заявки, а не порог.
   */
  async catchUp(chat: string, chatId?: string): Promise<number> {
    const limit = this.options.catchUpLimit ?? 300
    const lastRead = this.port.lastRead === undefined ? 0 : await this.port.lastRead(chat)
    // Порог снимается до чтения и больше не пересчитывается. Подписка работает
    // параллельно и двигает курсор вперёд; порог, пересчитанный по ходу, оборвал бы
    // чтение на первом же сообщении, и старое непрочитанное потерялось бы.
    const known = chatId === undefined ? 0 : this.store.cursor(chatId)
    let floor = known === 0 ? lastRead : Math.min(known, lastRead === 0 ? known : lastRead)
    const pending: IncomingMessage[] = []
    for await (const message of this.port.history(chat, limit)) {
      if (chatId === undefined) {
        // Идентификатор чата заранее не известен — снимаем порог по первому сообщению.
        const cursor = this.store.cursor(message.chatId)
        floor = cursor === 0 ? lastRead : Math.min(cursor, lastRead === 0 ? cursor : lastRead)
        chatId = message.chatId
      }
      if (message.id <= floor) break
      pending.push(message)
    }
    let saved = 0
    for (const message of pending.reverse()) {
      if (this.accept(message)) saved += 1
    }
    return saved
  }

  /**
   * Запуск: сперва подписка, потом чтение непрочитанного.
   *
   * Порядок принципиален. Между концом догона и началом подписки есть окно, и сообщение,
   * пришедшее в него, не попало бы никуда. Подписка, поднятая первой, это окно закрывает;
   * пересечение с догоном безвредно — дубли отсекает ключ заявки.
   */
  async start(chats: ReadonlyMap<string, string>): Promise<() => void> {
    const unsubscribe = this.listen(new Set(chats.keys()))
    for (const [chatId, ref] of chats) await this.catchUp(ref, chatId)
    return unsubscribe
  }

  /** Подписка на поток. Чаты вне реестра игнорируются. */
  listen(watchedChatIds: ReadonlySet<string>): () => void {
    return this.port.subscribe((message) => {
      if (!watchedChatIds.has(message.chatId)) return
      this.accept(message)
    })
  }
}
