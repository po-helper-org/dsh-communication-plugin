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
