import Schema from '@deepseek-ai/schemastery'

export interface PluginConfig {
  workspaceRoot: string
  dbPath: string
  watchedChats: string[]
  delayBudgetSec: number
  envFile: string
}

export const Config: Schema<PluginConfig> = Schema.object({
  workspaceRoot: Schema.string().default('').description('Корень воркспейса. Пусто — раздел поднимется и скажет, чего ему не хватает'),
  dbPath: Schema.string().default('communication/inbox.db').description('База заявок относительно корня воркспейса'),
  watchedChats: Schema.array(Schema.string()).default([]).description('Отслеживаемые чаты: username, ссылка или идентификатор'),
  delayBudgetSec: Schema.natural().default(300).description('Бюджет задержки в секундах'),
  envFile: Schema.string().default('').description('Файл с ключом Telegram. Пусто — .env в каталоге пакета'),
}) as unknown as Schema<PluginConfig>
