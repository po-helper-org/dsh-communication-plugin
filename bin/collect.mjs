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

const list = (value) => (value ?? '').split(',').map((item) => item.trim()).filter((item) => item !== '')
const chats = list(env.WATCHED_CHATS)
const folders = list(env.WATCHED_FOLDERS)
// WATCH_PRIVATE=1 — принимать любые личные сообщения. Реестр при этом не обязателен:
// правило отбора не требует ни одного запроса к Telegram, поэтому подписка встаёт сразу.
const privateToo = env.WATCH_PRIVATE === '1'
if (chats.length === 0 && folders.length === 0 && !privateToo) {
  console.error('Пусты WATCHED_FOLDERS и WATCHED_CHATS в .env: нечего собирать.')
  console.error('Пример: WATCHED_FOLDERS=Стартапы   либо   WATCHED_CHATS=me,@команда')
  console.error('Список папок: node bin/dialogs.mjs --folders')
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

  // Папки — основной способ задать границу сбора: состав ведётся в самом Telegram.
  // Отдельные чаты из WATCHED_CHATS добавляются к ним, а не заменяют их.
  const resolved = new Map()
  if (folders.length > 0) {
    const fromFolders = await channel.resolveFolders(folders)
    for (const [ref, message] of fromFolders.failed) console.error(`Папка «${ref}»: ${message}`)
    for (const [id, ref] of fromFolders.chats) resolved.set(id, ref)
    console.log(`Папки: ${folders.join(', ')} — ${fromFolders.chats.size} чатов`)
  }
  if (chats.length > 0) {
    const fromChats = await channel.resolve(chats)
    for (const [ref, message] of fromChats.failed) console.error(`Чат ${ref} пропущен: ${message}`)
    for (const [id, ref] of fromChats.chats) resolved.set(id, ref)
  }
  if (resolved.size === 0 && !privateToo) throw new Error('ни один чат из реестра не доступен')
  store.setMeta('collector.watching', [...resolved.values()].join(','))
  console.log(`Отслеживаем чатов: ${resolved.size}`)

  // Отказ фонового цикла по одному чату не должен останавливать сбор по остальным.
  channel.onError((error) => {
    const message = error instanceof Error ? error.message : String(error)
    store.setMeta('collector.lastError', message)
    console.error(`Ошибка потока: ${message}`)
  })

  const collector = new Collector(store, channel, { delayBudgetMs: budgetMs })
  const before = store.count('inbox')
  if (privateToo) console.log('Личные сообщения принимаются из любых диалогов, включая новые')
  stop = await collector.start(
    resolved,
    (ref, message) => {
      console.error(`Чтение ${ref} прервано: ${message}`)
      store.setMeta('collector.lastError', `${ref}: ${message}`)
    },
    privateToo ? (message) => message.chatKind === 'user' : undefined,
  )
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
