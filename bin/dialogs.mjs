// Список диалогов аккаунта: что есть и где лежит непрочитанное.
//
// Только заголовки и счётчики — тела сообщений здесь не читаются и не печатаются.
// Нужен, чтобы осознанно выбрать реестр WATCHED_CHATS, а не включать сбор вслепую.
import { fileURLToPath } from 'node:url'
import { mergeEnv, readEnvFile } from '../lib/env-file.js'
import { telegramOptionsFromEnv } from '../lib/telegram.js'
import { TelegramClient } from '@mtcute/node'

const env = mergeEnv(readEnvFile(fileURLToPath(new URL('../.env', import.meta.url))), process.env)
const options = telegramOptionsFromEnv(env)
if (options === null) {
  console.error('Нужны TG_API_ID и TG_API_HASH в .env')
  process.exit(1)
}

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (!arg.startsWith('--')) continue
  const next = process.argv[i + 1]
  args.set(arg.slice(2), next === undefined || next.startsWith('--') ? 'true' : next)
}
const limit = Number(args.get('limit') ?? 40)
const onlyUnread = args.has('unread')

const client = new TelegramClient({ apiId: options.apiId, apiHash: options.apiHash, storage: options.sessionPath })
await client.connect()
try {
  await client.getMe()
} catch {
  console.error('Нет сессии Telegram: сначала `node bin/login.mjs`')
  process.exit(1)
}

if (args.has('folders')) {
  const folders = await client.getFolders()
  console.log('Папки Telegram:\n')
  for (const folder of folders.filters) {
    if (folder._ !== 'dialogFilter' && folder._ !== 'dialogFilterChatlist') continue
    const title = typeof folder.title === 'string' ? folder.title : folder.title?.text ?? '(без названия)'
    const size = (folder.includePeers?.length ?? 0) + (folder.pinnedPeers?.length ?? 0)
    console.log(`  ${title}   — чатов в списке: ${size}`)
  }
  console.log('\nВ .env: WATCHED_FOLDERS=<название папки>')
  await client.destroy()
  process.exit(0)
}

const kind = (peer) => (peer.type === 'user' ? (peer.isBot ? 'бот' : 'личка') : peer.type === 'chat' ? 'группа' : 'канал')
const rows = []
const folder = args.get('folder')
for await (const dialog of client.iterDialogs(folder === undefined ? { limit } : { folder, limit })) {
  if (onlyUnread && dialog.unreadCount === 0) continue
  rows.push({
    ref: dialog.peer.username === undefined || dialog.peer.username === null ? String(dialog.peer.id) : `@${dialog.peer.username}`,
    title: dialog.peer.displayName,
    kind: kind(dialog.peer),
    unread: dialog.unreadCount,
    mentions: dialog.unreadMentionsCount,
  })
}

rows.sort((left, right) => right.unread - left.unread)
console.log(`Диалогов: ${rows.length}${onlyUnread ? ' (только с непрочитанным)' : ''}\n`)
console.log('непроч.  упом.  тип      идентификатор для WATCHED_CHATS      название')
for (const row of rows) {
  console.log(
    `${String(row.unread).padStart(7)}  ${String(row.mentions).padStart(5)}  ${row.kind.padEnd(7)}  ${row.ref.padEnd(34)}  ${row.title}`,
  )
}
const total = rows.reduce((sum, row) => sum + row.unread, 0)
console.log(`\nВсего непрочитанных сообщений: ${total}`)
await client.destroy()
