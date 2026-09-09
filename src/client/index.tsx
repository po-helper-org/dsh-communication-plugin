/**
 * Раздел «Управление коммуникацией», браузерная половина.
 *
 * Кнопка в подвале левой панели (`sidebar.footer.action`) и сама панель в слое оверлеев
 * (`shell.overlay`) делят один стор: кнопка переключает `open`, панель его читает,
 * поэтому они не расходятся.
 */
// Type-only: дают декларации служб и слияние SlotMap.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { defineStore, type PropsStore, type StoreHandle } from '@deepseek-ai/dsh-client-store'
import type { RpcResult } from '../channel.js'
import { ru, type CommunicationLocaleKey } from './locales.js'
import { CommunicationPanel, type CommunicationPanelInjected } from './Panel.js'
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

/** Слоты дают место регистрации, стор — общее состояние видимости, локаль — копию. */
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
      inject: (): CommunicationPanelInjected => ({ call }),
    },
    CommunicationPanel,
  ))
}

/** Кнопка раздела в подвале левой панели: переключает общий с панелью стор видимости. */
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
