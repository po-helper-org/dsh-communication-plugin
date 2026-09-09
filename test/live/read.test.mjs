// Живой тест: система действительно читает данные из Telegram.
//
// Не подделка портом — настоящий аккаунт, настоящая история, настоящая запись в базу.
// Ничего не отправляет: только чтение, чтобы прогон теста не оставлял следов в переписке.
//
// Требует сессии (`node bin/login.mjs`) и явного согласия: без RUN_LIVE_TESTS=1 тесты
// пропускаются, поэтому обычный `npm test` не ходит в сеть и не зависит от аккаунта.
//
//   RUN_LIVE_TESTS=1 npm run test:live
//   RUN_LIVE_TESTS=1 LIVE_TEST_CHAT=@канал npm run test:live
import { strict as assert } from 'node:assert'
import { existsSync, rmSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Collector } from '../../lib/collector.js'
import { mergeEnv, readEnvFile } from '../../lib/env-file.js'
import { InboxStore } from '../../lib/store.js'
import { TelegramChannel, telegramOptionsFromEnv } from '../../lib/telegram.js'

const env = mergeEnv(readEnvFile(fileURLToPath(new URL('../../.env', import.meta.url))), process.env)
const options = telegramOptionsFromEnv(env)
const sessionExists = options !== null && existsSync(options.sessionPath)
const skip = env.RUN_LIVE_TESTS !== '1'
  ? 'нужен RUN_LIVE_TESTS=1 — живые тесты ходят в Telegram'
  : options === null
    ? 'нет TG_API_ID и TG_API_HASH в .env'
    : !sessionExists
      ? `нет сессии ${options.sessionPath} — сначала node bin/login.mjs`
      : false

// «Избранное» по умолчанию: чтение собственных заметок никого не затрагивает.
const CHAT = env.LIVE_TEST_CHAT ?? 'me'
const DB = '/tmp/live-read-test.db'

let channel
let store

before(async () => {
  if (skip) return
  rmSync(DB, { force: true })
  channel = new TelegramChannel(options)
  await channel.open()
  store = new InboxStore(DB)
})

after(async () => {
  store?.close()
  rmSync(DB, { force: true })
  await channel?.close()
})

test('вход по сохранённой сессии, без ввода кода', { skip }, () => {
  assert.ok(channel, 'клиент поднялся на готовой сессии')
})

test('история чата читается и приходит настоящими сообщениями', { skip }, async () => {
  const messages = []
  for await (const message of channel.history(CHAT, 5)) {
    messages.push(message)
    if (messages.length >= 5) break
  }
  assert.ok(messages.length > 0, `в ${CHAT} нет ни одного сообщения — возьмите другой LIVE_TEST_CHAT`)
  for (const message of messages) {
    assert.equal(typeof message.id, 'number')
    assert.ok(message.id > 0)
    assert.equal(typeof message.chatId, 'string')
    assert.ok(message.sentAt > 0 && message.sentAt <= Date.now() + 60_000, 'время отправки правдоподобно')
    assert.equal(typeof message.text, 'string')
  }
  // Идентификаторы убывают: история идёт от свежих к старым.
  const ids = messages.map((message) => message.id)
  assert.deepEqual(ids, [...ids].sort((left, right) => right - left))
})

test('порог непрочитанного отдаётся числом', { skip }, async () => {
  const lastRead = await channel.lastRead(CHAT)
  assert.equal(typeof lastRead, 'number')
  assert.ok(lastRead >= 0)
})

test('в полностью прочитанном чате непрочитанного нет', { skip }, async () => {
  // Порог берётся от последнего прочитанного человеком. Всё прочитано — собирать нечего,
  // и это правильный ответ, а не пустой результат из-за ошибки.
  const collected = await new Collector(store, channel, { catchUpLimit: 20 }).catchUp(CHAT)
  assert.equal(collected, 0)
  assert.equal(store.count('inbox'), 0)
})

test('прочитанное доезжает до базы заявок и не двоится при повторе', { skip }, async () => {
  // Порог сбивается в ноль, чтобы проверить весь путь на настоящей истории: чат может
  // быть прочитан целиком, а путь «Telegram → заявка» проверить всё равно надо.
  const fromScratch = {
    history: (chat, limit) => channel.history(chat, limit),
    subscribe: (handler) => channel.subscribe(handler),
    lastRead: async () => 0,
  }
  const collector = new Collector(store, fromScratch, { catchUpLimit: 20 })
  const first = await collector.catchUp(CHAT)
  assert.ok(first > 0, `в ${CHAT} нет сообщений — возьмите другой LIVE_TEST_CHAT`)

  const rows = store.list(5)
  assert.ok(rows.length > 0)
  for (const row of rows) assert.equal(typeof row.preview, 'string')

  const sample = store.thread(rows[0].key)
  assert.equal(sample.item.state, 'inbox')
  assert.equal(sample.item.class, null)
  assert.equal(sample.item.channel, 'telegram')
  assert.ok(sample.item.chatId.length > 0)
  assert.ok(sample.item.msgId > 0)
  assert.ok(store.cursor(sample.item.chatId) >= sample.item.msgId, 'курсор сдвинулся вперёд')

  const second = await collector.catchUp(CHAT)
  assert.equal(second, 0, 'повторный проход не создаёт дублей')
  assert.equal(store.count('inbox'), first)
})

test('подписка на поток поднимается и снимается', { skip }, () => {
  const stop = channel.subscribe(() => {})
  assert.equal(typeof stop, 'function')
  stop()
})
