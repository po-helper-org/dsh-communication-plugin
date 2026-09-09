/**
 * Словарь раздела. Рабочий язык этого развёртывания — русский, поэтому оба обязательных
 * слота харнесса получают один и тот же словарь.
 */
export const ru = {
  nav: 'Управление коммуникацией',
  panelTitle: 'Входящие',
  empty: 'Inbox пуст',
  notConfigured: 'Реестр отслеживаемых чатов пуст — раздел нечего собирать',
  notAuthorized: 'Нет сессии Telegram: выполните вход командой node bin/login.mjs',
  unresolved: 'неразобранных',
  delayed: 'с задержкой',
  media: 'вложение',
  before: 'До сообщения',
  after: 'После сообщения',
  links: 'Ссылки',
  markDone: 'Разобрано',
  back: 'К списку',
  loading: 'Читаем базу заявок',
} as const

export type CommunicationLocaleKey = keyof typeof ru
