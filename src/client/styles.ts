/**
 * Стили раздела — обычный текст CSS, инжектируемый одним `<style>` в `document.head`
 * (см. `apply()` в index.tsx), а не CSS-модуль: сборка стороннего плагина не умеет
 * `*.module.css`, а вынесенный `lib/style.css` пакет не публикует, и вёрстка тихо ломается.
 *
 * Хеширования имён без CSS-модуля нет — коллизии предотвращает префикс `comm-` на каждом
 * селекторе через ту же карту, по которой строится разметка.
 *
 * Цвета — только токены харнесса `var(--dsw-alias-...)`: раздел живёт внутри чужой оболочки
 * и обязан следовать её теме. Раскладка столбца и карточки перенесена из
 * `docs/ui/feed-frame-prototype.html`; карточка повторяет `PluginCard.module.css` харнесса.
 */
export const classNames = {
  navLayer: 'comm-nav-layer',
  navRail: 'comm-nav-rail',
  navBadge: 'comm-nav-badge',
  navBadgeLabel: 'comm-nav-badge-label',
  navCount: 'comm-nav-count',

  column: 'comm-column',
  head: 'comm-head',
  headTitle: 'comm-head-title',
  headLink: 'comm-head-link',
  iconBtn: 'comm-icon-btn',
  pills: 'comm-pills',
  pill: 'comm-pill',
  frame: 'comm-frame',
  hint: 'comm-hint',

  card: 'comm-card',
  cardHead: 'comm-card-head',
  cardText: 'comm-card-text',
  cardName: 'comm-card-name',
  cardDesc: 'comm-card-desc',
  cardPending: 'comm-card-pending',
  cardChevron: 'comm-card-chevron',
  cardBody: 'comm-card-body',
  cardFoot: 'comm-card-foot',
  cardNote: 'comm-card-note',
  cardFailed: 'comm-card-failed',
  btn: 'comm-btn',
  btnPrimary: 'comm-btn-primary',
  linkBtn: 'comm-link-btn',

  fields: 'comm-fields',
  field: 'comm-field',
  fieldLabel: 'comm-field-label',
  fieldHint: 'comm-field-hint',
  fieldRow: 'comm-field-row',
  status: 'comm-status',
  subhead: 'comm-subhead',

  label: 'comm-label',
  labelHead: 'comm-label-head',
  labelTag: 'comm-label-tag',
  rule: 'comm-rule',
  ruleOr: 'comm-rule-or',
  addRule: 'comm-add-rule',
  output: 'comm-output',
} as const

const c = classNames

export const styleText = `
/* Кнопка раздела — геометрия соседних разделов харнесса (poh-bft-plugin, Panel.styles.ts):
   42px высоты, 12px радиус, иконка 16 + 8px до подписи; в рейке — круг 36px. */
.${c.navLayer} { position: relative; flex: none; display: flex; align-items: center; width: 100%; height: 42px; margin: 8px 0 0; }
.${c.navBadge} {
  display: inline-flex; align-items: center; gap: 8px;
  width: calc(100% + 4px); height: 42px; margin: 0 -2px; padding: 0 10px 0 8px;
  border: none; border-radius: 12px; background: transparent;
  color: var(--dsw-alias-label-primary); font-family: inherit; font-size: 14px; cursor: pointer; overflow: hidden;
}
.${c.navBadge}:hover { background: var(--dsw-alias-interactive-bg-hover); }
.${c.navBadge}[data-active] { background: var(--dsw-alias-interactive-bg-hover); }
.${c.navBadgeLabel} { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.${c.navCount} {
  margin-left: auto; font-size: 11px; padding: 0 6px; border-radius: 10px;
  background: var(--dsw-static-red-500); color: #fff; font-variant-numeric: tabular-nums;
}
.${c.navLayer}.${c.navRail} { width: 36px; height: 36px; margin: 0; }
.${c.navRail} .${c.navBadge} { justify-content: center; gap: 0; width: 36px; height: 36px; padding: 0; border-radius: 50%; }

/* ── Правый столбец с лентой ──────────────────────────────────────────── */

/* Слой оверлея сквозной для кликов; столбец сам возвращает себе события. */
.${c.column} {
  position: absolute; top: 0; right: 0; bottom: 0; width: 420px;
  display: flex; flex-direction: column; pointer-events: auto;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  border-left: 1px solid var(--dsw-alias-border-l2); font-size: 13px;
}
.${c.head} { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.${c.headTitle} { font-weight: 600; }
.${c.headLink} { margin-left: auto; font-size: 12px; color: var(--dsw-alias-label-caption); text-decoration: none; }
.${c.headLink}:hover { color: var(--dsw-alias-label-primary); }
.${c.iconBtn} { width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; font-size: 16px; }
.${c.iconBtn}:hover { background: var(--dsw-alias-interactive-bg-hover); }
/* Пилюли переносятся, а не прокручиваются: метка за краем — фильтр, которого как бы нет. */
.${c.pills} { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.${c.pills} .${c.iconBtn} { margin-left: auto; }
.${c.pill} {
  border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: inherit; font: inherit; font-size: 12px;
  border-radius: 999px; padding: 3px 10px; cursor: pointer; white-space: nowrap;
}
.${c.pill}[data-active] { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary-foreground); border-color: transparent; }
.${c.pill}[data-empty] { opacity: .45; }
.${c.frame} { flex: 1; width: 100%; border: 0; background: var(--dsw-alias-bg-layer-1); }
.${c.hint} { font-size: 12px; color: var(--dsw-alias-label-caption); padding: 8px 12px; border-top: 1px solid var(--dsw-alias-border-l1); line-height: 1.4; }

/* ── Карточка в «Настройки → Плагины» (по PluginCard.module.css харнесса) ── */

.${c.card} { list-style: none; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; background: var(--dsw-alias-bg-layer-3); font-size: 13px; }
.${c.card}:hover { border-color: var(--dsw-alias-label-dimmed); }
.${c.card}[data-open] { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-label-dimmed); }
.${c.cardHead} {
  width: 100%; border: 0; background: none; font: inherit; color: inherit; text-align: left; cursor: pointer;
  display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px;
}
.${c.cardHead}:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.${c.cardText} { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.${c.cardName} { font-size: 15px; font-weight: 600; line-height: 1.4; color: var(--dsw-alias-label-primary); }
.${c.cardDesc} { font-size: 13px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.${c.cardPending} { font-size: 12px; color: var(--dsw-static-amber-500); white-space: nowrap; }
.${c.cardChevron} { flex: none; color: var(--dsw-alias-label-tertiary); transition: transform .16s; }
.${c.card}[data-open] .${c.cardChevron} { transform: rotate(180deg); }
.${c.cardBody} { border-top: 1px solid var(--dsw-alias-border-l2); margin: 0 16px; padding-bottom: 8px; }
.${c.cardFoot} { display: flex; align-items: center; gap: 8px; justify-content: flex-end; padding: 12px 0 6px; flex-wrap: wrap; }
.${c.cardNote} { margin: 12px 0 0; font-size: 12px; color: var(--dsw-alias-label-caption); line-height: 1.5; }
.${c.cardFailed} { margin: 0; font-size: 12px; color: var(--dsw-static-red-500); flex-basis: 100%; }
.${c.btn} { border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: inherit; font: inherit; border-radius: 8px; padding: 6px 12px; cursor: pointer; }
.${c.btn}:hover { background: var(--dsw-alias-interactive-bg-hover); }
.${c.btn}:disabled { opacity: .45; cursor: default; }
.${c.btnPrimary} { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary-foreground); border-color: transparent; }
.${c.linkBtn} { background: none; border: 0; color: var(--dsw-alias-label-caption); font: inherit; cursor: pointer; padding: 4px 0; }
.${c.linkBtn}:hover { color: var(--dsw-alias-label-primary); }
.${c.linkBtn}:disabled { opacity: .45; cursor: default; }

.${c.fields} { display: flex; flex-direction: column; gap: 10px; padding: 12px 0 4px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.${c.field} { display: grid; grid-template-columns: 200px 1fr; gap: 12px; align-items: start; }
.${c.fieldLabel} { font-size: 13px; padding-top: 6px; }
.${c.fieldHint} { display: block; font-size: 12px; color: var(--dsw-alias-label-caption); margin-top: 2px; line-height: 1.4; }
.${c.fieldRow} { display: flex; gap: 6px; }
.${c.fieldRow} input { flex: 1; }
.${c.card} input, .${c.card} select, .${c.card} textarea {
  font: inherit; color: inherit; background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; padding: 5px 8px; width: 100%; box-sizing: border-box;
}
.${c.card} input:focus, .${c.card} select:focus, .${c.card} textarea:focus { outline: 2px solid var(--dsw-alias-brand-primary-new-colorprimary-new-color); outline-offset: -1px; }
.${c.status} { font-size: 12px; margin-top: 4px; }
.${c.status}[data-ok] { color: var(--dsw-static-green-500); }
.${c.status}[data-bad] { color: var(--dsw-static-red-500); }
.${c.subhead} { font-size: 13px; font-weight: 600; margin: 14px 0 0; }

.${c.label} { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; padding: 10px 12px; margin-top: 10px; }
.${c.labelHead} { display: flex; align-items: center; gap: 8px; }
.${c.labelHead} input { flex: 1; width: auto; }
.${c.labelTag} { color: var(--dsw-alias-label-caption); font-family: var(--ds-font-family-code); font-size: 12px; white-space: nowrap; }
.${c.rule} { display: flex; align-items: flex-start; gap: 6px; margin-top: 6px; padding-left: 12px; }
.${c.ruleOr} { width: 34px; flex: none; font-size: 11px; color: var(--dsw-alias-label-caption); text-align: right; padding-top: 8px; }
.${c.rule} select { flex: none; width: auto; }
.${c.rule} input, .${c.rule} textarea { flex: 1; min-width: 0; }
.${c.rule} textarea { resize: vertical; min-height: 54px; line-height: 1.4; }
.${c.addRule} { margin-left: 46px; }
.${c.output} {
  margin: 8px 0 0; padding: 8px 10px; max-height: 240px; overflow: auto; white-space: pre-wrap;
  font-family: var(--ds-font-family-code); font-size: 12px; line-height: 1.45;
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
}
`
