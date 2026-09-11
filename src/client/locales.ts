/**
 * Словарь раздела. Рабочий язык этого развёртывания — русский, поэтому оба обязательных
 * слота харнесса получают один и тот же словарь.
 */
export const ru = {
  nav: 'Управление коммуникацией',
  panelTitle: 'Входящие',
  unresolved: 'не разобрано',
  tabInbox: 'Входящие',
  empty: 'Inbox пуст',
  listEnd: 'Все заявки загружены',
  loading: 'Читаем базу заявок',
  refresh: 'Обновить',
  close: 'Закрыть раздел',
  reset: 'сбросить',
  labelFilter: 'Лейбл',

  notConfigured: 'Сбор не настроен: задайте WATCHED_FOLDERS в .env коллектора',
  collecting: 'сбор идёт',
  collectorStopped: 'коллектор не запущен',

  dialog: 'Диалог',
  pickItem: 'Выберите заявку слева',
  markDone: 'Разобрано',
  delayed: 'с задержкой',
  delayedEvent: 'Заявка собрана с задержкой: машина была недоступна',
  media: 'вложение',
  composerNote: 'Ответ из карточки — следующая итерация. Отправку всегда подтверждает человек.',

  contextTitle: 'Контакт',
  sectionLabels: 'Лейблы',
  sectionFacts: 'Сведения о заявке',
  sectionCollector: 'Что собираем',
  addLabel: '+ лейбл',
  fieldChannel: 'Канал',
  fieldChat: 'Чат',
  fieldAuthorId: 'Идентификатор',
  fieldSent: 'Отправлено',
  fieldGot: 'Собрано',
  fieldState: 'Состояние',
  none: 'не указан',
  unknownAuthor: 'Без автора',
  unknownChat: 'Без чата',

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
} as const

export type CommunicationLocaleKey = keyof typeof ru
