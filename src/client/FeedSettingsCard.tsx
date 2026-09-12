/**
 * Карточка раздела в «Настройки → Плагины → Конфигурация плагинов»: подключение
 * ленты и метки. Сторона разметки.
 *
 * Собственная вёрстка, а не карточка харнесса: `PluginCard`/`ValueField` живут
 * внутри @deepseek-ai/dsh-client-ui-settings-plugins и значением не экспортируются —
 * слот на то и keyed, что карточку рисует сам плагин. Геометрия и токены сняты с
 * `PluginCard.module.css` один в один (см. styles.ts): карточка стоит в одном
 * списке с соседними и обязана быть от них неотличимой.
 *
 * Пока узел не отдаёт пространство `communication-feed`, карточка не рисует
 * ничего: полоса, которой нельзя пользоваться, хуже отсутствия полосы.
 */
// Type-only: даёт слияние SlotMap с записью 'settings.plugin.item'.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RpcResult } from '../channel.js'
import { RULE_KINDS, type LabelRule, type RuleKind } from '../feed-settings.js'
import type { FeedCardFace, TextField } from './feed-card.js'
import type { CommunicationLocaleKey } from './locales.js'
import { classNames as css } from './styles.js'

export interface FeedCardInjected extends FeedCardFace {
  call: (endpoint: string, payload?: unknown) => Promise<RpcResult<unknown>>
}

export type FeedSettingsCardProps =
  PropsRuntime<'settings.plugin.item'> &
  PropsLocale<'communication.inbox'> &
  InjectFace<FeedCardInjected>

type Translate = (key: CommunicationLocaleKey) => string

const KIND_KEY: Record<RuleKind, CommunicationLocaleKey> = {
  account: 'kindAccount', tag: 'kindTag', contains: 'kindContains', regex: 'kindRegex', prompt: 'kindPrompt',
}
const PLACEHOLDER: Record<RuleKind, string> = {
  account: 'product_radar', tag: 'контур_приёмка', contains: 'слово или фраза', regex: '\\bGDS\\b',
  prompt: 'Переписка с партнёром MTS Live: созвоны, договорённости, сроки интеграции — даже если слова «Live» в тексте нет',
}

function kindOf(rule: LabelRule): RuleKind {
  return RULE_KINDS.find((k) => k in rule) ?? 'contains'
}

export function FeedSettingsCard(props: FeedSettingsCardProps) {
  // InjectFace кладёт грань прямо в props, а `hooks.feedCard` становится `useFeedCard`.
  const face = props
  const t: Translate = props.t
  const { call } = props
  const state = props.useFeedCard((snapshot) => snapshot)
  const [open, setOpen] = useState(false)
  const saveStarted = useRef(false)
  const [verifyState, setVerifyState] = useState<{ tone: 'ok' | 'bad' | 'busy'; text: string } | null>(null)
  const [relabel, setRelabel] = useState<{ running: boolean; available: boolean | null; output: string | null }>({ running: false, available: null, output: null })

  useEffect(() => {
    if (state.saving) { saveStarted.current = true; return }
    if (!saveStarted.current) return
    saveStarted.current = false
    if (!state.dirty && !state.failed) setOpen(false)
  }, [state.dirty, state.failed, state.saving])

  useEffect(() => {
    if (!open || relabel.available !== null) return
    void call('feed.relabel.available').then((r) => {
      setRelabel((s) => ({ ...s, available: r.ok ? (r.value as { available: boolean }).available : false }))
    })
  }, [open, relabel.available, call])

  const verify = useCallback(async () => {
    setVerifyState({ tone: 'busy', text: t('verifying') })
    const r = await call('feed.verify')
    if (r.ok) setVerifyState({ tone: 'ok', text: `@${(r.value as { acct: string }).acct} — ${t('verified')}` })
    else setVerifyState({ tone: 'bad', text: `${t('verifyFailed')}: ${r.error.message}` })
  }, [call, t])

  const runRelabel = useCallback(async (apply: boolean) => {
    setRelabel((s) => ({ ...s, running: true, output: null }))
    const r = await call('feed.relabel', { apply })
    setRelabel((s) => ({
      ...s, running: false,
      output: r.ok ? (r.value as { output: string }).output : r.error.message,
    }))
  }, [call])

  if (!state.available) return null
  const disabled = !state.writable
  const v = state.values

  const textField = (field: TextField, label: CommunicationLocaleKey, hint: CommunicationLocaleKey, extra?: JSX.Element) => (
    <div className={css.field}>
      <label className={css.fieldLabel} htmlFor={`comm-${field}`}>{t(label)}<span className={css.fieldHint}>{t(hint)}</span></label>
      <div>
        <div className={css.fieldRow}>
          <input
            id={`comm-${field}`} value={v[field]} disabled={disabled} autoComplete="off"
            type={field === 'token' ? 'password' : 'text'}
            onChange={(e) => { face.editText(field, e.target.value) }}
          />
          {extra}
        </div>
        {field === 'token' && verifyState !== null && (
          <div className={css.status} data-ok={verifyState.tone === 'ok' || undefined} data-bad={verifyState.tone === 'bad' || undefined}>{verifyState.text}</div>
        )}
      </div>
    </div>
  )

  return (
    <li className={css.card} data-open={open || undefined}>
      <button
        type="button" className={css.cardHead} aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${t('cardTitle')}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.cardText}>
          <span className={css.cardName}>{t('cardTitle')}</span>
          <span className={css.cardDesc}>{t('cardDescription')}</span>
        </span>
        {state.dirty && <span className={css.cardPending}>{t('unsaved')}</span>}
        <IconChevronDownOutline14 className={css.cardChevron} />
      </button>
      {open && (
        <div className={css.cardBody}>
          {disabled && <p className={css.cardNote} role="status">{t('readOnly')}</p>}

          <p className={css.subhead}>{t('connection')}</p>
          <div className={css.fields}>
            {textField('clientUrl', 'clientUrl', 'clientUrlHint')}
            {textField('instanceUrl', 'instanceUrl', 'instanceUrlHint')}
            {textField('hostApiUrl', 'hostApiUrl', 'hostApiUrlHint')}
            {textField('token', 'token', 'tokenHint', (
              <button type="button" className={css.btn} disabled={state.dirty || v.token.trim() === ''} title={state.dirty ? t('unsaved') : undefined} onClick={() => { void verify() }}>{t('verify')}</button>
            ))}
          </div>

          <p className={css.subhead}>{t('labels')}</p>
          {v.labels.map((label, li) => (
            <div className={css.label} key={li}>
              <div className={css.labelHead}>
                <input value={label.title} placeholder={t('labelTitle')} disabled={disabled} onChange={(e) => { face.editLabelTitle(li, e.target.value) }} />
                <span className={css.labelTag}>{label.id ? `#${label.id}` : '#…'}</span>
                <button type="button" className={css.iconBtn} title={t('removeLabel')} aria-label={t('removeLabel')} disabled={disabled} onClick={() => { face.removeLabel(li) }}>×</button>
              </div>
              {label.rules.map((rule, ri) => {
                const kind = kindOf(rule)
                const value = rule[kind] ?? ''
                const onValue = (next: string) => { face.editRule(li, ri, kind, next) }
                return (
                  <div className={css.rule} key={ri}>
                    <span className={css.ruleOr}>{t(ri === 0 ? 'ruleIf' : 'ruleOr')}</span>
                    <select value={kind} disabled={disabled} onChange={(e) => { face.editRule(li, ri, e.target.value as RuleKind, value) }}>
                      {RULE_KINDS.map((k) => <option key={k} value={k}>{t(KIND_KEY[k])}</option>)}
                    </select>
                    {kind === 'prompt'
                      ? <textarea value={value} placeholder={PLACEHOLDER[kind]} disabled={disabled} onChange={(e) => { onValue(e.target.value) }} />
                      : <input value={value} placeholder={PLACEHOLDER[kind]} disabled={disabled} onChange={(e) => { onValue(e.target.value) }} />}
                    <button type="button" className={css.iconBtn} title={t('removeRule')} aria-label={t('removeRule')} disabled={disabled} onClick={() => { face.removeRule(li, ri) }}>×</button>
                  </div>
                )
              })}
              <button type="button" className={`${css.linkBtn} ${css.addRule}`} disabled={disabled} onClick={() => { face.addRule(li) }}>{t('addRule')}</button>
            </div>
          ))}
          <p className={css.cardNote}>{t('labelsHint')}</p>
          {state.invalid !== null && state.dirty && <p className={css.cardFailed} role="status">{state.invalid}</p>}

          <div className={css.cardFoot}>
            {state.failed && <p className={css.cardFailed} role="status">{t('saveFailed')}</p>}
            <button
              type="button" className={css.linkBtn} style={{ marginRight: 'auto' }}
              disabled={relabel.running || relabel.available === false || state.dirty}
              title={relabel.available === false ? t('relabelUnavailable') : state.dirty ? t('unsaved') : undefined}
              onClick={() => { void runRelabel(false) }}
            >{relabel.running ? t('relabelRunning') : t('relabelDry')}</button>
            <button
              type="button" className={css.btn}
              disabled={relabel.running || relabel.available === false || state.dirty}
              title={relabel.available === false ? t('relabelUnavailable') : state.dirty ? t('unsaved') : undefined}
              onClick={() => { void runRelabel(true) }}
            >{t('relabel')}</button>
            <button type="button" className={css.btn} disabled={disabled} onClick={() => { face.addLabel() }}>{t('addLabel')}</button>
            <button type="button" className={css.btn} disabled={!state.dirty || state.saving} onClick={face.discard}>{t('discard')}</button>
            <button type="button" className={`${css.btn} ${css.btnPrimary}`} disabled={!state.dirty || state.invalid !== null || state.saving || disabled} onClick={face.save}>{t(state.saving ? 'saving' : 'save')}</button>
          </div>
          {relabel.output !== null && (
            <pre className={css.output} aria-label={t('relabelOutput')}>{relabel.output}</pre>
          )}
        </div>
      )}
    </li>
  )
}
