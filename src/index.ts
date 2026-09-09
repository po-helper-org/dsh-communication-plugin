export * from './model.js'
export { CommunicationError, ItemNotFoundError, NotAuthorizedError, StoreUnavailableError } from './errors.js'
export { InboxStore } from './store.js'
export {
  Collector,
  extractLinks,
  toItem,
  type ChannelPort,
  type CollectorOptions,
  type IncomingMessage,
} from './collector.js'
export { COMMUNICATION_CHANNEL, dispatch, type InboxPage, type RpcResult } from './channel.js'
export { HEARTBEAT_STALE_MS, readStatus } from './status.js'
export { Config, type PluginConfig } from './plugin-config.js'

// `telegram.js` намеренно не реэкспортируется: он тянет клиента с нативным модулем,
// а этот модуль грузит харнесс. Коллектор импортирует его напрямую (`lib/telegram.js`).
export { formatSummary, percentile, summarize, type LatencySummary } from './latency.js'
export { mergeEnv, parseEnvFile, readEnvFile } from './env-file.js'

// Харнесс грузит плагин по имени пакета, то есть через эту точку входа:
// без `apply` и `name` композиция его просто не найдёт.
export { name, apply, resolveDbPath } from './plugin.js'
