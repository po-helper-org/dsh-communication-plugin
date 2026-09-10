/**
 * Панель раздела: лента заявок, диалог и контекст решения в трёх колонках.
 *
 * Раскладка перенесена из `docs/ui/inbox-prototype.html`. Ни одного действия наружу:
 * разбор и лейблы меняют только состояние заявки, в канал раздел молчит.
 *
 * Данные приходят единственным путём — подкомандами канала. Панель не знает ни про
 * хранилище, ни про его форму: это условие принципа портов (`docs/PRINCIPLES.md`),
 * без которого реализацию хранилища нельзя подменить, не переписав раздел.
 */
import { useCallback, useEffect, useState } from 'react'
import type { PropsStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { LABELS, type InboxPage, type RpcResult } from '../channel.js'
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

type Translate = (key: CommunicationLocaleKey) => string

const LABEL_BY_ID = new Map(LABELS.map((label) => [label.id as string, label]))

/** Время сообщения: дата и часы, ровно то, что нужно для решения. */
const when = (ms: number): string =>
  new Date(ms).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Возраст заявки словами: в ленте важнее «сколько ждёт», чем точная дата. */
function ago(ms: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - ms) / 60_000))
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours} ч` : `${Math.round(hours / 24)} дн`
}

function initials(name: string | null): string {
  if (name === null || name.trim() === '') return '—'
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}

function Chip({ id, onClick, onRemove }: {
  id: string
  onClick?: () => void
  onRemove?: () => void
}) {
  const label = LABEL_BY_ID.get(id)
  const text = label?.text ?? id
  const tone = label?.tone ?? 'noise'
  if (onRemove !== undefined) {
    return (
      <span className={css.lb} data-tone={tone}>
        {text}
        <button type="button" className={css.lbX} aria-label="Снять лейбл" onClick={onRemove}>×</button>
      </span>
    )
  }
  if (onClick !== undefined) {
    return (
      <button type="button" className={css.lb} data-tone={tone} onClick={(event) => { event.stopPropagation(); onClick() }}>
        {text}
      </button>
    )
  }
  return <span className={css.lb} data-tone={tone}>{text}</span>
}

export function CommunicationPanel(props: CommunicationPanelProps) {
  // Внимание: InjectFace кладёт грань прямо в props, а не под ключом `inject`.
  // Обращение через `props.inject.call` даёт undefined и панель молча висит на загрузке.
  const { t, useStore, actions, call } = props as unknown as CommunicationPanelProps
    & CommunicationPanelInjected
    & { t: Translate }
  const open = useStore((state) => state.open)
  const [page, setPage] = useState<InboxPage | null>(null)
  const [thread, setThread] = useState<Thread | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const result = await call('list')
    if (result.ok) { setPage(result.value as InboxPage); setError(null) } else setError(result.error.message)
  }, [call])

  const openCard = useCallback(async (key: string) => {
    const result = await call('show', { key })
    if (result.ok) { setThread(result.value as Thread); setPicker(false); setError(null) } else setError(result.error.message)
  }, [call])

  useEffect(() => {
    if (!open) return
    setThread(null)
    setFilter(null)
    void reload()
  }, [open, reload])

  // Первая заявка открывается сама: раздел без выбранной карточки бесполезен.
  useEffect(() => {
    if (page === null || thread !== null) return
    const first = page.items[0]
    if (first !== undefined) void openCard(first.key)
  }, [page, thread, openCard])

  if (!open) return null

  const rows = page === null
    ? []
    : filter === null ? page.items : page.items.filter((row) => row.labels.includes(filter))

  const markDone = async (key: string) => {
    const result = await call('done', { key })
    if (!result.ok) { setError(result.error.message); return }
    setThread(null)
    await reload()
  }

  const toggleLabel = async (key: string, label: string, on: boolean) => {
    const result = await call('label', { key, label, on })
    if (!result.ok) { setError(result.error.message); return }
    await openCard(key)
    await reload()
  }

  const now = Date.now()
  const item = thread?.item ?? null

  return (
    <div className={css.panel}>
      <div className={css.columns}>
        <section className={css.list} aria-label={t('panelTitle')}>
          <div className={css.listTop}>
            <span className={css.listTitle}>{t('panelTitle')}</span>
            {page !== null && <span className={css.pill}>{page.unresolved} {t('unresolved')}</span>}
            <span className={css.icons}>
              <button type="button" className={css.iconBtn} aria-label={t('refresh')} onClick={() => { void reload() }}>⟳</button>
              <button type="button" className={css.iconBtn} aria-label={t('close')} onClick={() => { actions.close() }}>✕</button>
            </span>
          </div>

          <div className={css.tabs} role="tablist">
            <button type="button" className={css.tab} role="tab" aria-selected="true">
              {t('tabInbox')} <span className={css.tabCount}>{page?.unresolved ?? 0}</span>
            </button>
          </div>

          <div className={css.rows}>
            {error !== null && <div className={css.notice}>{error}</div>}
            {page === null && error === null && <div className={css.notice}>{t('loading')}</div>}
            {page !== null && !page.status.configured && <div className={css.notice}>{t('notConfigured')}</div>}
            {page !== null && page.status.lastError !== null && <div className={css.notice}>{page.status.lastError}</div>}

            {filter !== null && (
              <div className={css.filterBar}>
                {t('labelFilter')} «{LABEL_BY_ID.get(filter)?.text ?? filter}» · {rows.length}
                <button type="button" onClick={() => { setFilter(null) }}>{t('reset')}</button>
              </div>
            )}

            {page !== null && rows.length === 0 && <div className={css.notice}>{t('empty')}</div>}

            {rows.map((row: ItemRow) => (
              <button
                key={row.key}
                type="button"
                className={css.row}
                aria-current={row.key === item?.key}
                onClick={() => { void openCard(row.key) }}
              >
                <span className={`${css.ava} ${row.author === null ? css.avaGray : ''}`}>{initials(row.author)}</span>
                <span className={css.rowMain}>
                  <span className={css.rowSource}>{row.chatTitle ?? t('unknownChat')}</span>
                  <span className={css.rowHead}>
                    <span className={css.rowName}>{row.author ?? t('unknownAuthor')}</span>
                    <span className={css.rowWhen}>{ago(row.sentAt, now)}</span>
                  </span>
                  <span className={css.rowText}>{row.preview}</span>
                  <span className={css.rowBottom}>
                    {row.labels.map((label) => (
                      <Chip key={label} id={label} onClick={() => { setFilter(filter === label ? null : label) }} />
                    ))}
                    {row.delayed && <span className={css.lb} data-tone="system">{t('delayed')}</span>}
                    {row.hasMedia && <span className={css.lb}>{t('media')}</span>}
                  </span>
                </span>
              </button>
            ))}

            {page !== null && rows.length > 0 && filter === null && (
              <div className={css.listEnd}>{t('listEnd')}</div>
            )}
          </div>
        </section>

        <section className={css.thread} aria-label={t('dialog')}>
          {item === null
            ? <div className={css.notice}>{t('pickItem')}</div>
            : (
              <>
                <div className={css.threadTop}>
                  <span className={`${css.ava} ${item.author === null ? css.avaGray : ''}`}>{initials(item.author)}</span>
                  <span className={css.threadWho}>
                    <b>{item.author ?? t('unknownAuthor')}</b>
                    <span>{item.channel} · {item.chatTitle ?? item.chatId}</span>
                  </span>
                  <span className={css.threadActions}>
                    <span className={css.split}>
                      <button type="button" onClick={() => { void markDone(item.key) }}>{t('markDone')}</button>
                    </span>
                  </span>
                </div>

                <div className={css.turns}>
                  {thread?.before.map((row) => (
                    <div className={css.turn} key={row.key}>
                      <div className={css.bubble}>{row.preview}</div>
                      <div className={css.turnMeta}>{row.author ?? '—'} · {when(row.sentAt)}</div>
                    </div>
                  ))}

                  <div className={`${css.turn} ${css.turnFocus}`}>
                    <div className={css.bubble}>{item.text}</div>
                    <div className={css.turnMeta}>{item.author ?? '—'} · {when(item.sentAt)}</div>
                  </div>

                  {item.delayed && <div className={css.event}>{t('delayedEvent')}</div>}

                  {thread?.after.map((row) => (
                    <div className={css.turn} key={row.key}>
                      <div className={css.bubble}>{row.preview}</div>
                      <div className={css.turnMeta}>{row.author ?? '—'} · {when(row.sentAt)}</div>
                    </div>
                  ))}
                </div>

                <div className={css.composer}>
                  <p className={css.composerNote}>{t('composerNote')}</p>
                </div>
              </>
            )}
        </section>

        <aside className={css.context} aria-label={t('contextTitle')}>
          <div className={css.ctxTop}>{t('contextTitle')}</div>

          {item !== null && (
            <>
              <div className={css.card}>
                <div className={css.cardId}>
                  <span className={`${css.ava} ${item.author === null ? css.avaGray : ''}`}>{initials(item.author)}</span>
                  <b>{item.author ?? t('unknownAuthor')}</b>
                </div>
                <div className={css.cardRows}>
                  <div><span>{t('fieldChannel')}</span><span>{item.channel}</span></div>
                  <div><span>{t('fieldChat')}</span><span>{item.chatTitle ?? item.chatId}</span></div>
                  <div><span>{t('fieldAuthorId')}</span><span>{item.authorId ?? t('none')}</span></div>
                </div>
              </div>

              <details className={css.section} open>
                <summary>{t('sectionLabels')}</summary>
                <div className={css.sectionBody}>
                  <div className={css.labels}>
                    {item.labels.map((label) => (
                      <Chip key={label} id={label} onRemove={() => { void toggleLabel(item.key, label, false) }} />
                    ))}
                    <button type="button" className={css.addLabel} onClick={() => { setPicker(!picker) }}>
                      {t('addLabel')}
                    </button>
                  </div>

                  {picker && (
                    <div className={css.picker}>
                      {LABELS.map((label) => {
                        const applied = item.labels.includes(label.id)
                        return (
                          <button
                            key={label.id}
                            type="button"
                            onClick={() => { void toggleLabel(item.key, label.id, !applied) }}
                          >
                            <span className={css.swatch} style={{ background: `var(--comm-lb-${label.tone}, currentColor)` }} />
                            {label.text}
                            {applied && <span className={css.tick}>✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </details>

              <details className={css.section} open>
                <summary>{t('sectionFacts')}</summary>
                <div className={css.sectionBody}>
                  <dl className={css.facts}>
                    <div><dt>{t('fieldSent')}</dt><dd>{when(item.sentAt)}</dd></div>
                    <div><dt>{t('fieldGot')}</dt><dd>{when(item.receivedAt)}{item.delayed ? ` · ${t('delayed')}` : ''}</dd></div>
                    <div><dt>{t('fieldState')}</dt><dd>{item.state}</dd></div>
                  </dl>
                  {item.links.length > 0 && (
                    <div className={css.links}>{item.links.join('\n')}</div>
                  )}
                </div>
              </details>

              <details className={css.section}>
                <summary>{t('sectionCollector')}</summary>
                <div className={css.sectionBody}>
                  <p className={css.note}>
                    {page?.status.watching.length ? page.status.watching.join(', ') : t('notConfigured')}
                  </p>
                </div>
              </details>
            </>
          )}

          <div className={css.collector}>
            {page?.status.authorized === true && <span className={css.dotLive} aria-hidden="true" />}
            {page?.status.authorized === true ? t('collecting') : t('collectorStopped')}
          </div>
        </aside>
      </div>
    </div>
  )
}
