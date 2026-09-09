// Разбор: список Inbox, карточка с тредом, пометка разобранного.
import { openStore, listInbox, threadAround, markDone } from './store.mjs'

const db = openStore(process.env.INBOX_DB ?? 'inbox.db')
const [cmd, arg] = process.argv.slice(2)
const time = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 16)

if (cmd === 'show') {
  const found = threadAround(db, arg)
  if (!found) { console.error('Заявка не найдена:', arg); process.exit(1) }
  const { item, before, after } = found
  console.log(`Чат:    ${item.chat_title ?? item.chat_id}`)
  console.log(`Автор:  ${item.author ?? '—'}`)
  console.log(`Время:  ${time(item.sent_at)}${item.delayed ? '   [пришло с задержкой]' : ''}`)
  console.log(`Состояние: ${item.state}   Класс: ${item.class ?? '—'}`)
  if (item.has_media) console.log('Вложения: есть')
  if (item.links) console.log(`Ссылки:\n  ${item.links.split('\n').join('\n  ')}`)
  console.log(`\n--- до (${before.length}) ---`)
  for (const m of before) console.log(`  ${time(m.sent_at)} ${m.author ?? '?'}: ${m.text}`)
  console.log(`\n>>> ${item.text}\n`)
  console.log(`--- после (${after.length}) ---`)
  for (const m of after) console.log(`  ${time(m.sent_at)} ${m.author ?? '?'}: ${m.text}`)
} else if (cmd === 'done') {
  console.log(markDone(db, arg) ? `Разобрано: ${arg}` : `Уже разобрано или нет такой заявки: ${arg}`)
} else {
  const rows = listInbox(db)
  console.log(`Inbox: ${rows.length} неразобранных\n`)
  for (const r of rows) {
    const marks = [r.delayed ? 'задержка' : null, r.has_media ? 'вложение' : null].filter(Boolean)
    console.log(`${r.key}`)
    console.log(`  ${time(r.sent_at)}  ${r.chat_title ?? ''} / ${r.author ?? '?'}${marks.length ? '  [' + marks.join(', ') + ']' : ''}`)
    console.log(`  ${(r.text ?? '').replace(/\s+/g, ' ').slice(0, 100)}\n`)
  }
}
