import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { toChatKind, toIncoming } from '../src/telegram.js'

const DATE = new Date(1_757_000_000_000)

const message = (chat: Record<string, unknown>) => ({
  id: 1,
  isService: false,
  text: 'привет',
  date: DATE,
  chat: { id: -100500, displayName: 'Чат', ...chat },
})

test('приватный диалог распознаётся как user', () => {
  assert.equal(toChatKind({ id: 1, type: 'user' }), 'user')
})

test('бот отличается от человека', () => {
  assert.equal(toChatKind({ id: 1, type: 'user', isBot: true }), 'bot')
})

test('вид группы читается из chatType, а не из type', () => {
  assert.equal(toChatKind({ id: -1, type: 'chat', chatType: 'supergroup' }), 'supergroup')
  assert.equal(toChatKind({ id: -1, type: 'chat', chatType: 'group' }), 'group')
})

test('вещательный канал отличим от супергруппы', () => {
  assert.equal(toChatKind({ id: -1, type: 'chat', chatType: 'channel' }), 'channel')
  assert.notEqual(
    toChatKind({ id: -1, type: 'chat', chatType: 'channel' }),
    toChatKind({ id: -1, type: 'chat', chatType: 'supergroup' }),
  )
})

test('неизвестная форма даёт null, а не выдуманное значение', () => {
  assert.equal(toChatKind({ id: -1, type: 'chat' }), null)
  assert.equal(toChatKind({ id: -1 }), null)
})

test('toIncoming кладёт вид чата в заявку', () => {
  const incoming = toIncoming(message({ type: 'chat', chatType: 'channel' }))
  assert.equal(incoming.chatKind, 'channel')
})
