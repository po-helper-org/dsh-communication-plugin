import Schema from '@deepseek-ai/schemastery'

/**
 * Настройки раздела. Реестр чатов, ключ Telegram и бюджет задержки сюда не входят:
 * ими распоряжается коллектор, а он отдельный процесс и читает `.env`. Два источника
 * одной настройки разъезжаются, поэтому источник один.
 */
export interface PluginConfig {
  workspaceRoot: string
  dbPath: string
  /** Зеркало меток для писателей ленты на Python — рядом с базой заявок. */
  labelsPath: string
  /** Команда перемаркировки; узел дописывает `--apply`. Пусто — кнопка погашена. */
  relabelCommand: string
  /** Каталог для команды перемаркировки. Пусто — корень воркспейса. */
  relabelCwd: string
}

export const Config: Schema<PluginConfig> = Schema.object({
  workspaceRoot: Schema.string().default('').description('Корень воркспейса. Пусто — раздел поднимется и скажет, чего ему не хватает'),
  dbPath: Schema.string().default('communication/inbox.db').description('База заявок относительно корня воркспейса. Та же, в которую пишет коллектор'),
  labelsPath: Schema.string().default('communication/labels.json').description('Зеркало меток ленты относительно корня воркспейса. Его читают мост, перенос из Telegram и перемаркировка'),
  relabelCommand: Schema.string().default('').description('Команда перемаркировки ленты (scripts/relabel.py из poh-feed-poc с окружением). Пусто — «Применить к ленте» погашена'),
  relabelCwd: Schema.string().default('').description('Каталог запуска команды перемаркировки. Пусто — корень воркспейса'),
}) as unknown as Schema<PluginConfig>
