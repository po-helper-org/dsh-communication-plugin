/**
 * Правый столбец с лентой: шапка, пилюли меток и фрейм с клиентом ленты.
 *
 * Своего UI ленты здесь нет намеренно: посты, ветки, опросы, ответы и панель
 * Shortcuts уже есть у клиента (Phanpy), а в ширине столбца он сам уходит в
 * мобильную раскладку. Столбец решает три вещи, которых у клиента нет:
 *
 *   1. вход: узел отдаёт запись `localStorage.accounts` (см. `feed.ts`), фрейм
 *      грузит `seed.html` клиента с ней во фрагменте — и открывается Home без
 *      страницы входа (которую во фрейме и не показать: инстанс отдаёт DENY);
 *   2. фильтр: пилюля = метка = лента по тегу `#/{instance}/t/{id}`. Одна за
 *      раз — объединение тегов сервер молча игнорирует (проверено);
 *   3. пустые метки гасятся: тег без постов у сервера — 404, и клиент показал бы
 *      «not found» вместо объяснения.
 *
 * Слот `shell.overlay` сквозной для кликов; столбец возвращает себе события сам.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PropsStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RpcResult } from '../channel.js'
import type { FeedSettings } from '../feed-settings.js'
import type { PanelStoreHandle } from './index.js'
import type { CommunicationLocaleKey } from './locales.js'
import { classNames as css } from './styles.js'

export interface FeedColumnInjected {
  call: (endpoint: string, payload?: unknown) => Promise<RpcResult<unknown>>
  /** Снимок настроек с неизменной ссылкой, пока значения не сдвинулись. */
  getSettings: () => FeedSettings | null
  subscribeSettings: (listener: () => void) => () => void
}

export type FeedColumnProps =
  PropsRuntime<'shell.overlay'> &
  PropsStore<PanelStoreHandle> &
  InjectFace<FeedColumnInjected> &
  PropsLocale<'communication.inbox'>

type Translate = (key: CommunicationLocaleKey) => string

/** UTF-8 в base64 для фрагмента URL: `btoa` сам кириллицу не берёт. */
function b64(json: string): string {
  return btoa(unescape(encodeURIComponent(json)))
}

function useSettings(props: FeedColumnInjected): FeedSettings | null {
  const [, tick] = useState(0)
  useEffect(() => props.subscribeSettings(() => { tick((n) => n + 1) }), [props])
  return props.getSettings()
}

export function FeedColumn(props: FeedColumnProps) {
  const face = props as unknown as FeedColumnProps & FeedColumnInjected & { t: Translate }
  const { t, useStore, actions, call } = face
  const open = useStore((state) => state.open)
  const settings = useSettings(face)
  const [active, setActive] = useState<string | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [seeded, setSeeded] = useState<'pending' | 'ok' | 'failed' | 'none'>('pending')
  const [counts, setCounts] = useState<Record<string, number | null>>({})

  const clientBase = useMemo(() => (settings?.clientUrl.trim() || 'http://127.0.0.1:8083').replace(/\/$/, ''), [settings])
  const instanceHost = useMemo(() => (settings?.instanceUrl ?? '').trim().replace(/^https?:\/\//, '').replace(/\/$/, ''), [settings])

  const routeFor = useCallback((label: string | null) =>
    label === null ? '#/' : `#/${instanceHost}/t/${encodeURIComponent(label)}`, [instanceHost])

  // Первая загрузка фрейма — через seed.html: запись входа во фрагменте, дальше
  // клиент сам переходит на нужный маршрут. Отказ узла (нет токена, инстанс
  // не отвечает) не прячется: фрейм открывается без входа, а подсказка внизу
  // говорит, куда идти.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setSeeded('pending')
    void call('feed.seed').then((result) => {
      if (cancelled) return
      if (result.ok) {
        const seed = { ...(result.value as { accounts: string; currentAccount: string }), to: `/${routeFor(active)}` }
        setSrc(`${clientBase}/seed.html#${b64(JSON.stringify(seed))}`)
        setSeeded('ok')
      } else {
        setSrc(`${clientBase}/${routeFor(active)}`)
        setSeeded(result.error.code === 'no-settings' ? 'none' : 'failed')
      }
    })
    return () => { cancelled = true }
    // Маршрут при первой загрузке — текущая метка; смена метки идёт отдельным эффектом.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientBase, call])

  useEffect(() => {
    if (!open || settings === null || settings.labels.length === 0) return
    let cancelled = false
    void call('feed.counts').then((result) => {
      if (!cancelled && result.ok) setCounts(result.value as Record<string, number | null>)
    })
    return () => { cancelled = true }
  }, [open, settings, call])

  const pick = (label: string | null) => {
    setActive(label)
    // После входа документ фрейма — клиент ленты; смена хэша — переход внутри него.
    setSrc(`${clientBase}/${routeFor(label)}`)
  }

  if (!open) return null
  const labels = settings?.labels ?? []

  return (
    <section className={css.column} aria-label={t('columnTitle')}>
      <div className={css.head}>
        <span className={css.headTitle}>{t('columnTitle')}</span>
        <a className={css.headLink} href={`${clientBase}/#/`} target="_blank" rel="noopener">{t('openApart')} ↗</a>
        <button type="button" className={css.iconBtn} aria-label={t('close')} onClick={() => { actions.close() }}>×</button>
      </div>
      <div className={css.pills}>
        <button type="button" className={css.pill} data-active={active === null || undefined} onClick={() => { pick(null) }}>{t('all')}</button>
        {labels.map((label) => {
          const count = counts[label.id]
          const empty = count === null || count === 0
          return (
            <button
              type="button" key={label.id} className={css.pill}
              data-active={active === label.id || undefined}
              data-empty={empty || undefined}
              title={empty ? t('emptyLabel') : undefined}
              onClick={() => { pick(label.id) }}
            >{label.title || label.id}</button>
          )
        })}
      </div>
      {src !== null && <iframe className={css.frame} src={src} title={t('columnTitle')} referrerPolicy="no-referrer" />}
      <div className={css.hint}>
        {seeded === 'none' ? t('hintNoSettings') : seeded === 'failed' ? `${t('hintSeedFailed')}. ${t('hintLogin')}` : t('hintLogin')}
      </div>
    </section>
  )
}
