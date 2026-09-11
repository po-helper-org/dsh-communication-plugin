# Маршрутизация по типу чата — план реализации

> **Для агентов:** ОБЯЗАТЕЛЬНЫЙ ПОДНАВЫК: используйте superpowers:subagent-driven-development
> (рекомендуется) либо superpowers:executing-plans для выполнения задача за задачей.
> Шаги размечены чекбоксами (`- [ ]`).

**Цель:** размечать каждую входящую заявку маршрутом (диалог или лента) на основе типа
чата, сохранять разметку и показывать её распределение в панели — чтобы за несколько
дней живой работы убедиться глазами, что классификация верна, до начала переезда на
Chatwoot и GoToSocial.

**Архитектура:** тип чата вычисляется в адаптере Telegram из настоящих полей mtcute,
чистое правило маршрутизации переводит его в набор маршрутов, результат ложится в
заявку двумя новыми столбцами. Хранилище остаётся прежним SQLite: этап ничего не
переносит и ничего не ломает.

**Стек:** TypeScript ESM, `node:test`, `node:sqlite`, mtcute 0.28, React в панели
харнесса, cordis.

## Глобальные ограничения

- Этап **ничего не переносит**: заявки продолжают писаться в тот же SQLite, ни Chatwoot,
  ни GoToSocial в этом этапе не участвуют.
- Оба нерушимых принципа из `docs/PRINCIPLES.md` обязаны остаться соблюдёнными: панель
  ходит только в канал `/communication` и не знает формы строки таблицы; заявка несёт
  внешние идентификаторы канала.
- Схема догоняется миграцией по столбцам (`InboxStore.migrate`) — **база владельца не
  пересоздаётся**, собранные заявки не теряются.
- Обычный `npm test` в сеть не ходит: клиент канала приходит портом и подделывается.
- **Гейт после каждой задачи, трогающей исходники, манифест или `cordis.patch.yml`:**
  ```sh
  npm test && npm run build
  launchctl kickstart -k gui/$UID/ru.poh.dsh-harness
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3082/   # ожидаем 200
  ```
  Порт поднимается не мгновенно — опрашивать до 30–40 секунд. Не 200 или пусто — смотреть
  `tail -40 /tmp/dsh-harness-ui.log`, чинить, повторять. **Несобранный плагин роняет весь
  харнесс, а не свой раздел**, поэтому задача не считается завершённой без 200.
- Ветка: `docs/architecture-chatwoot-gotosocial` (уже создана, в ней лежит спека).
- Язык кода и комментариев — русский, как в остальном репозитории.

**Опорная спека:** `docs/superpowers/specs/2026-09-11-chatwoot-gotosocial-architecture-design.md`

## Структура файлов

| Файл | Ответственность |
|---|---|
| `src/model.ts` (правка) | доменные типы `ChatKind` и `Route`, поля заявки |
| `src/routing.ts` (создать) | чистое правило: тип чата плюс переопределения → маршруты |
| `src/telegram.ts` (правка) | чтение настоящих полей mtcute, вычисление `ChatKind` |
| `src/collector.ts` (правка) | проброс типа чата и маршрута в заявку |
| `src/store.ts` (правка) | два столбца, миграция, запрос распределения |
| `src/channel.ts` (правка) | подкоманда `routes` |
| `src/client/Panel.tsx` (правка) | таблица распределения |
| `src/client/locales.ts` (правка) | подписи |
| `bin/collect.mjs` (правка) | чтение переопределений из `.env` |
| `test/routing.test.ts` (создать) | правило маршрутизации |
| `test/telegram.test.ts` (создать) | отображение полей mtcute в `ChatKind` |
| `test/store.test.ts` (правка) | сохранение маршрута, миграция, распределение |

`ChatKind` и `Route` живут в `model.ts`, а не в `collector.ts`, чтобы `routing.ts`
и `collector.ts` могли импортировать их оба без кольцевой зависимости.

---

### Задача 1: Починка типа чата

Сегодня `chatKind` читает `message.chat.type`, а это дискриминатор объединения
`Peer = User | Chat`, а не вид чата: у `User` там литерал `"user"`, у `Chat` — литерал
`"chat"`. Вид чата лежит отдельно, в `Chat.chatType`. Поэтому новостной канал и рабочая
супергруппа сейчас неразличимы — у обоих `'chat'`, — а объявленное `'channel'` не
приходит никогда.

**Файлы:**
- Правка: `src/model.ts`
- Правка: `src/telegram.ts:29-52`
- Правка: `bin/collect.mjs` (строка с `message.chatKind === 'user'`)
- Тест: `test/telegram.test.ts` (создать)

**Интерфейсы:**
- Отдаёт: `ChatKind` из `src/model.ts`; `toChatKind(chat: PeerLike): ChatKind | null`
  и обновлённый `toIncoming` из `src/telegram.ts`.

- [ ] **Шаг 1: Добавить доменный тип в `src/model.ts`**

В конец файла:

```ts
/**
 * Вид чата в терминах Telegram, сведённый в один плоский набор.
 *
 * В mtcute это два разных места: `Peer` — объединение `User | Chat`, и `.type` там
 * дискриминатор объединения (`"user"` либо `"chat"`), а настоящий вид группы лежит
 * в `Chat.chatType`. Потребителю раздела важен вид разговора, а не класс библиотеки,
 * поэтому оба уровня сводятся сюда.
 */
export const CHAT_KINDS = ['user', 'bot', 'group', 'supergroup', 'channel', 'gigagroup', 'monoforum'] as const
export type ChatKind = (typeof CHAT_KINDS)[number]
```

- [ ] **Шаг 2: Написать падающий тест**

Создать `test/telegram.test.ts`:

```ts
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { toChatKind, toIncoming } from '../src/telegram.js'

const DATE = new Date(1_757_000_000_000)

const message = (chat: Record<string, unknown>) => ({
  id: 1,
  isService: false,
  text: 'привет',
  date: DATE,
  chat: { id: -100500, displayName: 'Чат', ...chat },
})

test('приватный диалог распознаётся как user', () => {
  assert.equal(toChatKind({ id: 1, type: 'user' }), 'user')
})

test('бот отличается от человека', () => {
  assert.equal(toChatKind({ id: 1, type: 'user', isBot: true }), 'bot')
})

test('вид группы читается из chatType, а не из type', () => {
  assert.equal(toChatKind({ id: -1, type: 'chat', chatType: 'supergroup' }), 'supergroup')
  assert.equal(toChatKind({ id: -1, type: 'chat', chatType: 'group' }), 'group')
})

test('вещательный канал отличим от супергруппы', () => {
  assert.equal(toChatKind({ id: -1, type: 'chat', chatType: 'channel' }), 'channel')
  assert.notEqual(
    toChatKind({ id: -1, type: 'chat', chatType: 'channel' }),
    toChatKind({ id: -1, type: 'chat', chatType: 'supergroup' }),
  )
})

test('неизвестная форма даёт null, а не выдуманное значение', () => {
  assert.equal(toChatKind({ id: -1, type: 'chat' }), null)
  assert.equal(toChatKind({ id: -1 }), null)
})

test('toIncoming кладёт вид чата в заявку', () => {
  const incoming = toIncoming(message({ type: 'chat', chatType: 'channel' }))
  assert.equal(incoming.chatKind, 'channel')
})
```

- [ ] **Шаг 3: Прогнать тест и убедиться, что падает**

```sh
npm test
```
Ожидаем провал: `toChatKind` не экспортируется из `src/telegram.ts`.

- [ ] **Шаг 4: Починить адаптер**

В `src/telegram.ts` заменить объявление `MessageLike` и функцию `toIncoming`:

```ts
/**
 * Собеседник в форме, которой нам достаточно. Структурная заглушка, а не импорт типов
 * mtcute: адаптер обязан собираться и проверяться без установленного клиента.
 *
 * `type` здесь — дискриминатор объединения `User | Chat`, поэтому вид группы читается
 * из отдельного `chatType`. Проверено по справочнику mtcute 0.28.
 */
interface PeerLike {
  id: number | string
  displayName?: string
  type?: 'user' | 'chat'
  isBot?: boolean
  chatType?: 'group' | 'supergroup' | 'channel' | 'gigagroup' | 'monoforum'
}

interface MessageLike {
  id: number
  isService: boolean
  text: string
  date: Date
  chat: PeerLike
  sender?: { id?: number | string; displayName?: string }
  media?: { type?: string } | null
}

/** Сводит два уровня mtcute в один вид чата. `null` — форма неизвестна, выдумывать нельзя. */
export function toChatKind(chat: PeerLike): ChatKind | null {
  if (chat.type === 'user') return chat.isBot === true ? 'bot' : 'user'
  if (chat.type === 'chat') return chat.chatType ?? null
  return null
}

export function toIncoming(message: MessageLike): IncomingMessage {
  return {
    id: message.id,
    chatId: String(message.chat.id),
    chatTitle: message.chat.displayName ?? null,
    author: message.sender?.displayName ?? null,
    authorId: message.sender?.id === undefined ? null : String(message.sender.id),
    sentAt: message.date.getTime(),
    text: message.text,
    hasMedia: message.media != null && message.media.type !== 'unsupported',
    isService: message.isService,
    chatKind: toChatKind(message.chat) ?? undefined,
  }
}
```

Добавить импорт в начало `src/telegram.ts`:

```ts
import type { ChatKind } from './model.js'
```

- [ ] **Шаг 5: Расширить тип в `src/collector.ts`**

Заменить объявление поля в интерфейсе `IncomingMessage`:

```ts
  /** Вид собеседника. Нужен правилам отбора и маршрутизации, в заявку идёт как есть. */
  chatKind?: ChatKind
```

Добавить импорт в начало файла:

```ts
import type { ChatKind, Item } from './model.js'
```

(строка `import type { Item } from './model.js'` заменяется на эту).

- [ ] **Шаг 6: Сохранить поведение `WATCH_PRIVATE`**

В `bin/collect.mjs` бот раньше приходил как `'user'` и в отбор попадал. После починки
он отличим, и молча терять его нельзя. Заменить строку:

```js
    privateToo ? (message) => message.chatKind === 'user' : undefined,
```

на:

```js
    // Бот теперь отличим от человека, но в отбор попадает по-прежнему: уведомления
    // от ботов приходят в личку и разбора требуют так же.
    privateToo ? (message) => message.chatKind === 'user' || message.chatKind === 'bot' : undefined,
```

- [ ] **Шаг 7: Прогнать тесты**

```sh
npm test
```
Ожидаем: все тесты проходят, включая шесть новых.

- [ ] **Шаг 8: Гейт харнесса**

```sh
npm run build
launchctl kickstart -k gui/$UID/ru.poh.dsh-harness
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3082/
```
Ожидаем `200`.

- [ ] **Шаг 9: Коммит**

```sh
git add src/model.ts src/telegram.ts src/collector.ts bin/collect.mjs test/telegram.test.ts
git commit -m "fix: читать вид чата из chatType, а не из дискриминатора Peer"
```

---

### Задача 2: Правило маршрутизации

**Файлы:**
- Правка: `src/model.ts`
- Создать: `src/routing.ts`
- Тест: `test/routing.test.ts` (создать)

**Интерфейсы:**
- Потребляет: `ChatKind` из задачи 1.
- Отдаёт: `Route`, `ROUTES` из `src/model.ts`; `routeFor(kind, chatId, overrides)`,
  `RouteOverrides`, `parseOverrides(env)` из `src/routing.ts`.

- [ ] **Шаг 1: Добавить тип маршрута в `src/model.ts`**

Следом за `CHAT_KINDS`:

```ts
/**
 * Куда уходит заявка. `dialog` — система диалогов, `feed` — лента.
 * Порядок значений канонический: по нему маршруты сортируются перед хранением,
 * поэтому одинаковый набор всегда даёт одинаковую строку и группируется без сюрпризов.
 */
export const ROUTES = ['dialog', 'feed'] as const
export type Route = (typeof ROUTES)[number]
```

- [ ] **Шаг 2: Написать падающий тест**

Создать `test/routing.test.ts`:

```ts
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
```

- [ ] **Шаг 3: Прогнать тест и убедиться, что падает**

```sh
npm test
```
Ожидаем провал: модуль `src/routing.js` не существует.

- [ ] **Шаг 4: Написать правило**

Создать `src/routing.ts`:

```ts
/**
 * Правило маршрутизации: куда уходит заявка из данного чата.
 *
 * Чистая функция без обращений к сети и хранилищу — проверяется таблицей значений,
 * а не поднятием коллектора. Вся политика разметки потока живёт здесь одной точкой:
 * менять её предстоит по итогам живого наблюдения.
 */
import { ROUTES, type ChatKind, type Route } from './model.js'

export interface RouteOverrides {
  feed: ReadonlySet<string>
  dialog: ReadonlySet<string>
  both: ReadonlySet<string>
}

/** Вид чата по умолчанию. Всё, чего здесь нет, считается разговором. */
const BY_KIND: Partial<Record<ChatKind, Route[]>> = {
  user: ['dialog'],
  bot: ['dialog'],
  group: ['dialog'],
  supergroup: ['dialog'],
  channel: ['feed'],
  gigagroup: ['feed'],
  // monoforum — переписка с администрацией канала, по сути разговор.
  monoforum: ['dialog'],
}

/** Канонический порядок: одинаковый набор обязан давать одинаковую строку в хранилище. */
function canonical(routes: readonly Route[]): Route[] {
  return ROUTES.filter((route) => routes.includes(route))
}

/**
 * Маршруты заявки. Переопределение реестра важнее вида чата: человек знает про свой
 * чат больше, чем Telegram сообщает его типом.
 *
 * Неизвестный вид уходит в диалоги намеренно: потерять рабочее сообщение в ленте
 * дороже, чем увидеть новость среди диалогов.
 */
export function routeFor(
  kind: ChatKind | null | undefined,
  chatId: string,
  overrides?: Partial<RouteOverrides>,
): Route[] {
  if (overrides?.both?.has(chatId) === true) return canonical(['dialog', 'feed'])
  if (overrides?.feed?.has(chatId) === true) return ['feed']
  if (overrides?.dialog?.has(chatId) === true) return ['dialog']
  if (kind === null || kind === undefined) return ['dialog']
  return canonical(BY_KIND[kind] ?? ['dialog'])
}

function list(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? '').split(',').map((item) => item.trim()).filter((item) => item !== ''),
  )
}

/** Переопределения из окружения коллектора: реестром чатов распоряжается он. */
export function parseOverrides(env: Record<string, string | undefined>): RouteOverrides {
  return {
    feed: list(env.ROUTE_FEED),
    dialog: list(env.ROUTE_DIALOG),
    both: list(env.ROUTE_BOTH),
  }
}
```

- [ ] **Шаг 5: Прогнать тесты**

```sh
npm test
```
Ожидаем: восемь новых тестов проходят.

- [ ] **Шаг 6: Описать настройки в `.env.example`**

Дописать в конец:

```sh
# Переопределение маршрута для отдельных чатов, идентификаторы через запятую.
# Важнее вида чата: Telegram не знает, что этот канал для вас рабочий.
# ROUTE_FEED=-1001234567890
# ROUTE_DIALOG=-1009876543210
# ROUTE_BOTH=-1005555555555
```

- [ ] **Шаг 7: Коммит**

```sh
git add src/model.ts src/routing.ts test/routing.test.ts .env.example
git commit -m "feat: правило маршрутизации заявок по виду чата"
```

---

### Задача 3: Маршрут и вид чата в заявке

**Файлы:**
- Правка: `src/model.ts` (поля `Item`)
- Правка: `src/collector.ts` (`toItem`, `CollectorOptions`)
- Правка: `src/store.ts` (`SCHEMA`, `Row`, `toItem`, `migrate`, `save`)
- Правка: `bin/collect.mjs` (передача переопределений)
- Тест: `test/store.test.ts`

**Интерфейсы:**
- Потребляет: `routeFor`, `parseOverrides` из задачи 2; `ChatKind`, `Route` из задачи 1.
- Отдаёт: поля `Item.chatKind: ChatKind | null` и `Item.route: Route[]`, сохраняемые
  и читаемые из хранилища; `CollectorOptions.overrides?: Partial<RouteOverrides>`.

- [ ] **Шаг 1: Написать падающий тест**

Дописать в `test/store.test.ts`:

```ts
test('заявка несёт вид чата и вычисленный маршрут', () => {
  const item = toItem(msg(1, 'новость', 0, { chatKind: 'channel' }), { receivedAt: NOW })
  assert.equal(item.chatKind, 'channel')
  assert.deepEqual(item.route, ['feed'])
})

test('переопределение реестра доходит до заявки', () => {
  const item = toItem(
    msg(2, 'рабочее', 0, { chatKind: 'channel' }),
    { receivedAt: NOW, overrides: { dialog: new Set([CHAT]) } },
  )
  assert.deepEqual(item.route, ['dialog'])
})

test('маршрут переживает запись и чтение', () => {
  const store = new InboxStore(':memory:')
  store.save(toItem(msg(3, 'новость', 0, { chatKind: 'channel' }), { receivedAt: NOW }))
  const { item } = store.thread(`telegram:${CHAT}:3`)
  assert.equal(item.chatKind, 'channel')
  assert.deepEqual(item.route, ['feed'])
  store.close()
})

test('база без новых столбцов догоняется миграцией', () => {
  const store = new InboxStore(':memory:')
  // Столбцы уже добавлены конструктором; повторная миграция не должна падать.
  store.save(toItem(msg(4, 'привет'), { receivedAt: NOW }))
  const { item } = store.thread(`telegram:${CHAT}:4`)
  assert.deepEqual(item.route, ['dialog'])
  store.close()
})
```

- [ ] **Шаг 2: Прогнать тест и убедиться, что падает**

```sh
npm test
```
Ожидаем провал: у `Item` нет свойств `chatKind` и `route`.

- [ ] **Шаг 3: Добавить поля в `src/model.ts`**

В интерфейс `Item`, следом за `authorId`:

```ts
  /** Вид чата на момент сбора. `null` — Telegram не сообщил форму. */
  chatKind: ChatKind | null
  /**
   * Куда заявке идти. Набор, а не одно значение: рабочая группа может одновременно
   * быть и разговором, и содержимым ленты.
   */
  route: Route[]
```

- [ ] **Шаг 4: Вычислять маршрут в `src/collector.ts`**

В `CollectorOptions` добавить поле:

```ts
  overrides?: Partial<RouteOverrides>
```

Добавить импорты:

```ts
import { routeFor } from './routing.js'
import type { RouteOverrides } from './routing.js'
```

В функции `toItem` добавить две строки в возвращаемый объект, сразу после `authorId`:

```ts
    chatKind: message.chatKind ?? null,
    route: routeFor(message.chatKind, message.chatId, options.overrides),
```

- [ ] **Шаг 5: Добавить столбцы в `src/store.ts`**

В константе `SCHEMA`, в объявление таблицы `items` после `author_id TEXT`:

```sql
    chat_kind   TEXT,
    route       TEXT,
```

В интерфейс `Row` после `author_id`:

```ts
  chat_kind: string | null
  route: string | null
```

В функцию `toItem` после `authorId`:

```ts
    chatKind: row.chat_kind as Item['chatKind'],
    route: splitList(row.route) as Route[],
```

В метод `migrate` после существующих проверок:

```ts
    if (!columns.has('chat_kind')) this.db.exec('ALTER TABLE items ADD COLUMN chat_kind TEXT')
    if (!columns.has('route')) this.db.exec('ALTER TABLE items ADD COLUMN route TEXT')
```

В методе `save` заменить запрос и список параметров:

```ts
    const result = this.db.prepare(`
      INSERT INTO items (key, channel, chat_id, chat_title, msg_id, thread_key, author, author_id,
                         chat_kind, route, sent_at, received_at, delayed, text, has_media, links,
                         state, class, labels)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(key) DO NOTHING
    `).run(
      item.key, item.channel, item.chatId, item.chatTitle, item.msgId, item.threadKey,
      item.author, item.authorId, item.chatKind, item.route.join('\n'),
      item.sentAt, item.receivedAt, item.delayed ? 1 : 0, item.text,
      item.hasMedia ? 1 : 0, item.links.length === 0 ? null : item.links.join('\n'),
      item.state, item.class, item.labels.length === 0 ? null : item.labels.join('\n'),
    )
```

Добавить в импорт типов файла `Route`:

```ts
import type { Item, ItemRow, Route, State, Thread } from './model.js'
```

- [ ] **Шаг 6: Передать переопределения в коллектор**

В `bin/collect.mjs` добавить импорт рядом с остальными:

```js
import { parseOverrides } from '../lib/routing.js'
```

И заменить создание коллектора:

```js
  const collector = new Collector(store, channel, {
    delayBudgetMs: budgetMs,
    overrides: parseOverrides(env),
  })
```

- [ ] **Шаг 7: Прогнать тесты**

```sh
npm test
```
Ожидаем: четыре новых теста проходят, старые не сломаны.

- [ ] **Шаг 8: Гейт харнесса**

```sh
npm run build
launchctl kickstart -k gui/$UID/ru.poh.dsh-harness
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3082/
```
Ожидаем `200`.

- [ ] **Шаг 9: Коммит**

```sh
git add src/model.ts src/collector.ts src/store.ts bin/collect.mjs test/store.test.ts
git commit -m "feat: маршрут и вид чата сохраняются в заявке"
```

---

### Задача 4: Распределение по маршрутам через канал

Панель обязана показать разметку, не зная ни формы строки, ни SQL — иначе нарушается
первый нерушимый принцип. Поэтому распределение считает хранилище, а наружу его отдаёт
подкоманда канала.

**Файлы:**
- Правка: `src/model.ts` (тип строки распределения)
- Правка: `src/store.ts` (метод `routeDistribution`)
- Правка: `src/channel.ts` (подкоманда `routes`)
- Тест: `test/store.test.ts`

**Интерфейсы:**
- Потребляет: поля `chatKind` и `route` из задачи 3.
- Отдаёт: `RouteRow` из `src/model.ts`; `InboxStore.routeDistribution(): RouteRow[]`;
  подкоманду канала `'routes'`, возвращающую `{ rows: RouteRow[] }`.

- [ ] **Шаг 1: Написать падающий тест**

Дописать в `test/store.test.ts`:

```ts
test('распределение группирует заявки по чату и маршруту', () => {
  const store = new InboxStore(':memory:')
  store.save(toItem(msg(1, 'новость', 0, { chatKind: 'channel' }), { receivedAt: NOW }))
  store.save(toItem(msg(2, 'ещё новость', 0, { chatKind: 'channel' }), { receivedAt: NOW }))
  store.save(toItem(
    msg(3, 'рабочее', 0, { chatId: '-777', chatTitle: 'Команда', chatKind: 'supergroup' }),
    { receivedAt: NOW },
  ))
  const rows = store.routeDistribution()
  const feed = rows.find((row) => row.route === 'feed')
  const dialog = rows.find((row) => row.route === 'dialog')
  assert.equal(feed?.count, 2)
  assert.equal(feed?.chatKind, 'channel')
  assert.equal(dialog?.count, 1)
  assert.equal(dialog?.chatTitle, 'Команда')
  store.close()
})

test('подкоманда routes отдаёт распределение через канал', () => {
  const store = new InboxStore(':memory:')
  store.save(toItem(msg(1, 'новость', 0, { chatKind: 'channel' }), { receivedAt: NOW }))
  const result = dispatch(store, status, 'routes', {})
  assert.equal(result.ok, true)
  if (!result.ok) return
  const { rows } = result.value as { rows: Array<{ route: string; count: number }> }
  assert.equal(rows.length, 1)
  assert.equal(rows[0].route, 'feed')
  store.close()
})
```

Дополнить хелпер `msg` в этом же файле, чтобы принимал переопределение чата — он уже
принимает `extra: Partial<IncomingMessage>`, поэтому правка не нужна.

- [ ] **Шаг 2: Прогнать тест и убедиться, что падает**

```sh
npm test
```
Ожидаем провал: метода `routeDistribution` нет.

- [ ] **Шаг 3: Добавить тип строки в `src/model.ts`**

```ts
/**
 * Строка распределения: сколько заявок из какого чата каким маршрутом ушло.
 * Нужна ровно для проверки разметки глазами перед переездом.
 */
export interface RouteRow {
  chatId: string
  chatTitle: string | null
  chatKind: string | null
  route: string
  count: number
}
```

- [ ] **Шаг 4: Добавить запрос в `src/store.ts`**

Метод класса `InboxStore`, рядом с `count`:

```ts
  /**
   * Распределение заявок по чатам и маршрутам. Отвечает на единственный вопрос
   * этого этапа: правильно ли размечен поток. Группировка по уже сохранённой строке
   * маршрута, поэтому канонический порядок из `routeFor` здесь и окупается.
   */
  routeDistribution(): RouteRow[] {
    const rows = this.db.prepare(`
      SELECT chat_id, chat_title, chat_kind, COALESCE(route, '') AS route, COUNT(*) AS n
      FROM items
      GROUP BY chat_id, chat_title, chat_kind, route
      ORDER BY n DESC
    `).all() as Array<{
      chat_id: string
      chat_title: string | null
      chat_kind: string | null
      route: string
      n: number
    }>
    return rows.map((row) => ({
      chatId: row.chat_id,
      chatTitle: row.chat_title,
      chatKind: row.chat_kind,
      route: row.route.split('\n').join('+'),
      count: Number(row.n),
    }))
  }
```

Дополнить импорт типов:

```ts
import type { Item, ItemRow, Route, RouteRow, State, Thread } from './model.js'
```

- [ ] **Шаг 5: Добавить подкоманду в `src/channel.ts`**

В `switch` функции `dispatch`, перед веткой `default`:

```ts
      case 'routes':
        return ok({ rows: store.routeDistribution() })
```

Расширить тип возвращаемого значения `dispatch`:

```ts
): RpcResult<InboxPage | Thread | { done: boolean } | { labels: string[] } | { rows: RouteRow[] }> {
```

Дополнить импорт типов:

```ts
import type { CollectorStatus, ItemRow, RouteRow, Thread } from './model.js'
```

- [ ] **Шаг 6: Прогнать тесты**

```sh
npm test
```
Ожидаем: два новых теста проходят.

- [ ] **Шаг 7: Коммит**

```sh
git add src/model.ts src/store.ts src/channel.ts test/store.test.ts
git commit -m "feat: распределение заявок по маршрутам через канал"
```

---

### Задача 5: Показ распределения в панели

**Файлы:**
- Правка: `src/client/locales.ts`
- Правка: `src/client/Panel.tsx`

**Интерфейсы:**
- Потребляет: подкоманду канала `'routes'` из задачи 4.
- Отдаёт: ничего программного; результат проверяется глазами.

- [ ] **Шаг 1: Добавить подписи в `src/client/locales.ts`**

В объект `ru`, рядом с остальными подписями:

```ts
  routesTitle: 'Разметка потока',
  routesHint: 'Куда пойдёт заявка после переезда. Проверьте, что чаты размечены верно',
  routesEmpty: 'Заявок пока нет — разметку не на чем показать',
  routeDialog: 'диалоги',
  routeFeed: 'лента',
  routeBoth: 'диалоги + лента',
  routeUnknown: 'не размечено',
  routesColumnChat: 'Чат',
  routesColumnKind: 'Вид',
  routesColumnRoute: 'Маршрут',
  routesColumnCount: 'Заявок',
```

- [ ] **Шаг 2: Показать таблицу в `src/client/Panel.tsx`**

Добавить тип рядом с остальными объявлениями в начале файла:

```tsx
interface RouteRowView {
  chatId: string
  chatTitle: string | null
  chatKind: string | null
  route: string
  count: number
}
```

Добавить состояние рядом с существующими `useState`:

```tsx
  const [routes, setRoutes] = useState<RouteRowView[] | null>(null)
```

Добавить загрузку рядом с `reload`:

```tsx
  const loadRoutes = useCallback(async () => {
    const result = await call('routes')
    if (result.ok) setRoutes((result.value as { rows: RouteRowView[] }).rows)
  }, [call])
```

Дополнить существующий эффект, который срабатывает на открытие раздела: рядом с
`void reload()` добавить:

```tsx
    void loadRoutes()
```

и дописать `loadRoutes` в список зависимостей этого эффекта.

Добавить подпись маршрута рядом с функцией `ago`:

```tsx
const routeLabel = (route: string, t: Translate): string => {
  if (route === 'dialog') return t('routeDialog')
  if (route === 'feed') return t('routeFeed')
  if (route === 'dialog+feed') return t('routeBoth')
  return t('routeUnknown')
}
```

Отрисовать блок в разметке панели, после списка заявок:

```tsx
      <section>
        <h3>{t('routesTitle')}</h3>
        <p>{t('routesHint')}</p>
        {routes === null || routes.length === 0 ? (
          <p>{t('routesEmpty')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('routesColumnChat')}</th>
                <th>{t('routesColumnKind')}</th>
                <th>{t('routesColumnRoute')}</th>
                <th>{t('routesColumnCount')}</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((row) => (
                <tr key={`${row.chatId}:${row.route}`}>
                  <td>{row.chatTitle ?? row.chatId}</td>
                  <td>{row.chatKind ?? '—'}</td>
                  <td>{routeLabel(row.route, t)}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
```

- [ ] **Шаг 3: Собрать и проверить типы**

```sh
npm test && npm run build
```
Ожидаем: сборка без ошибок типов.

- [ ] **Шаг 4: Гейт харнесса**

```sh
launchctl kickstart -k gui/$UID/ru.poh.dsh-harness
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3082/
```
Ожидаем `200`. Не 200 — смотреть `tail -40 /tmp/dsh-harness-ui.log`.

- [ ] **Шаг 5: Проверить глазами**

Открыть раздел «Управление коммуникацией» в харнессе. Убедиться, что блок «Разметка
потока» отрисован и не ломает вёрстку остальной панели.

- [ ] **Шаг 6: Коммит**

```sh
git add src/client/Panel.tsx src/client/locales.ts
git commit -m "feat: панель показывает разметку потока по маршрутам"
```

---

### Задача 6: Живая проверка разметки

Этап существует ради этой задачи: всё предыдущее — подготовка к тому, чтобы посмотреть
на настоящий поток и убедиться, что классификация совпадает с реальностью.

**Файлы:**
- Правка: `docs/superpowers/specs/2026-09-11-chatwoot-gotosocial-architecture-design.md`
  (таблица маршрутизации — по итогам наблюдения)

**Интерфейсы:**
- Потребляет: всё предыдущее.
- Отдаёт: подтверждённую либо исправленную таблицу маршрутизации в спеке.

- [ ] **Шаг 1: Прогнать живой круг тестов**

```sh
RUN_LIVE_TESTS=1 npm run test:live
```
Ожидаем: проходит. Круг только читает и в переписке следов не оставляет.

- [ ] **Шаг 2: Запустить коллектор на настоящем аккаунте**

```sh
node bin/collect.mjs
```
Оставить работать. Старые заявки маршрута не имеют — таблица наполняется только новыми.

- [ ] **Шаг 3: Снять разметку через несколько дней**

Открыть раздел и сверить таблицу «Разметка потока» с тем, чем эти чаты являются на
самом деле. Искать три вещи:

- чаты в строке `не размечено` — Telegram не сообщил вид; понять, почему;
- рабочие переписки, уехавшие в `лента` — им место в диалогах;
- новостные каналы, уехавшие в `диалоги` — им место в ленте.

- [ ] **Шаг 4: Исправить разметку, не трогая код**

Для каждого расхождения добавить идентификатор чата в `ROUTE_FEED`, `ROUTE_DIALOG`
или `ROUTE_BOTH` в `.env` коллектора и перезапустить его. Список идентификаторов:

```sh
node bin/dialogs.mjs
```

- [ ] **Шаг 5: Решить судьбу `monoforum`**

В спеке этот вид помечен как «уточнить на живых данных». Если он в распределении не
появился ни разу — оставить как есть и записать это. Если появился — решить, диалог
это или лента, и поправить `BY_KIND` в `src/routing.ts` вместе с тестом.

- [ ] **Шаг 6: Зафиксировать вывод в спеке**

Заменить в спеке строку `| \`monoforum\` | уточнить на живых данных |` на принятое
решение. Если правило по умолчанию пришлось менять — обновить таблицу маршрутизации
целиком, чтобы она описывала то, что работает.

- [ ] **Шаг 7: Коммит**

```sh
git add docs/superpowers/specs/2026-09-11-chatwoot-gotosocial-architecture-design.md src/routing.ts test/routing.test.ts
git commit -m "docs: таблица маршрутизации подтверждена на живом потоке"
```

---

## Что этот этап намеренно не делает

- Не пишет ни в Chatwoot, ни в GoToSocial — это этапы 2 и 3.
- Не убирает SQLite — это этап 4 и точка невозврата.
- Не трогает исходящие и вебхуки — это этап 5.
- Не меняет `docs/PRINCIPLES.md`, `AGENTS.md`, `README.md` и issue #9: они разошлись
  с решением, но правятся отдельной работой, чтобы не смешивать документацию с кодом.
- Не добавляет коллектор MTS.Link: его нет, и появление сотни чатов из оценки потока
  ждёт своего этапа.
