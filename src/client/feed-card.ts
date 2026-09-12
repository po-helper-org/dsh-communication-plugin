/**
 * Карточка настроек ленты на вкладке «Плагины»: сторона состояния.
 *
 * Правки копятся черновиком и уезжают в документ настроек ОДНОЙ операцией по
 * «Сохранить», а не на каждую клавишу: документ общий, каждая запись — поход на
 * узел с проверкой ревизии. Своей копии значений нет: источник — снимок
 * `SettingsScope`, черновик лежит поверх него, поэтому правка из другой
 * поверхности видна сразу, а несохранённое не пропадает.
 *
 * Рисунок взят с карточки poh-bft-plugin (`plugin/src/client/settings-card.ts`) —
 * тот же харнесс, та же служба. Отличие одно: метки — не строка, а список, и
 * они правятся черновиком целиком (`labels` — одно поле документа).
 */
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { isHashtag, slugOf, validateLabels, type FeedSettings, type LabelRule, type LabelSpec, type RuleKind } from '../feed-settings.js'

export const TEXT_FIELDS = ['clientUrl', 'instanceUrl', 'hostApiUrl', 'token'] as const
export type TextField = (typeof TEXT_FIELDS)[number]

export const DEFAULTS: FeedSettings = {
  clientUrl: 'http://127.0.0.1:8083',
  instanceUrl: 'https://feed.localtest.me',
  hostApiUrl: '',
  token: '',
  labels: [],
}

/** Снимок документа в нашу форму: чего нет — умолчание, лишнее — отброшено. */
export function resolveSettings(section: unknown): FeedSettings {
  const raw = (typeof section === 'object' && section !== null ? section : {}) as Partial<FeedSettings>
  const labels = Array.isArray(raw.labels)
    ? raw.labels.map((l) => ({
      id: typeof l?.id === 'string' ? l.id : '',
      title: typeof l?.title === 'string' ? l.title : '',
      rules: Array.isArray(l?.rules) ? l.rules.map((r) => ({ ...(r as LabelRule) })) : [],
    }))
    : []
  return {
    clientUrl: typeof raw.clientUrl === 'string' ? raw.clientUrl : DEFAULTS.clientUrl,
    instanceUrl: typeof raw.instanceUrl === 'string' ? raw.instanceUrl : DEFAULTS.instanceUrl,
    hostApiUrl: typeof raw.hostApiUrl === 'string' ? raw.hostApiUrl : '',
    token: typeof raw.token === 'string' ? raw.token : '',
    labels,
  }
}

export interface FeedCardState {
  available: boolean
  writable: boolean
  dirty: boolean
  /** Хотя бы одна метка не проходит проверку — сохранение заблокировано; текст причины. */
  invalid: string | null
  saving: boolean
  failed: boolean
  values: FeedSettings
}

export interface FeedCardFace {
  hooks: { feedCard: SnapshotStore<FeedCardState> }
  editText: (field: TextField, text: string) => void
  addLabel: () => void
  removeLabel: (index: number) => void
  editLabelTitle: (index: number, title: string) => void
  addRule: (index: number) => void
  removeRule: (index: number, rule: number) => void
  editRule: (index: number, rule: number, kind: RuleKind, value: string) => void
  discard: () => void
  save: () => void
}

type SettingsOp = { op: 'set'; path: string[]; value: unknown }

export class FeedCardController {
  private readonly store: SnapshotStore<FeedCardState>
  /** Черновик целиком; `null` — ничего не трогали. */
  private draft: FeedSettings | null = null
  private saving = false
  private failed = false
  private published: string

  constructor(private readonly scope: SettingsScope<FeedSettings>) {
    const initial = this.projection()
    this.published = JSON.stringify(initial)
    this.store = createSnapshotStore<FeedCardState>(initial)
    scope.subscribe(() => { this.publish() })
  }

  inject(): FeedCardFace {
    return {
      hooks: { feedCard: this.store },
      editText: (field, text) => { this.mutate((d) => { d[field] = text }) },
      addLabel: () => { this.mutate((d) => { d.labels.push({ id: '', title: '', rules: [{ contains: '' }] }) }) },
      removeLabel: (index) => { this.mutate((d) => { d.labels.splice(index, 1) }) },
      editLabelTitle: (index, title) => {
        this.mutate((d) => { const l = d.labels[index]; if (l) { l.title = title; l.id = slugOf(title) } })
      },
      addRule: (index) => { this.mutate((d) => { d.labels[index]?.rules.push({ contains: '' }) }) },
      removeRule: (index, rule) => { this.mutate((d) => { d.labels[index]?.rules.splice(rule, 1) }) },
      editRule: (index, rule, kind, value) => {
        this.mutate((d) => { const l = d.labels[index]; if (l && l.rules[rule]) l.rules[rule] = { [kind]: value } })
      },
      discard: () => { this.draft = null; this.failed = false; this.publish() },
      save: () => { this.save() },
    }
  }

  private stored(): FeedSettings {
    return resolveSettings(this.scope.getSnapshot().value)
  }

  private current(): FeedSettings {
    return this.draft ?? this.stored()
  }

  private mutate(change: (draft: FeedSettings) => void): void {
    this.draft ??= structuredClone(this.stored())
    change(this.draft)
    this.failed = false
    this.publish()
  }

  private publish(): void {
    const next = this.projection()
    const serialized = JSON.stringify(next)
    if (serialized === this.published) return
    this.published = serialized
    this.store.set(next)
  }

  private projection(): FeedCardState {
    const snapshot = this.scope.getSnapshot()
    const values = this.current()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: this.draft !== null && JSON.stringify(this.draft) !== JSON.stringify(this.stored()),
      invalid: this.problem(values.labels),
      saving: this.saving,
      failed: this.failed,
      values,
    }
  }

  /** Та же проверка, что на узле при записи, — чтобы кнопка гасла раньше отказа. */
  private problem(labels: LabelSpec[]): string | null {
    try {
      validateLabels(labels)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }

  private save(): void {
    if (this.saving || this.draft === null) return
    const stored = this.stored()
    const draft = this.draft
    const ops: SettingsOp[] = []
    for (const field of TEXT_FIELDS) {
      if (draft[field] !== stored[field]) ops.push({ op: 'set', path: [field], value: draft[field].trim() })
    }
    const labels = draft.labels.map((l) => ({ id: l.id.trim().toLowerCase(), title: l.title.trim(), rules: l.rules }))
    if (JSON.stringify(labels) !== JSON.stringify(stored.labels)) ops.push({ op: 'set', path: ['labels'], value: labels })
    if (ops.length === 0) { this.draft = null; this.publish(); return }
    const expected: FeedSettings = { ...draft, labels }
    for (const field of TEXT_FIELDS) expected[field] = expected[field].trim()

    this.saving = true
    this.failed = false
    this.publish()
    void this.scope.mutate(ops).then(
      () => { this.settle(expected) },
      () => { this.saving = false; this.failed = true; this.publish() },
    )
  }

  /**
   * Отказ узла (устаревшая ревизия, отвергнутое значение — например, сломанная
   * метка, которую не пропустил `validate`) не приходит исключением: скоуп гасит
   * его и перечитывает документ. Поэтому судим по результату: совпало ли то, что
   * в документе, с тем, что писали. Не совпало — черновик остаётся.
   */
  private settle(expected: FeedSettings): void {
    this.saving = false
    const applied = JSON.stringify(this.stored()) === JSON.stringify(expected)
    this.failed = !applied
    if (applied) this.draft = null
    this.publish()
  }
}

export { isHashtag }
