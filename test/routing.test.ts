import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { parseOverrides, routeFor } from '../src/routing.js'

test('личка и рабочие группы идут в диалоги', () => {
  assert.deepEqual(routeFor('user', '1'), ['dialog'])
  assert.deepEqual(routeFor('bot', '1'), ['dialog'])
  assert.deepEqual(routeFor('group', '-1'), ['dialog'])
  assert.deepEqual(routeFor('supergroup', '-1'), ['dialog'])
})

test('вещание идёт в ленту', () => {
  assert.deepEqual(routeFor('channel', '-1'), ['feed'])
  assert.deepEqual(routeFor('gigagroup', '-1'), ['feed'])
})

test('неизвестный вид уходит в диалоги, а не в ленту', () => {
  // Потерять рабочее сообщение дороже, чем засорить диалоги новостью.
  assert.deepEqual(routeFor(null, '-1'), ['dialog'])
  assert.deepEqual(routeFor(undefined, '-1'), ['dialog'])
})

test('переопределение реестра важнее вида чата', () => {
  const overrides = { feed: new Set(['-100']), dialog: new Set(['-200']), both: new Set(['-300']) }
  assert.deepEqual(routeFor('supergroup', '-100', overrides), ['feed'])
  assert.deepEqual(routeFor('channel', '-200', overrides), ['dialog'])
})

test('чат можно направить в обе системы сразу', () => {
  const overrides = { both: new Set(['-300']) }
  assert.deepEqual(routeFor('supergroup', '-300', overrides), ['dialog', 'feed'])
})

test('порядок маршрутов канонический независимо от источника', () => {
  const overrides = { both: new Set(['-300']) }
  assert.deepEqual(routeFor('channel', '-300', overrides), ['dialog', 'feed'])
})

test('переопределения читаются из окружения', () => {
  const parsed = parseOverrides({ ROUTE_FEED: '-100, -101', ROUTE_BOTH: '-300' })
  assert.deepEqual([...parsed.feed], ['-100', '-101'])
  assert.deepEqual([...parsed.both], ['-300'])
  assert.equal(parsed.dialog.size, 0)
})

test('пустое окружение даёт пустые переопределения, а не падение', () => {
  const parsed = parseOverrides({})
  assert.equal(parsed.feed.size, 0)
  assert.equal(parsed.dialog.size, 0)
  assert.equal(parsed.both.size, 0)
})
