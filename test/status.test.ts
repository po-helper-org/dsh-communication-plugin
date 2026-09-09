/** Что раздел говорит про сбор: коллектор в другом процессе, судим по отметкам в базе. */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { resolveDbPath } from '../src/plugin.js'
import { HEARTBEAT_STALE_MS, readStatus } from '../src/status.js'
import { InboxStore } from '../src/store.js'

const NOW = 1_757_000_000_000

function storeWith(meta: Record<string, string>): InboxStore {
  const store = new InboxStore(':memory:')
  for (const [key, value] of Object.entries(meta)) store.setMeta(key, value)
  return store
}

test('без отметок раздел говорит, что коллектор не запущен', () => {
  const store = new InboxStore(':memory:')
  const status = readStatus(store, NOW)
  assert.equal(status.authorized, false)
  assert.equal(status.configured, false)
  assert.deepEqual(status.watching, [])
  assert.match(status.lastError ?? '', /коллектор не запущен/)
  store.close()
})

test('свежая отметка — коллектор живой, реестр и ошибка видны как есть', () => {
  const store = storeWith({
    'collector.seenAt': String(NOW - 10_000),
    'collector.authorized': 'да',
    'collector.watching': 'Стартапы,me',
    'collector.lastError': '',
  })
  const status = readStatus(store, NOW)
  assert.equal(status.authorized, true)
  assert.equal(status.configured, true)
  assert.deepEqual(status.watching, ['Стартапы', 'me'])
  assert.equal(status.lastError, null)
  store.close()
})

test('протухшая отметка перебивает признак авторизации: процесс мог умереть', () => {
  const store = storeWith({
    'collector.seenAt': String(NOW - HEARTBEAT_STALE_MS - 1),
    'collector.authorized': 'да',
    'collector.watching': 'me',
  })
  const status = readStatus(store, NOW)
  assert.equal(status.authorized, false)
  assert.match(status.lastError ?? '', /коллектор не запущен/)
  store.close()
})

test('ошибка живого коллектора доезжает до панели дословно', () => {
  const store = storeWith({
    'collector.seenAt': String(NOW - 1000),
    'collector.authorized': 'да',
    'collector.watching': 'me',
    'collector.lastError': 'Чат @нет пропущен: not found',
  })
  assert.equal(readStatus(store, NOW).lastError, 'Чат @нет пропущен: not found')
  store.close()
})

test('путь к базе: абсолютный как есть, относительный от корня воркспейса', () => {
  assert.equal(resolveDbPath({ workspaceRoot: '/w', dbPath: 'communication/inbox.db' }), '/w/communication/inbox.db')
  assert.equal(resolveDbPath({ workspaceRoot: '/w', dbPath: '/tmp/inbox.db' }), '/tmp/inbox.db')
  assert.equal(resolveDbPath({ workspaceRoot: '', dbPath: 'inbox.db' }), 'inbox.db')
})
