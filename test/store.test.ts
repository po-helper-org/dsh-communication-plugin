import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { Collector, toItem, extractLinks, type ChannelPort, type IncomingMessage } from '../src/collector.js'
import { InboxStore } from '../src/store.js'
import { dispatch, type InboxPage } from '../src/channel.js'
import { ItemNotFoundError } from '../src/errors.js'
import { formatSummary, summarize } from '../src/latency.js'
import type { CollectorStatus, Thread } from '../src/model.js'

const NOW = 1_757_000_000_000
const CHAT = '-100500'

function msg(id: number, text: string, minutesAgo = 0, extra: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    id,
    chatId: CHAT,
    chatTitle: 'Рабочий чат',
    author: 'Коллега',
    authorId: '777',
    sentAt: NOW - minutesAgo * 60_000,
    text,
    hasMedia: false,
    isService: false,
    ...extra,
  }
}

function fakePort(messages: IncomingMessage[]): ChannelPort & { emit: (m: IncomingMessage) => void } {
  let handler: ((m: IncomingMessage) => void) | undefined
  return {
    async *history() { for (const m of [...messages].reverse()) yield m },
    subscribe(next) { handler = next; return () => { handler = undefined } },
    emit(m) { handler?.(m) },
  }
}

const status = (): CollectorStatus => ({ configured: true, authorized: true, watching: ['чат'], lastError: null })

test('заявка появляется в состоянии inbox с пустым классом', () => {
  const item = toItem(msg(1, 'привет'), { receivedAt: NOW })
  assert.equal(item.state, 'inbox')
  assert.equal(item.class, null)
  assert.equal(item.key, `telegram:${CHAT}:1`)
})

test('внешние идентификаторы канала хранятся с самого начала', () => {
  const item = toItem(msg(7, 'привет'), { receivedAt: NOW })
  assert.equal(item.chatId, CHAT)
  assert.equal(item.msgId, 7)
  assert.equal(item.authorId, '777')
})

test('база прошлой версии догоняется без пересоздания', () => {
  const store = new InboxStore(':memory:')
  store.save(toItem(msg(1, 'первое'), { receivedAt: NOW }))
  assert.equal(store.thread(`telegram:${CHAT}:1`).item.authorId, '777')
  store.close()
})

test('догон пишет пропущенное и двигает курсор, повтор не создаёт дублей', async () => {
  const store = new InboxStore(':memory:')
  const port = fakePort([msg(10, 'первое', 30), msg(11, 'второе', 20), msg(12, 'блокатор', 10)])
  const collector = new Collector(store, port, { now: () => NOW })

  assert.equal(await collector.catchUp('чат'), 3)
  assert.equal(store.cursor(CHAT), 12)
  assert.equal(await collector.catchUp('чат'), 0)
  assert.equal(store.count('inbox'), 3)
  store.close()
})

test('заявка, собранная позже бюджета, помечается пришедшей с задержкой', async () => {
  const store = new InboxStore(':memory:')
  const port = fakePort([msg(1, 'пока ноутбук спал', 60), msg(2, 'свежее', 1)])
  await new Collector(store, port, { now: () => NOW, delayBudgetMs: 300_000 }).catchUp('чат')

  assert.equal(store.thread(`telegram:${CHAT}:1`).item.delayed, true)
  assert.equal(store.thread(`telegram:${CHAT}:2`).item.delayed, false)
  store.close()
})

test('тред отдаёт соседей до и после без обращения в сеть', async () => {
  const store = new InboxStore(':memory:')
  const port = fakePort([msg(1, 'первое', 30), msg(2, 'второе', 20), msg(3, 'третье', 10)])
  await new Collector(store, port, { now: () => NOW }).catchUp('чат')

  const thread = store.thread(`telegram:${CHAT}:2`)
  assert.deepEqual(thread.before.map((row) => row.preview), ['первое'])
  assert.deepEqual(thread.after.map((row) => row.preview), ['третье'])
  store.close()
})

test('поток пишет только чаты из реестра, служебные сообщения пропускает', () => {
  const store = new InboxStore(':memory:')
  const port = fakePort([])
  const collector = new Collector(store, port, { now: () => NOW })
  collector.listen(new Set([CHAT]))

  port.emit(msg(1, 'наш чат'))
  port.emit(msg(2, 'чужой чат', 0, { chatId: '-999' }))
  port.emit(msg(3, 'служебное', 0, { isService: true }))

  assert.equal(store.count('inbox'), 1)
  store.close()
})

test('ссылки и вложения попадают в заявку', () => {
  assert.deepEqual(extractLinks('см. https://example.com/a и https://b.test/x?y=1'),
    ['https://example.com/a', 'https://b.test/x?y=1'])
  const item = toItem(msg(1, 'смотри https://example.com/incident', 0, { hasMedia: true }), { receivedAt: NOW })
  assert.equal(item.hasMedia, true)
  assert.deepEqual(item.links, ['https://example.com/incident'])
})

test('разбор уводит заявку из Inbox и оставляет её в истории', async () => {
  const store = new InboxStore(':memory:')
  const port = fakePort([msg(1, 'разобрать', 5)])
  await new Collector(store, port, { now: () => NOW }).catchUp('чат')
  const key = `telegram:${CHAT}:1`

  assert.equal(store.markDone(key), true)
  assert.equal(store.markDone(key), false)
  assert.equal(store.count('inbox'), 0)
  assert.equal(store.thread(key).item.state, 'разобрано')
  assert.throws(() => store.thread('telegram:x:1'), ItemNotFoundError)
  store.close()
})

test('канал отдаёт список, карточку, разбор и не бросает на неизвестной подкоманде', async () => {
  const store = new InboxStore(':memory:')
  const port = fakePort([msg(1, 'первое', 20), msg(2, 'второе', 10)])
  await new Collector(store, port, { now: () => NOW }).catchUp('чат')
  const key = `telegram:${CHAT}:2`

  const list = dispatch(store, status, 'list', {})
  assert.equal(list.ok, true)
  assert.equal((list as { value: InboxPage }).value.unresolved, 2)

  const show = dispatch(store, status, 'show', { key })
  assert.equal(show.ok, true)
  assert.equal((show as { value: Thread }).value.before.length, 1)

  assert.deepEqual(dispatch(store, status, 'done', { key }), { ok: true, value: { done: true } })
  assert.equal(dispatch(store, status, 'show', { key: 'нет-такого' }).ok, false)
  assert.equal(dispatch(store, status, 'ерунда', {}).ok, false)
  assert.equal(dispatch(store, status, 'show', {}).ok, false)
  store.close()
})

test('сводка по задержке считает перцентили по ближайшему рангу', () => {
  const summary = summarize([1000, 2000, 3000, 4000, 400_000], 300_000)
  assert.equal(summary.count, 5)
  assert.equal(summary.min, 1000)
  assert.equal(summary.p50, 3000)
  assert.equal(summary.p90, 400_000)
  assert.equal(summary.max, 400_000)
  assert.equal(summary.overBudget, 1)
  assert.equal(summarize([]).count, 0)
  assert.match(formatSummary(summary, 'Транспорт'), /Транспорт: 5 замеров/)
  assert.equal(formatSummary(summarize([]), 'Пусто'), 'Пусто: замеров нет')
})
