// Проверка логики хранилища без сети: дубли, курсор, задержка, тред, разбор.
import { strict as assert } from 'node:assert'
import { rmSync } from 'node:fs'
import { openStore, toItem, saveItem, readCursor, advanceCursor,
         listInbox, threadAround, markDone, extractLinks, DELAY_BUDGET_MS } from './store.mjs'

const DB = 'selftest.db'
rmSync(DB, { force: true })
const db = openStore(DB)

const chat = { id: -100500, displayName: 'Рабочий чат' }
const msg = (id, text, minutesAgo = 0, media = null) => ({
  id, chat, sender: { displayName: 'Коллега' },
  date: new Date(Date.now() - minutesAgo * 60_000), text, media,
})

// сбор и курсор
for (const m of [msg(10, 'первое', 30), msg(11, 'второе', 20), msg(12, 'блокатор на проде', 10)]) {
  assert.equal(saveItem(db, toItem(m, { receivedAt: m.date.getTime() + 1000 })), true)
  advanceCursor(db, chat.id, m.id)
}
assert.equal(readCursor(db, chat.id), 12)

// повторный проход не дублирует
assert.equal(saveItem(db, toItem(msg(11, 'второе', 20))), false)
assert.equal(listInbox(db).length, 3)

// задержка: собрано позже бюджета
const late = msg(13, 'пока ноутбук спал', 60)
saveItem(db, toItem(late, { receivedAt: late.date.getTime() + DELAY_BUDGET_MS + 1 }))
assert.equal(threadAround(db, 'telegram:-100500:13').item.delayed, 1)
assert.equal(threadAround(db, 'telegram:-100500:12').item.delayed, 0)

// тред: что было до и после
const around = threadAround(db, 'telegram:-100500:11')
assert.deepEqual(around.before.map((m) => m.text), ['первое'])
assert.deepEqual(around.after.map((m) => m.text), ['блокатор на проде', 'пока ноутбук спал'])

// ссылки и вложения
assert.deepEqual(extractLinks('см. https://example.com/a и https://b.test/x?y=1'),
                 ['https://example.com/a', 'https://b.test/x?y=1'])
saveItem(db, toItem(msg(14, 'смотри https://example.com/incident', 1, { type: 'photo' })))
const withMedia = threadAround(db, 'telegram:-100500:14').item
assert.equal(withMedia.has_media, 1)
assert.equal(withMedia.links, 'https://example.com/incident')

// разбор: уходит из Inbox, остаётся в истории
assert.equal(markDone(db, 'telegram:-100500:12'), true)
assert.equal(markDone(db, 'telegram:-100500:12'), false)
assert.equal(listInbox(db).length, 4)
assert.equal(threadAround(db, 'telegram:-100500:12').item.state, 'разобрано')

// состояние по умолчанию и пустой класс
assert.equal(toItem(msg(15, 'x')).state, 'inbox')
assert.equal(toItem(msg(15, 'x')).class, null)

db.close()
rmSync(DB, { force: true })
console.log('selftest: 14 проверок пройдено')
