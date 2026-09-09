// Вход в аккаунт Telegram: выполняется один раз владельцем машины.
// Код подтверждения приходит в приложение Telegram, поэтому шаг интерактивный и живёт
// отдельно от раздела: харнесс поднимает плагин без терминала и спросить код не может.
import { TelegramClient } from '@mtcute/node'

const apiId = Number(process.env.TG_API_ID)
const apiHash = process.env.TG_API_HASH
if (!Number.isFinite(apiId) || apiId <= 0 || !apiHash) {
  console.error('Нужны TG_API_ID и TG_API_HASH — получить на https://my.telegram.org')
  process.exit(1)
}

const client = new TelegramClient({ apiId, apiHash, storage: process.env.TG_SESSION ?? 'tg.session' })
const me = await client.start()
console.log(`Вошли как ${me.displayName}. Сессия сохранена, раздел поднимется на ней сам.`)
await client.close()
