/** Ошибки предметной области несут готовый текст для человека — он и едет в панель. */
export class CommunicationError extends Error {}

export class ItemNotFoundError extends CommunicationError {
  constructor(key: string) {
    super(`заявка не найдена: ${key}`)
  }
}

export class StoreUnavailableError extends CommunicationError {
  constructor(path: string, cause: string) {
    super(`база заявок недоступна (${path}): ${cause}`)
  }
}

export class NotAuthorizedError extends CommunicationError {
  constructor() {
    super('нет сессии Telegram: выполните вход командой `node bin/login.mjs` на этой машине')
  }
}
