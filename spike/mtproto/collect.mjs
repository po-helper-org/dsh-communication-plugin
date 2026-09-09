// Коллектор: личный аккаунт Telegram на MTProto, чаты из реестра watched.json (ФТ-1).
// Догоняет пропущенное с последнего обработанного сообщения, затем слушает поток.
import { readFileSync } from 'node:fs'
import { TelegramClient } from '@mtcute/node'
import { openStore, toItem, saveItem, readCursor, advanceCursor } from './store.mjs'

const apiId = Number(process.env.TG_API_ID)
const apiHash = process.env.TG_API_HASH
if (!apiId || !apiHash) {
  console.error('Нужны TG_API_ID и TG_API_HASH — получить на https://my.telegram.org')
  process.exit(1)
}

const watched = JSON.parse(readFileSync(new URL('./watched.json', import.meta.url), 'utf8'))
const db = openStore(process.env.INBOX_DB ?? 'inbox.db')

const client = new TelegramClient({
  apiId,
  apiHash,
  storage: process.env.TG_SESSION ?? 'tg.session',
})

const me = await client.start()
console.log(`Вошли как ${me.displayName}`)

const chats = new Map()
for (const ref of watched.chats) {
  const chat = await client.resolvePeer(ref)
  const id = String(chat.userId ?? chat.chatId ?? chat.channelId ?? ref)
  chats.set(id, ref)
  console.log(`Отслеживаем ${ref} (${id})`)
}

// Догон пропущенного за простой машины: идём от свежих к старым до курсора.
for (const [id, ref] of chats) {
  const cursor = readCursor(db, id)
  const pending = []
  for await (const msg of client.iterHistory(ref, { limit: 300 })) {
    if (msg.id <= cursor) break
    if (msg.isService) continue
    pending.push(msg)
  }
  for (const msg of pending.reverse()) {
    if (saveItem(db, toItem(msg))) advanceCursor(db, id, msg.id)
  }
  console.log(`${ref}: догнали ${pending.length} сообщений (курсор был ${cursor})`)
}

client.onNewMessage.add((msg) => {
  const id = String(msg.chat?.id ?? '')
  if (!chats.has(id) || msg.isService) return
  const item = toItem(msg)
  if (saveItem(db, item)) {
    advanceCursor(db, id, msg.id)
    console.log(`+ ${item.chat_title ?? id} / ${item.author ?? '?'}: ${item.text.slice(0, 80)}`)
  }
})

console.log('Слушаем поток. Ctrl+C — выход.')
