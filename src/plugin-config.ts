import Schema from '@deepseek-ai/schemastery'

/**
 * Настройки раздела. Реестр чатов, ключ Telegram и бюджет задержки сюда не входят:
 * ими распоряжается коллектор, а он отдельный процесс и читает `.env`. Два источника
 * одной настройки разъезжаются, поэтому источник один.
 */
export interface PluginConfig {
  workspaceRoot: string
  dbPath: string
}

export const Config: Schema<PluginConfig> = Schema.object({
  workspaceRoot: Schema.string().default('').description('Корень воркспейса. Пусто — раздел поднимется и скажет, чего ему не хватает'),
  dbPath: Schema.string().default('communication/inbox.db').description('База заявок относительно корня воркспейса. Та же, в которую пишет коллектор'),
}) as unknown as Schema<PluginConfig>
