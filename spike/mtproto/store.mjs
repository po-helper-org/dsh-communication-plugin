// Хранилище заявок: один локальный файл SQLite, без сервера СУБД (НФТ-2).
// Модель заявки канало-независимая: канал — колонка, не структура (ФТ-2).
import { DatabaseSync } from 'node:sqlite'

export const DELAY_BUDGET_MS = 5 * 60 * 1000

export function openStore(path = 'inbox.db') {
  const db = new DatabaseSync(path)
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      key         TEXT PRIMARY KEY,
      channel     TEXT NOT NULL,
      chat_id     TEXT NOT NULL,
      chat_title  TEXT,
      msg_id      INTEGER NOT NULL,
      thread_key  TEXT NOT NULL,
      author      TEXT,
      sent_at     INTEGER NOT NULL,
      received_at INTEGER NOT NULL,
      delayed     INTEGER NOT NULL DEFAULT 0,
      text        TEXT,
      has_media   INTEGER NOT NULL DEFAULT 0,
      links       TEXT,
      state       TEXT NOT NULL DEFAULT 'inbox',
      class       TEXT
    );
    CREATE INDEX IF NOT EXISTS items_state ON items(state, sent_at DESC);
    CREATE INDEX IF NOT EXISTS items_thread ON items(thread_key, msg_id);
    CREATE TABLE IF NOT EXISTS cursors (
      chat_id      TEXT PRIMARY KEY,
      last_msg_id  INTEGER NOT NULL
    );
  `)
  return db
}

const LINK_RE = /https?:\/\/[^\s<>"')]+/g

export function extractLinks(text) {
  return text ? (text.match(LINK_RE) ?? []) : []
}

// Заявка появляется только в состоянии inbox — других путей нет (ФТ-4).
export function toItem(msg, { channel = 'telegram', receivedAt = Date.now() } = {}) {
  const chatId = String(msg.chat?.id ?? 'unknown')
  const sentAt = msg.date instanceof Date ? msg.date.getTime() : Number(msg.date ?? 0) * 1000
  const links = extractLinks(msg.text)
  return {
    key: `${channel}:${chatId}:${msg.id}`,
    channel,
    chat_id: chatId,
    chat_title: msg.chat?.displayName ?? null,
    msg_id: msg.id,
    thread_key: `${channel}:${chatId}`,
    author: msg.sender?.displayName ?? null,
    sent_at: sentAt,
    received_at: receivedAt,
    delayed: receivedAt - sentAt > DELAY_BUDGET_MS ? 1 : 0,
    text: msg.text ?? '',
    has_media: msg.media && msg.media.type !== 'unsupported' ? 1 : 0,
    links: links.length ? links.join('\n') : null,
    state: 'inbox',
    class: null,
  }
}

// Повторный проход по тем же сообщениям не создаёт дублей и не сбрасывает
// уже проставленное состояние разбора (НФТ-3).
export function saveItem(db, item) {
  const res = db.prepare(`
    INSERT INTO items (key, channel, chat_id, chat_title, msg_id, thread_key, author,
                       sent_at, received_at, delayed, text, has_media, links, state, class)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(key) DO NOTHING
  `).run(item.key, item.channel, item.chat_id, item.chat_title, item.msg_id, item.thread_key,
         item.author, item.sent_at, item.received_at, item.delayed, item.text,
         item.has_media, item.links, item.state, item.class)
  return res.changes === 1
}

export function readCursor(db, chatId) {
  const row = db.prepare('SELECT last_msg_id FROM cursors WHERE chat_id = ?').get(String(chatId))
  return row ? Number(row.last_msg_id) : 0
}

export function advanceCursor(db, chatId, msgId) {
  db.prepare(`
    INSERT INTO cursors (chat_id, last_msg_id) VALUES (?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET last_msg_id = MAX(last_msg_id, excluded.last_msg_id)
  `).run(String(chatId), Number(msgId))
}

export function listInbox(db, limit = 50) {
  return db.prepare(`
    SELECT key, chat_title, author, sent_at, delayed, has_media, text
    FROM items WHERE state = 'inbox' ORDER BY sent_at DESC LIMIT ?
  `).all(limit)
}

// Тред вокруг сообщения: что было до и после, из локальной базы (ФТ-3).
export function threadAround(db, key, radius = 5) {
  const item = db.prepare('SELECT * FROM items WHERE key = ?').get(key)
  if (!item) return null
  const before = db.prepare(`
    SELECT author, sent_at, text FROM items
    WHERE thread_key = ? AND msg_id < ? ORDER BY msg_id DESC LIMIT ?
  `).all(item.thread_key, item.msg_id, radius).reverse()
  const after = db.prepare(`
    SELECT author, sent_at, text FROM items
    WHERE thread_key = ? AND msg_id > ? ORDER BY msg_id ASC LIMIT ?
  `).all(item.thread_key, item.msg_id, radius)
  return { item, before, after }
}

export function markDone(db, key) {
  return db.prepare("UPDATE items SET state = 'разобрано' WHERE key = ? AND state = 'inbox'")
           .run(key).changes === 1
}
