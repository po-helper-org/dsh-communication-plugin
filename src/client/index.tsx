/**
 * Раздел «Управление коммуникацией», браузерная половина.
 *
 * Кнопка в подвале левой панели (`sidebar.footer.action`) и столбец с лентой в слое
 * оверлеев (`shell.overlay`) делят один стор: кнопка переключает `open`, столбец его
 * читает, поэтому они не расходятся. Карточка настроек живёт в
 * «Настройки → Плагины» (`settings.plugin.item`) под тем же ключом, что пространство
 * настроек узла (`communication-feed`): вкладка сводит две ведомости — что отдаёт
 * узел и какие карточки есть в браузере — именно по нему.
 */
// Type-only: дают декларации служб и слияние SlotMap.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { defineStore, type PropsStore, type StoreHandle } from '@deepseek-ai/dsh-client-store'
import type { RpcResult } from '../channel.js'
import { FEED_NAMESPACE, type FeedSettings } from '../feed-settings.js'
import { FeedCardController, resolveSettings } from './feed-card.js'
import { FeedColumn, type FeedColumnInjected } from './FeedColumn.js'
import { FeedSettingsCard, type FeedCardInjected } from './FeedSettingsCard.js'
import { ru, type CommunicationLocaleKey } from './locales.js'
import { classNames as css, styleText } from './styles.js'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'communication.inbox': CommunicationLocaleKey }
}

const NS = 'communication.inbox'

/**
 * Имя канала RPC-узла (`src/channel.ts`, `COMMUNICATION_CHANNEL`). Продублировано строкой,
 * а не импортировано значением: `channel.ts` — общий модуль с узловой половиной, и его код
 * клиенту не нужен.
 */
const CHANNEL = '/communication'

export interface PanelState {
  open: boolean
}

export type PanelStoreHandle = StoreHandle<PanelState, {
  toggle: (draft: PanelState) => void
  close: (draft: PanelState) => void
}>

/**
 * Слоты дают место регистрации, стор — общее состояние видимости, локаль — копию.
 * Служба настроек — не здесь: без неё раздел обязан подниматься и показывать ленту
 * без входа и без меток, поэтому скоуп берётся отложенной инъекцией.
 */
export const inject = ['slots', 'connection', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh: ru, en: ru }), 'dsh-communication-plugin: словарь копии (ru)')

  ctx.effect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-plugin', 'dsh-communication-plugin')
    style.textContent = styleText
    document.head.appendChild(style)
    return () => { style.remove() }
  }, 'dsh-communication-plugin: стили раздела')

  // Хэндл стора создаётся заново на каждый apply() и не экспортируется с модуля: иначе
  // модульный кэш стал бы замаскированным синглтоном между перезагрузками плагина.
  const panelStore: PanelStoreHandle = defineStore({
    init: (): PanelState => ({ open: false }),
    actions: {
      toggle: (draft) => { draft.open = !draft.open },
      close: (draft) => { draft.open = false },
    },
  })

  const connection = ctx.get('connection') as unknown as {
    rpc: {
      call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<RpcResult<unknown>>
    }
  }
  const call = (endpoint: string, payload: unknown = {}): Promise<RpcResult<unknown>> =>
    connection.rpc.call(CHANNEL, endpoint, payload)

  // ——— Настройки ленты ———
  // Снимок с неизменной ссылкой, пока значения не сдвинулись: его читает столбец
  // через подписку, и новый объект на каждый вызов означал бы бесконечную перерисовку.
  let settingsScope: SettingsScope<FeedSettings> | undefined
  const listeners = new Set<() => void>()
  const notify = () => { for (const listener of listeners) listener() }
  let cachedSection: unknown
  let cachedSettings: FeedSettings | null = null
  const getSettings = (): FeedSettings | null => {
    if (settingsScope === undefined) return null
    const section = settingsScope.getSnapshot().value
    if (section === cachedSection && cachedSettings !== null) return cachedSettings
    cachedSection = section
    cachedSettings = resolveSettings(section)
    return cachedSettings
  }
  const subscribeSettings = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }

  ctx.inject(['settingsScope'], (scoped: ClientContext) => {
    const scope = scoped.settingsScope.bind<FeedSettings>({ namespace: FEED_NAMESPACE })
    scoped.effect(() => {
      settingsScope = scope
      notify()
      const off = scope.subscribe(notify)
      return () => {
        off()
        settingsScope = undefined
        cachedSettings = null
        notify()
      }
    }, 'dsh-communication-plugin: настройки ленты')

    const card = new FeedCardController(scope)
    scoped.slots.inject('settings.plugin.item', () => scoped.slots.register(
      {
        name: 'settings.plugin.item',
        key: FEED_NAMESPACE,
        locale: NS,
        inject: (): FeedCardInjected => ({ ...card.inject(), call }),
      },
      FeedSettingsCard,
    ))
  })

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'communication-inbox', locale: NS, store: panelStore },
    InboxButton,
  ))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    {
      name: 'shell.overlay',
      id: 'communication-inbox',
      locale: NS,
      store: panelStore,
      inject: (): FeedColumnInjected => ({ call, getSettings, subscribeSettings }),
    },
    FeedColumn,
  ))
}

/** Кнопка раздела в подвале левой панели: переключает общий со столбцом стор видимости. */
function InboxButton({ t, useStore, actions, wide }: PropsStore<PanelStoreHandle> & {
  t: (key: CommunicationLocaleKey) => string
  wide: boolean
}) {
  const open = useStore((state) => state.open)
  return (
    <div className={wide ? css.navLayer : `${css.navLayer} ${css.navRail}`}>
      <button
        type="button"
        className={css.navBadge}
        data-active={open || undefined}
        aria-pressed={open}
        aria-label={t('nav')}
        onClick={() => { actions.toggle() }}
      >
        <span aria-hidden>✉</span>
        {wide && <span className={css.navBadgeLabel}>{t('nav')}</span>}
      </button>
    </div>
  )
}
