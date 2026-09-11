/**
 * Модель заявки. Канало-независимая по построению: канал — поле, а не структура,
 * поэтому почта и MTS.Link добавляются коллекторами, а не переделкой модели.
 */

/** Состояния разбора. Третьим значением сюда встанет `to-review`, когда появится разметчик. */
export const STATES = ['inbox', 'разобрано'] as const
export type State = (typeof STATES)[number]

/** Заявка — одно входящее сообщение, требующее решения. */
export interface Item {
  /** `{канал}:{чат}:{сообщение}` — устойчивый ключ, по нему же идёт защита от дублей. */
  key: string
  channel: string
  chatId: string
  chatTitle: string | null
  msgId: number
  /** Диалог, внутри которого лежит сообщение: по нему собираются соседи до и после. */
  threadKey: string
  author: string | null
  /**
   * Автор в терминах канала. Отображаемое имя меняется, идентификатор — нет, поэтому
   * сопоставление с внешней системой держится на нём (см. docs/PRINCIPLES.md).
   */
  authorId: string | null
  /** Вид чата на момент сбора. `null` — Telegram не сообщил форму. */
  chatKind: ChatKind | null
  /**
   * Куда заявке идти. Набор, а не одно значение: рабочая группа может одновременно
   * быть и разговором, и содержимым ленты.
   */
  route: Route[]
  sentAt: number
  receivedAt: number
  /** Собрано позже бюджета задержки: машина спала или не было сети. */
  delayed: boolean
  text: string
  hasMedia: boolean
  links: string[]
  state: State
  /** Класс заявки. Пуст до появления разметчика — поле есть с самого начала. */
  class: string | null
  /**
   * Лейблы — основа разметки. Хранятся идентификаторами: подпись и цвет живут
   * в справочнике раздела, поэтому переименование лейбла не трогает ни одной заявки.
   */
  labels: string[]
}

/** Строка списка Inbox: панели не нужен полный текст и тред. */
export interface ItemRow {
  key: string
  chatTitle: string | null
  author: string | null
  sentAt: number
  delayed: boolean
  hasMedia: boolean
  preview: string
  labels: string[]
}

/** Соседи по диалогу: что было до сообщения и что после. */
export interface Thread {
  item: Item
  before: ItemRow[]
  after: ItemRow[]
}

/** Состояние коллектора для панели: раздел обязан честно говорить, почему он пуст. */
export interface CollectorStatus {
  configured: boolean
  authorized: boolean
  watching: string[]
  lastError: string | null
}

/**
 * Вид чата в терминах Telegram, сведённый в один плоский набор.
 *
 * В mtcute это два разных места: `Peer` — объединение `User | Chat`, и `.type` там
 * дискриминатор объединения (`"user"` либо `"chat"`), а настоящий вид группы лежит
 * в `Chat.chatType`. Потребителю раздела важен вид разговора, а не класс библиотеки,
 * поэтому оба уровня сводятся сюда.
 */
export const CHAT_KINDS = ['user', 'bot', 'group', 'supergroup', 'channel', 'gigagroup', 'monoforum'] as const
export type ChatKind = (typeof CHAT_KINDS)[number]

/**
 * Куда уходит заявка. `dialog` — система диалогов, `feed` — лента.
 * Порядок значений канонический: по нему маршруты сортируются перед хранением,
 * поэтому одинаковый набор всегда даёт одинаковую строку и группируется без сюрпризов.
 */
export const ROUTES = ['dialog', 'feed'] as const
export type Route = (typeof ROUTES)[number]

/**
 * Строка распределения: сколько заявок из какого чата каким маршрутом ушло.
 * Нужна ровно для проверки разметки глазами перед переездом.
 */
export interface RouteRow {
  chatId: string
  chatTitle: string | null
  chatKind: string | null
  route: string
  count: number
}
