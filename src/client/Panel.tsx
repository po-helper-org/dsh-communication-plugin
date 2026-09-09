/**
 * Панель раздела: список Inbox и карточка заявки с тредом.
 *
 * Два состояния одного экрана, без маршрутизации: выбранная заявка закрывает список,
 * возврат — по кнопке. Ни одного действия наружу: разбор меняет только состояние заявки.
 */
import { useCallback, useEffect, useState } from 'react'
import type { PropsStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { InboxPage, RpcResult } from '../channel.js'
import type { ItemRow, Thread } from '../model.js'
import type { CommunicationLocaleKey } from './locales.js'
import type { PanelStoreHandle } from './index.js'
import { classNames as css } from './styles.js'

export interface CommunicationPanelInjected {
  call: (endpoint: string, payload?: unknown) => Promise<RpcResult<unknown>>
}

export type CommunicationPanelProps =
  PropsRuntime<'shell.overlay'> &
  PropsStore<PanelStoreHandle> &
  InjectFace<CommunicationPanelInjected> &
  PropsLocale<'communication.inbox'>

const when = (ms: number): string =>
  new Date(ms).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function CommunicationPanel(props: CommunicationPanelProps) {
  const { t, useStore, actions, inject } = props as unknown as CommunicationPanelProps & {
    t: (key: CommunicationLocaleKey) => string
    inject: CommunicationPanelInjected
  }
  const open = useStore((state) => state.open)
  const [page, setPage] = useState<InboxPage | null>(null)
  const [thread, setThread] = useState<Thread | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const result = await inject.call('list')
    if (result.ok) { setPage(result.value as InboxPage); setError(null) } else setError(result.error.message)
  }, [inject])

  useEffect(() => {
    if (!open) return
    setThread(null)
    void reload()
  }, [open, reload])

  if (!open) return null

  const openCard = async (key: string) => {
    const result = await inject.call('show', { key })
    if (result.ok) { setThread(result.value as Thread); setError(null) } else setError(result.error.message)
  }

  const markDone = async (key: string) => {
    const result = await inject.call('done', { key })
    if (!result.ok) { setError(result.error.message); return }
    setThread(null)
    await reload()
  }

  return (
    <div className={css.panel}>
      <div className={css.header}>
        <span className={css.headerTitle}>{t('panelTitle')}</span>
        {page !== null && <span className={css.mark}>{page.unresolved} {t('unresolved')}</span>}
        <button type="button" className={css.iconButton} onClick={() => { actions.close() }}>✕</button>
      </div>

      <div className={css.body}>
        {error !== null && <div className={css.notice}>{error}</div>}
        {page === null && error === null && <div className={css.notice}>{t('loading')}</div>}

        {thread === null && page !== null && (
          <>
            {!page.status.configured && <div className={css.notice}>{t('notConfigured')}</div>}
            {page.status.configured && !page.status.authorized && <div className={css.notice}>{t('notAuthorized')}</div>}
            {page.status.lastError !== null && page.status.configured && page.status.authorized
              && <div className={css.notice}>{page.status.lastError}</div>}
            {page.items.length === 0 && <div className={css.notice}>{t('empty')}</div>}
            {page.items.map((row: ItemRow) => (
              <button type="button" key={row.key} className={css.card} onClick={() => { void openCard(row.key) }}>
                <div className={css.cardMeta}>
                  <span>{when(row.sentAt)}</span>
                  <span>{row.chatTitle ?? ''}</span>
                  <span>{row.author ?? ''}</span>
                  <span className={css.marks}>
                    {row.delayed && <span className={css.mark}>{t('delayed')}</span>}
                    {row.hasMedia && <span className={css.mark}>{t('media')}</span>}
                  </span>
                </div>
                <div className={css.cardText}>{row.preview}</div>
              </button>
            ))}
          </>
        )}

        {thread !== null && (
          <>
            <div className={css.cardMeta}>
              <span>{when(thread.item.sentAt)}</span>
              <span>{thread.item.chatTitle ?? thread.item.chatId}</span>
              <span>{thread.item.author ?? ''}</span>
              <span className={css.marks}>
                {thread.item.delayed && <span className={css.mark}>{t('delayed')}</span>}
                {thread.item.hasMedia && <span className={css.mark}>{t('media')}</span>}
              </span>
            </div>

            <div className={css.threadHead}>{t('before')}</div>
            {thread.before.map((row) => (
              <div className={css.threadLine} key={row.key}>{row.author ?? '?'}: {row.preview}</div>
            ))}

            <div className={css.threadFocus}>{thread.item.text}</div>

            <div className={css.threadHead}>{t('after')}</div>
            {thread.after.map((row) => (
              <div className={css.threadLine} key={row.key}>{row.author ?? '?'}: {row.preview}</div>
            ))}

            {thread.item.links.length > 0 && (
              <>
                <div className={css.threadHead}>{t('links')}</div>
                {thread.item.links.map((link) => <div className={css.linkList} key={link}>{link}</div>)}
              </>
            )}
          </>
        )}
      </div>

      {thread !== null && (
        <div className={css.actions}>
          <button type="button" className={css.iconButton} onClick={() => { setThread(null) }}>{t('back')}</button>
          <button type="button" className={css.iconButton} onClick={() => { void markDone(thread.item.key) }}>
            {t('markDone')}
          </button>
        </div>
      )}
    </div>
  )
}
