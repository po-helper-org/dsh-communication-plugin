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

/**
 * Повтор после FLOOD_WAIT. Telegram отвечает отказом с числом секунд, когда запросов
 * слишком много; клиент сам пережидает только короткие паузы, и всё, что длиннее, летит
 * исключением. Для сбора это штатная ситуация, а не сбой: ждём столько, сколько сказали.
 */
async function withFloodRetry<T>(action: () => Promise<T>, maxWaitSec = 120): Promise<T> {
  for (;;) {
    try {
      return await action()
    } catch (error) {
      const seconds = (error as { code?: number; seconds?: number }).code === 420
        ? (error as { seconds?: number }).seconds
        : undefined
      if (seconds === undefined || seconds > maxWaitSec) throw error
      await new Promise((resolve) => { setTimeout(resolve, (seconds + 1) * 1000) })
    }
  }
}

/**
 * Ссылка на чат из реестра в форме, понятной клиенту. Числовой идентификатор обязан
 * ехать числом: строку библиотека принимает за username и не находит собеседника.
 */
function asPeer(ref: string): string | number {
  return /^-?\d+$/.test(ref) ? Number(ref) : ref
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

  /**
   * Идентификаторы отслеживаемых чатов: реестр задаётся ссылками, поток приходит с числами.
   * Недоступный чат не роняет остальные — он попадает в отчёт и пропускается.
   */
  async resolve(refs: readonly string[]): Promise<{ chats: Map<string, string>; failed: Array<[string, string]> }> {
    const chats = new Map<string, string>()
    const failed: Array<[string, string]> = []
    for (const ref of refs) {
      try {
        // getPeer, а не getChat: «Избранное» (`me`) и личные диалоги — это пользователь,
        // а не чат, и getChat на них отвечает отказом.
        const peer = await withFloodRetry(() => this.client.getPeer(asPeer(ref)))
        chats.set(String(peer.id), ref)
      } catch (error) {
        failed.push([ref, error instanceof Error ? error.message : String(error)])
      }
    }
    return { chats, failed }
  }

  /**
   * Чаты папок Telegram. Реестр перестаёт быть ручным списком: он живёт там, где человек
   * и так его ведёт, и меняется вместе с папкой.
   *
   * Состав снимается при запуске. Чат, добавленный в папку позже, попадёт в сбор после
   * перезапуска коллектора — папка читается один раз, а не опрашивается.
   */
  async resolveFolders(titles: readonly string[]): Promise<{ chats: Map<string, string>; failed: Array<[string, string]> }> {
    const chats = new Map<string, string>()
    const failed: Array<[string, string]> = []
    for (const title of titles) {
      try {
        const folder = await withFloodRetry(() => this.client.findFolder({ title }))
        if (folder === null) {
          failed.push([title, 'папка не найдена'])
          continue
        }
        let found = 0
        await withFloodRetry(async () => {
          for await (const dialog of this.client.iterDialogs({ folder })) {
            chats.set(String(dialog.peer.id), String(dialog.peer.id))
            found += 1
          }
        })
        if (found === 0) failed.push([title, 'папка пуста'])
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // Часть чатов могла успеть прочитаться до отказа — тогда это не пропуск папки,
        // а неполный список, и говорить надо именно так.
        failed.push([title, chats.size > 0 ? `список неполон: ${message}` : message])
      }
    }
    return { chats, failed }
  }

  /**
   * Ошибки фонового цикла обновлений. Без обработчика отказ по одному чату (например
   * CHANNEL_INVALID при выборке различий) роняет весь процесс, и сбор останавливается
   * по всем остальным чатам — проверено на живом аккаунте.
   */
  onError(handler: (error: Error) => void): () => void {
    this.client.onError.add(handler)
    return () => { this.client.onError.remove(handler) }
  }

  async *history(chat: string, limit: number): AsyncIterable<IncomingMessage> {
    for await (const message of this.client.iterHistory(asPeer(chat), { limit })) {
      yield toIncoming(message as unknown as MessageLike)
    }
  }

  /** Последнее прочитанное входящее чата. Диалога нет — порога нет, вернём 0. */
  async lastRead(chat: string): Promise<number> {
    const [dialog] = await withFloodRetry(() => this.client.getPeerDialogs(asPeer(chat)))
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
