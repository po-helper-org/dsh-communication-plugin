/**
 * Настройки ленты: подключение и метки. Одно пространство настроек харнесса
 * (`communication-feed`), одна карточка в «Настройки → Плагины».
 *
 * Метки живут здесь как источник истины, а в файл `labels.json` рядом с базой
 * заявок узел их ЗЕРКАЛИТ при каждой записи: файл читают мост ленты, перенос из
 * Telegram и перемаркировка (все на Python, все вне харнесса). Одна настройка —
 * один владелец; файл — производная, а не вторая копия.
 *
 * Токен человека хранится обычной строкой, не `role('secret')`: он всё равно
 * уезжает в браузер — фрейм входит им в клиент ленты (см. `seed.html`), и прятать
 * его от той же вкладки бессмысленно. Документ настроек харнесса локальный.
 */
import Schema from '@deepseek-ai/schemastery'

export const FEED_NAMESPACE = 'communication-feed'

/** Виды правил — те же, что понимает движок меток `bridge/labels.py`. */
export const RULE_KINDS = ['account', 'tag', 'contains', 'regex', 'prompt'] as const
export type RuleKind = (typeof RULE_KINDS)[number]

/** Правило — объект ровно с одним ключом-видом. Так же читает его Python. */
export type LabelRule = Partial<Record<RuleKind, string>>

export interface LabelSpec {
  id: string
  title: string
  rules: LabelRule[]
}

export interface FeedSettings {
  /** Клиент ленты для фрейма. Только 127.0.0.1: иначе фрейм не увидит вход. */
  clientUrl: string
  /** Инстанс, к которому подключён клиент, — так его знает браузер. */
  instanceUrl: string
  /** Адрес того же инстанса для узла, если браузерный ему недоступен (самоподписанный сертификат). Пусто — тот же, что instanceUrl. */
  hostApiUrl: string
  /** Токен человека. Выдаёт scripts/get_tokens.sh. */
  token: string
  labels: LabelSpec[]
}

export const FeedSettingsSchema: Schema<FeedSettings> = Schema.object({
  clientUrl: Schema.string().default('http://127.0.0.1:8083'),
  instanceUrl: Schema.string().default('https://feed.localtest.me'),
  hostApiUrl: Schema.string().default(''),
  token: Schema.string().default(''),
  labels: Schema.array(Schema.object({
    id: Schema.string().default(''),
    title: Schema.string().default(''),
    rules: Schema.array(Schema.dict(Schema.string())).default([]),
  })).default([]),
}) as unknown as Schema<FeedSettings>

/** Хэштег на сервере ленты: буквы любого алфавита, цифры, подчёркивание; не только цифры. */
export function isHashtag(value: string): boolean {
  return /^[\p{L}\p{N}_]+$/u.test(value) && !/^\d+$/.test(value)
}

/** Идентификатор из названия — так же, как это делает прототип. */
export function slugOf(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_]/gu, '')
}

/**
 * Проверка меток — та же, что у движка на Python, и по той же причине: сломанное
 * правило обязано ломаться при СОХРАНЕНИИ, а не оставлять посты без метки молча
 * на первой публикации. Бросает с текстом, который годится показать человеку.
 */
export function validateLabels(labels: LabelSpec[]): void {
  const seen = new Set<string>()
  for (const label of labels) {
    const id = label.id.trim().toLowerCase()
    if (!isHashtag(id)) throw new Error(`метка «${label.title || id}»: id обязан быть годным хэштегом — буквы, цифры, подчёркивание, не только цифры`)
    if (seen.has(id)) throw new Error(`метка «${id}» объявлена дважды`)
    seen.add(id)
    for (const rule of label.rules) {
      const kinds = RULE_KINDS.filter((k) => k in rule)
      if (kinds.length !== 1) throw new Error(`метка «${id}»: правило должно иметь ровно один вид, а имеет ${kinds.length}`)
      const value = rule[kinds[0]]
      if (typeof value !== 'string' || value.trim() === '') throw new Error(`метка «${id}»: пустое значение правила «${kinds[0]}»`)
      if (kinds[0] === 'regex') {
        try { new RegExp(value, 'i') } catch (error) {
          throw new Error(`метка «${id}»: регулярное выражение не разбирается: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
  }
}

/** Форма файла labels.json, которую читает Python: только метки, ничего лишнего. */
export function labelsFileBody(labels: LabelSpec[]): string {
  const body = {
    labels: labels.map((l) => ({
      id: l.id.trim().toLowerCase(),
      title: l.title,
      rules: l.rules.map((r) => {
        const kind = RULE_KINDS.find((k) => k in r) ?? 'contains'
        return { [kind]: (r[kind] ?? '').trim() }
      }),
    })),
  }
  return `${JSON.stringify(body, null, 2)}\n`
}
