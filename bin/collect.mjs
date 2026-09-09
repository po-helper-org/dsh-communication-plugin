// Коллектор: отдельный процесс, читает личный аккаунт Telegram и наполняет базу заявок.
//
// Отдельный, а не внутри харнесса: клиент тянет нативный модуль хранилища сессии,
// и несовместимый бинарь роняет весь харнесс целиком, а не свой раздел.
//
// Порядок запуска: сперва подписка на поток, потом чтение непрочитанного. Между концом
// чтения и началом подписки было бы окно, и сообщение, пришедшее в него, не попало бы
// никуда. Непрочитанное берётся от последнего прочитанного человеком, а не от нашего
// курсора: сообщение могло быть собрано прошлым запуском, но человеком не прочитано.
//
// Раздел ничего не помечает прочитанным в Telegram: чтение через MTProto не отправляет
// отметок, и собеседник не видит, что вы «прочитали».
import { fileURLToPath } from 'node:url'
import { Collector } from '../lib/collector.js'
import { mergeEnv, readEnvFile } from '../lib/env-file.js'
import { InboxStore } from '../lib/store.js'
import { TelegramChannel, telegramOptionsFromEnv } from '../lib/telegram.js'

const env = mergeEnv(readEnvFile(fileURLToPath(new URL('../.env', import.meta.url))), process.env)
const options = telegramOptionsFromEnv(env)
if (options === null) {
  console.error('Нужны TG_API_ID и TG_API_HASH в .env — получить на https://my.telegram.org')
  process.exit(1)
}

const chats = (env.WATCHED_CHATS ?? '').split(',').map((chat) => chat.trim()).filter((chat) => chat !== '')
if (chats.length === 0) {
  console.error('Пуст WATCHED_CHATS в .env: нечего собирать. Пример: WATCHED_CHATS=me,@команда')
  process.exit(1)
}

const store = new InboxStore(env.INBOX_DB ?? 'inbox.db')
const budgetMs = Number(env.DELAY_BUDGET_SEC ?? 300) * 1000

// Отметки для раздела: он отдельный процесс и о коллекторе узнаёт через ту же базу.
const beat = () => { store.setMeta('collector.seenAt', String(Date.now())) }
const fail = (message) => {
  store.setMeta('collector.lastError', message)
  beat()
  console.error(message)
}

const channel = new TelegramChannel(options)
let stop

try {
  const me = await channel.open()
  store.setMeta('collector.authorized', 'да')
  store.setMeta('collector.lastError', '')
  console.log(`Вошли как ${me}`)

  const resolved = await channel.resolve(chats)
  store.setMeta('collector.watching', [...resolved.values()].join(','))
  console.log(`Отслеживаем: ${[...resolved.values()].join(', ')}`)

  const collector = new Collector(store, channel, { delayBudgetMs: budgetMs })
  const before = store.count('inbox')
  stop = await collector.start(resolved)
  const added = store.count('inbox') - before
  console.log(`Непрочитанное прочитано: ${added} новых заявок в Inbox. Слушаем поток, Ctrl+C — выход.`)
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

const heartbeat = setInterval(beat, 30_000)
beat()

const shutdown = async () => {
  clearInterval(heartbeat)
  stop?.()
  store.setMeta('collector.seenAt', '0')
  store.close()
  await channel.close()
  console.log('\nКоллектор остановлен.')
  process.exit(0)
}
process.on('SIGINT', () => { void shutdown() })
process.on('SIGTERM', () => { void shutdown() })
