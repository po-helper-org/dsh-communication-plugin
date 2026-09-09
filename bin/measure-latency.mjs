// Замер задержки: от отправки сообщения в канал до появления заявки в базе.
//
// Два режима.
//   --report        считает по уже собранным заявкам, Telegram не нужен вовсе;
//   без --report    контрольный прогон: шлёт себе маркеры и ждёт их появления.
//
// Контрольный прогон по умолчанию пишет в «Избранное» (`me`) — переписка с самим собой,
// никому постороннему сообщения не уходят. Другой адресат задаётся явно: --chat @kто-то.
// Прогон требует готовой сессии (`node bin/login.mjs`) и работает от вашего аккаунта.
import { DatabaseSync } from 'node:sqlite'
import { formatSummary, summarize } from '../lib/latency.js'

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (!arg.startsWith('--')) continue
  const next = process.argv[i + 1]
  args.set(arg.slice(2), next === undefined || next.startsWith('--') ? 'true' : next)
}

const dbPath = args.get('db') ?? 'inbox.db'
const budgetMs = Number(args.get('budget') ?? 300) * 1000

if (args.has('report')) {
  const db = new DatabaseSync(dbPath)
  const rows = db.prepare('SELECT received_at - sent_at AS delta FROM items ORDER BY sent_at DESC LIMIT ?')
    .all(Number(args.get('limit') ?? 200))
  db.close()
  console.log(formatSummary(summarize(rows.map((row) => Number(row.delta)), budgetMs), 'Задержка по собранным заявкам'))
  if (rows.length === 0) console.log('База пуста: коллектор ещё ничего не собрал.')
  process.exit(0)
}

const { TelegramClient } = await import('@mtcute/node')
const apiId = Number(process.env.TG_API_ID)
const apiHash = process.env.TG_API_HASH
if (!Number.isFinite(apiId) || apiId <= 0 || !apiHash) {
  console.error('Нужны TG_API_ID и TG_API_HASH. Отчёт по уже собранному: --report --db <путь>')
  process.exit(1)
}

const chat = args.get('chat') ?? 'me'
const count = Number(args.get('count') ?? 5)
const client = new TelegramClient({ apiId, apiHash, storage: process.env.TG_SESSION ?? 'tg.session' })

await client.connect()
let me
try {
  me = await client.getMe()
} catch {
  console.error('Нет сессии Telegram: сначала `node bin/login.mjs` на этой машине')
  process.exit(1)
}
console.log(`Аккаунт: ${me.displayName}. Адресат замера: ${chat}. Маркеров: ${count}`)

/** Ждёт события с нужным маркером не дольше таймаута. Не дождались — замер не засчитан. */
const waitFor = (marker, timeoutMs) => new Promise((resolve) => {
  const timer = setTimeout(() => { client.onNewMessage.remove(handler); resolve(null) }, timeoutMs)
  const handler = (message) => {
    if (!message.text?.includes(marker)) return
    clearTimeout(timer)
    client.onNewMessage.remove(handler)
    resolve({ at: Date.now(), sentAt: message.date.getTime() })
  }
  client.onNewMessage.add(handler)
})

const transport = []
const stored = []
const db = args.has('db') ? new DatabaseSync(dbPath) : null

for (let i = 1; i <= count; i += 1) {
  const marker = `замер-задержки-${Date.now()}-${i}`
  const pending = waitFor(marker, 60_000)
  const sent = await client.sendText(chat, marker)
  const delivered = await pending
  if (delivered === null) {
    console.log(`${i}: событие не пришло за 60 с`)
    continue
  }
  // Точка отсчёта — время сервера Telegram, а не наши часы: так замер не зависит
  // от расхождения локального времени с серверным.
  transport.push(delivered.at - delivered.sentAt)
  console.log(`${i}: транспорт ${((delivered.at - delivered.sentAt) / 1000).toFixed(2)} с`)

  if (db !== null) {
    const deadline = Date.now() + 60_000
    let row
    while (Date.now() < deadline) {
      row = db.prepare('SELECT received_at, sent_at FROM items WHERE msg_id = ? AND text LIKE ?')
        .get(sent.id, `%${marker}%`)
      if (row !== undefined) break
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    if (row === undefined) console.log(`${i}: заявка в базе не появилась за 60 с`)
    else {
      stored.push(Number(row.received_at) - Number(row.sent_at))
      console.log(`${i}: до базы ${((Number(row.received_at) - Number(row.sent_at)) / 1000).toFixed(2)} с`)
    }
  }
}

db?.close()
console.log('')
console.log(formatSummary(summarize(transport, budgetMs), 'Транспорт: отправка → событие у клиента'))
if (stored.length > 0) console.log(formatSummary(summarize(stored, budgetMs), 'Сквозная: отправка → заявка в базе'))
await client.disconnect()
