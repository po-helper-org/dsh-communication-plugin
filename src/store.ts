/**
 * Хранилище заявок: один локальный файл SQLite, без сервера СУБД.
 *
 * `node:sqlite` вместо внешнего драйвера — у раздела не должно быть ни нативной сборки,
 * ни второго процесса: он живёт на машине владельца рядом с харнессом.
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { ItemNotFoundError, StoreUnavailableError } from './errors.js'
import type { Item, ItemRow, State, Thread } from './model.js'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS items (
    key         TEXT PRIMARY KEY,
    channel     TEXT NOT NULL,
    chat_id     TEXT NOT NULL,
    chat_title  TEXT,
    msg_id      INTEGER NOT NULL,
    thread_key  TEXT NOT NULL,
    author      TEXT,
    author_id   TEXT,
    sent_at     INTEGER NOT NULL,
    received_at INTEGER NOT NULL,
    delayed     INTEGER NOT NULL DEFAULT 0,
    text        TEXT NOT NULL DEFAULT '',
    has_media   INTEGER NOT NULL DEFAULT 0,
    links       TEXT,
    state       TEXT NOT NULL DEFAULT 'inbox',
    class       TEXT,
    labels      TEXT
  );
  CREATE INDEX IF NOT EXISTS items_state ON items(state, sent_at DESC);
  CREATE INDEX IF NOT EXISTS items_thread ON items(thread_key, msg_id);
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cursors (
    chat_id     TEXT PRIMARY KEY,
    last_msg_id INTEGER NOT NULL
  );
`

interface Row {
  key: string
  channel: string
  chat_id: string
  chat_title: string | null
  msg_id: number
  thread_key: string
  author: string | null
  author_id: string | null
  sent_at: number
  received_at: number
  delayed: number
  text: string
  has_media: number
  links: string | null
  state: string
  class: string | null
  labels: string | null
}

/** Список в одной ячейке: заявка редко несёт больше трёх лейблов, таблица связей избыточна. */
function splitList(value: string | null): string[] {
  return value === null || value === '' ? [] : value.split('\n')
}

function toItem(row: Row): Item {
  return {
    key: row.key,
    channel: row.channel,
    chatId: row.chat_id,
    chatTitle: row.chat_title,
    msgId: Number(row.msg_id),
    threadKey: row.thread_key,
    author: row.author,
    authorId: row.author_id,
    sentAt: Number(row.sent_at),
    receivedAt: Number(row.received_at),
    delayed: row.delayed === 1,
    text: row.text,
    hasMedia: row.has_media === 1,
    links: row.links === null || row.links === '' ? [] : row.links.split('\n'),
    state: row.state as State,
    class: row.class,
    labels: splitList(row.labels),
  }
}

function toRow(row: Pick<Row, 'key' | 'chat_title' | 'author' | 'sent_at' | 'delayed' | 'has_media' | 'text' | 'labels'>): ItemRow {
  return {
    key: row.key,
    chatTitle: row.chat_title,
    author: row.author,
    sentAt: Number(row.sent_at),
    delayed: row.delayed === 1,
    hasMedia: row.has_media === 1,
    preview: row.text.replace(/\s+/g, ' ').slice(0, 160),
    labels: splitList(row.labels),
  }
}

export class InboxStore {
  private readonly db: DatabaseSync

  constructor(path: string) {
    try {
      if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
      this.db = new DatabaseSync(path)
      this.db.exec(SCHEMA)
      this.migrate()
    } catch (error) {
      throw new StoreUnavailableError(path, error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Догоняет схему до текущей: база уже могла быть заведена прошлой версией раздела.
   * Столбцы добавляются по одному и только отсутствующие — база владельца не пересоздаётся.
   */
  private migrate(): void {
    const columns = new Set(
      (this.db.prepare('PRAGMA table_info(items)').all() as Array<{ name: string }>).map((row) => row.name),
    )
    if (!columns.has('author_id')) this.db.exec('ALTER TABLE items ADD COLUMN author_id TEXT')
    if (!columns.has('labels')) this.db.exec('ALTER TABLE items ADD COLUMN labels TEXT')
  }

  /**
   * Кладёт заявку. Повторный проход по тем же сообщениям дублей не создаёт и уже
   * проставленное состояние разбора не сбрасывает: возврат `false` означает «такая уже есть».
   */
  save(item: Item): boolean {
    const result = this.db.prepare(`
      INSERT INTO items (key, channel, chat_id, chat_title, msg_id, thread_key, author, author_id,
                         sent_at, received_at, delayed, text, has_media, links, state, class, labels)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(key) DO NOTHING
    `).run(
      item.key, item.channel, item.chatId, item.chatTitle, item.msgId, item.threadKey,
      item.author, item.authorId, item.sentAt, item.receivedAt, item.delayed ? 1 : 0, item.text,
      item.hasMedia ? 1 : 0, item.links.length === 0 ? null : item.links.join('\n'),
      item.state, item.class, item.labels.length === 0 ? null : item.labels.join('\n'),
    )
    return result.changes === 1
  }

  /** Последнее обработанное сообщение чата: с него продолжается догон после перезапуска. */
  cursor(chatId: string): number {
    const row = this.db.prepare('SELECT last_msg_id FROM cursors WHERE chat_id = ?').get(chatId) as
      { last_msg_id: number } | undefined
    return row === undefined ? 0 : Number(row.last_msg_id)
  }

  advanceCursor(chatId: string, msgId: number): void {
    this.db.prepare(`
      INSERT INTO cursors (chat_id, last_msg_id) VALUES (?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET last_msg_id = MAX(last_msg_id, excluded.last_msg_id)
    `).run(chatId, msgId)
  }

  /** Список Inbox: всё собранное, новые сверху, без предварительного отсева. */
  list(limit = 100): ItemRow[] {
    const rows = this.db.prepare(`
      SELECT key, chat_title, author, sent_at, delayed, has_media, text, labels
      FROM items WHERE state = 'inbox' ORDER BY sent_at DESC LIMIT ?
    `).all(limit) as Array<Parameters<typeof toRow>[0]>
    return rows.map(toRow)
  }

  count(state: State = 'inbox'): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM items WHERE state = ?').get(state) as { n: number }
    return Number(row.n)
  }

  /** Карточка: сама заявка и соседи по диалогу. В сеть за тредом ходить не нужно. */
  thread(key: string, radius = 5): Thread {
    const row = this.db.prepare('SELECT * FROM items WHERE key = ?').get(key) as Row | undefined
    if (row === undefined) throw new ItemNotFoundError(key)
    const item = toItem(row)
    const before = this.db.prepare(`
      SELECT key, chat_title, author, sent_at, delayed, has_media, text, labels FROM items
      WHERE thread_key = ? AND msg_id < ? ORDER BY msg_id DESC LIMIT ?
    `).all(item.threadKey, item.msgId, radius) as Array<Parameters<typeof toRow>[0]>
    const after = this.db.prepare(`
      SELECT key, chat_title, author, sent_at, delayed, has_media, text, labels FROM items
      WHERE thread_key = ? AND msg_id > ? ORDER BY msg_id ASC LIMIT ?
    `).all(item.threadKey, item.msgId, radius) as Array<Parameters<typeof toRow>[0]>
    return { item, before: before.map(toRow).reverse(), after: after.map(toRow) }
  }

  /**
   * Ставит или снимает лейбл. Возвращает итоговый список: панель не пересчитывает
   * состояние сама, а показывает то, что действительно записано.
   */
  setLabel(key: string, label: string, on: boolean): string[] {
    const row = this.db.prepare('SELECT labels FROM items WHERE key = ?').get(key) as { labels: string | null } | undefined
    if (row === undefined) throw new ItemNotFoundError(key)
    const current = splitList(row.labels).filter((applied) => applied !== label)
    const next = on ? [...current, label] : current
    this.db.prepare('UPDATE items SET labels = ? WHERE key = ?')
      .run(next.length === 0 ? null : next.join('\n'), key)
    return next
  }

  /** Разбор: заявка уходит из Inbox и остаётся в истории. */
  markDone(key: string): boolean {
    const exists = this.db.prepare('SELECT 1 FROM items WHERE key = ?').get(key)
    if (exists === undefined) throw new ItemNotFoundError(key)
    return this.db.prepare("UPDATE items SET state = 'разобрано' WHERE key = ? AND state = 'inbox'")
      .run(key).changes === 1
  }

  /**
   * Состояние коллектора. Коллектор — отдельный процесс, поэтому раздел узнаёт о нём
   * единственным доступным обоим способом: через ту же базу.
   */
  setMeta(key: string, value: string): void {
    this.db.prepare('INSERT INTO meta (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  }

  getMeta(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined
    return row === undefined ? null : row.value
  }

  close(): void {
    this.db.close()
  }
}
