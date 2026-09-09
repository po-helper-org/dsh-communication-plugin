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
export { TelegramChannel, telegramOptionsFromEnv, toIncoming, type TelegramOptions } from './telegram.js'
export { Config, type PluginConfig } from './plugin-config.js'

// Харнесс грузит плагин по имени пакета, то есть через эту точку входа:
// без `apply` и `name` композиция его просто не найдёт.
export { name, apply } from './plugin.js'
