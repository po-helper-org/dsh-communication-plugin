/**
 * Стили раздела — обычный текст CSS, инжектируемый одним `<style>` в `document.head`
 * (см. `apply()` в index.tsx), а не CSS-модуль: сборка стороннего плагина не умеет
 * `*.module.css`, а вынесенный `lib/style.css` пакет не публикует, и вёрстка тихо ломается.
 *
 * Хеширования имён без CSS-модуля нет — коллизии предотвращает префикс `comm-` на каждом
 * селекторе через ту же карту, по которой строится разметка.
 *
 * Цвета — только токены харнесса `var(--dsw-alias-...)`: раздел живёт внутри чужой оболочки
 * и обязан следовать её теме. Раскладка перенесена из `docs/ui/inbox-prototype.html`.
 */
export const classNames = {
  navLayer: 'comm-nav-layer',
  navRail: 'comm-nav-rail',
  navBadge: 'comm-nav-badge',
  navBadgeLabel: 'comm-nav-badge-label',
  navCount: 'comm-nav-count',

  panel: 'comm-panel',
  columns: 'comm-columns',
  routes: 'comm-routes',

  list: 'comm-list',
  listTop: 'comm-list-top',
  listTitle: 'comm-list-title',
  pill: 'comm-pill',
  icons: 'comm-icons',
  iconBtn: 'comm-icon-btn',
  tabs: 'comm-tabs',
  tab: 'comm-tab',
  tabCount: 'comm-tab-count',
  rows: 'comm-rows',
  row: 'comm-row',
  ava: 'comm-ava',
  avaGray: 'comm-ava-gray',
  rowMain: 'comm-row-main',
  rowSource: 'comm-row-source',
  rowHead: 'comm-row-head',
  rowName: 'comm-row-name',
  rowWhen: 'comm-row-when',
  rowText: 'comm-row-text',
  rowBottom: 'comm-row-bottom',
  listEnd: 'comm-list-end',
  filterBar: 'comm-filter-bar',

  lb: 'comm-lb',
  lbX: 'comm-lb-x',

  thread: 'comm-thread',
  threadTop: 'comm-thread-top',
  threadWho: 'comm-thread-who',
  threadActions: 'comm-thread-actions',
  split: 'comm-split',
  turns: 'comm-turns',
  turn: 'comm-turn',
  turnFocus: 'comm-turn-focus',
  bubble: 'comm-bubble',
  turnMeta: 'comm-turn-meta',
  event: 'comm-event',
  composer: 'comm-composer',
  composerNote: 'comm-composer-note',

  context: 'comm-context',
  ctxTop: 'comm-ctx-top',
  card: 'comm-card',
  cardId: 'comm-card-id',
  cardRows: 'comm-card-rows',
  section: 'comm-section',
  sectionBody: 'comm-section-body',
  field: 'comm-field',
  labels: 'comm-labels',
  addLabel: 'comm-add-label',
  picker: 'comm-picker',
  swatch: 'comm-swatch',
  tick: 'comm-tick',
  facts: 'comm-facts',
  note: 'comm-note',
  links: 'comm-links',
  collector: 'comm-collector',
  dotLive: 'comm-dot-live',
  notice: 'comm-notice',
} as const

const c = classNames

export const styleText = `
.${c.navLayer} { display: flex; width: 100%; }
.${c.navRail} { justify-content: center; }
.${c.navBadge} {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 6px 10px; border: 0; border-radius: 8px; cursor: pointer;
  background: transparent; color: var(--dsw-alias-label-secondary);
}
.${c.navBadge}:hover { background: var(--dsw-alias-interactive-bg-hover); }
.${c.navBadge}[data-active] { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); }
.${c.navBadgeLabel} { font-size: 13px; }
.${c.navCount} {
  margin-left: auto; font-size: 11px; padding: 0 6px; border-radius: 10px;
  background: var(--dsw-alias-button-info-fill); color: #fff; font-variant-numeric: tabular-nums;
}

.${c.panel} {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  font-size: 13px;

  /* Палитра лейблов объявлена один раз здесь: её читают и чип, и образец в справочнике,
     поэтому цвет лейбла не может разъехаться между двумя местами. */
  --comm-lb-answer: #4176e6;
  --comm-lb-context: #229684;
  --comm-lb-sprint: #f59e0b;
  --comm-lb-quarter: #8b5cf6;
  --comm-lb-noise: #949ba3;
  --comm-lb-client: #ec4876;
}

.${c.columns} { flex: 1; display: grid; grid-template-columns: 340px minmax(0, 1fr) 280px; min-height: 0; }
@media (max-width: 1180px) {
  .${c.columns} { grid-template-columns: 320px minmax(0, 1fr); }
  .${c.context} { display: none; }
}

/* ── Лента ─────────────────────────────────────────────────────────────── */

.${c.list} {
  border-right: 1px solid var(--dsw-alias-border-l2);
  display: grid; grid-template-rows: auto auto 1fr; min-height: 0;
}

.${c.listTop} { display: flex; align-items: center; gap: 10px; padding: 16px 16px 12px; }
.${c.listTitle} { font-size: 19px; font-weight: 600; letter-spacing: -0.02em; }
.${c.pill} {
  font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-overlay); border-radius: 6px; padding: 1px 8px;
}
.${c.icons} { margin-left: auto; display: flex; gap: 4px; }
.${c.iconBtn} {
  width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent;
  color: var(--dsw-alias-label-tertiary); cursor: pointer; display: grid; place-items: center; font-size: 15px;
}
.${c.iconBtn}:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }

.${c.tabs} { display: flex; gap: 20px; padding: 0 16px; border-bottom: 1px solid var(--dsw-alias-border-l2); }
.${c.tab} {
  display: flex; align-items: center; gap: 7px; padding: 6px 0 10px; border: 0; background: transparent;
  font-size: 14px; color: var(--dsw-alias-label-secondary); cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.${c.tabCount} {
  font-size: 12px; line-height: 17px; color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-bg-overlay); border-radius: 5px; padding: 0 6px; font-variant-numeric: tabular-nums;
}
.${c.tab}[aria-selected="true"] {
  color: var(--dsw-alias-button-info-fill);
  border-bottom-color: var(--dsw-alias-button-info-fill);
}

.${c.rows} { overflow-y: auto; min-height: 0; }
.${c.row} {
  width: 100%; display: grid; grid-template-columns: 40px 1fr; gap: 12px;
  padding: 14px 16px; border: 0; border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: transparent; color: inherit; cursor: pointer; text-align: left;
}
.${c.row}:hover { background: var(--dsw-alias-interactive-bg-hover); }
.${c.row}[aria-current="true"] { background: var(--dsw-alias-bg-layer-1); }

.${c.ava} {
  width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
  font-size: 13px; font-weight: 600; color: #fff; background: var(--dsw-alias-button-info-fill);
  align-self: start; margin-top: 18px;
}
.${c.avaGray} { background: var(--dsw-alias-label-tertiary); }

.${c.rowMain} { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.${c.rowSource} { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.${c.rowHead} { display: flex; align-items: baseline; gap: 10px; }
.${c.rowName} {
  font-size: 15px; font-weight: 600; letter-spacing: -0.01em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.${c.rowWhen} {
  margin-left: auto; font-size: 12px; color: var(--dsw-alias-label-tertiary);
  white-space: nowrap; font-variant-numeric: tabular-nums;
}
.${c.rowText} {
  font-size: 14px; color: var(--dsw-alias-label-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.${c.rowBottom} { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 3px; }
.${c.rowBottom}:empty { display: none; }
.${c.listEnd} { padding: 22px 16px 28px; text-align: center; font-size: 13px; color: var(--dsw-alias-label-tertiary); }
.${c.filterBar} {
  display: flex; align-items: center; gap: 8px; padding: 8px 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l1); font-size: 12px; color: var(--dsw-alias-label-tertiary);
}
.${c.filterBar} button { border: 0; background: transparent; color: var(--dsw-alias-button-info-fill); cursor: pointer; }

/* Лейбл: смысл несёт цветная точка, чип остаётся нейтральным. */
.${c.lb} {
  display: inline-flex; align-items: center; gap: 6px; font-size: 12px; line-height: 20px;
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-overlay);
  border: 0; border-radius: 6px; padding: 0 8px 0 7px; white-space: nowrap;
}
.${c.lb}::before {
  content: ""; width: 7px; height: 7px; border-radius: 50%;
  background: var(--comm-lb, var(--dsw-alias-label-tertiary)); flex: none;
}
button.${c.lb} { cursor: pointer; }
button.${c.lb}:hover { color: var(--dsw-alias-label-primary); }
.${c.lb}[data-tone="answer"] { --comm-lb: var(--comm-lb-answer); }
.${c.lb}[data-tone="context"] { --comm-lb: var(--comm-lb-context); }
.${c.lb}[data-tone="sprint"] { --comm-lb: var(--comm-lb-sprint); }
.${c.lb}[data-tone="quarter"] { --comm-lb: var(--comm-lb-quarter); }
.${c.lb}[data-tone="noise"] { --comm-lb: var(--comm-lb-noise); }
.${c.lb}[data-tone="client"] { --comm-lb: var(--comm-lb-client); }
.${c.lb}[data-tone="system"] { --comm-lb: var(--dsw-alias-state-warn-primary); }
.${c.lbX} {
  border: 0; background: transparent; color: var(--dsw-alias-label-tertiary);
  cursor: pointer; font-size: 13px; line-height: 1; padding: 0 0 0 2px;
}
.${c.lbX}:hover { color: var(--dsw-alias-label-primary); }

/* ── Диалог ────────────────────────────────────────────────────────────── */

.${c.thread} { display: grid; grid-template-rows: auto 1fr auto; min-height: 0; }
.${c.threadTop} {
  display: flex; align-items: center; gap: 12px; padding: 12px 20px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
.${c.threadTop} .${c.ava} { width: 36px; height: 36px; margin-top: 0; font-size: 12px; }
.${c.threadWho} { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.${c.threadWho} b { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.${c.threadWho} span { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.${c.threadActions} { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.${c.split} {
  display: flex; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  overflow: hidden; background: var(--dsw-alias-bg-layer-1);
}
.${c.split} button { border: 0; background: transparent; color: inherit; padding: 6px 12px; cursor: pointer; font-size: 13px; }
.${c.split} button:hover { background: var(--dsw-alias-interactive-bg-hover); }

.${c.turns} {
  overflow-y: auto; min-height: 0; padding: 20px 24px;
  display: flex; flex-direction: column; gap: 14px; background: var(--dsw-alias-bg-layer-1);
}
.${c.turn} { display: flex; flex-direction: column; gap: 4px; max-width: 640px; }
.${c.bubble} {
  background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px; padding: 11px 15px; white-space: pre-wrap; line-height: 1.5; font-size: 14px;
}
.${c.turnFocus} .${c.bubble} { border-color: var(--dsw-alias-button-info-fill); }
.${c.turnMeta} { font-size: 11px; color: var(--dsw-alias-label-tertiary); padding: 0 4px; }
.${c.event} {
  align-self: center; font-size: 12px; color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px; padding: 3px 12px;
}

.${c.composer} { border-top: 1px solid var(--dsw-alias-border-l2); padding: 12px 20px; }
.${c.composerNote} { font-size: 12px; color: var(--dsw-alias-label-tertiary); margin: 0; }

/* ── Контекст ──────────────────────────────────────────────────────────── */

.${c.context} {
  border-left: 1px solid var(--dsw-alias-border-l2); overflow-y: auto; min-height: 0;
  display: flex; flex-direction: column;
}
.${c.ctxTop} {
  display: flex; align-items: center; padding: 12px 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l2); font-size: 14px; font-weight: 600;
}
.${c.card} {
  padding: 16px; display: flex; flex-direction: column; gap: 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
.${c.cardId} { display: flex; align-items: center; gap: 12px; }
.${c.cardId} .${c.ava} { width: 44px; height: 44px; margin-top: 0; font-size: 14px; }
.${c.cardId} b { font-size: 15px; font-weight: 600; }
.${c.cardRows} { display: flex; flex-direction: column; gap: 7px; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.${c.cardRows} div { display: flex; gap: 9px; align-items: baseline; }
.${c.cardRows} span:first-child { color: var(--dsw-alias-label-tertiary); width: 74px; flex: none; }
/* Значение переносится само: длинный идентификатор иначе наезжает на подпись слева. */
.${c.cardRows} span:last-child { flex: 1; min-width: 0; overflow-wrap: anywhere; }

.${c.section} { border-bottom: 1px solid var(--dsw-alias-border-l2); }
.${c.section} > summary {
  display: flex; align-items: center; padding: 12px 16px;
  font-size: 13px; font-weight: 600; cursor: pointer; list-style: none;
}
.${c.section} > summary::-webkit-details-marker { display: none; }
.${c.section} > summary::after { content: "+"; margin-left: auto; color: var(--dsw-alias-label-tertiary); font-size: 15px; }
.${c.section}[open] > summary::after { content: "−"; }
.${c.sectionBody} { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 14px; }

.${c.field} { display: flex; flex-direction: column; gap: 6px; }
.${c.field} > span { font-size: 12px; color: var(--dsw-alias-label-secondary); font-weight: 500; }
.${c.labels} { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.${c.addLabel} {
  font-size: 12px; color: var(--dsw-alias-button-info-fill); background: transparent;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; padding: 1px 8px; cursor: pointer;
}
.${c.picker} {
  display: flex; flex-direction: column; gap: 2px; padding: 8px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsw-alias-bg-base);
}
.${c.picker} button {
  display: flex; align-items: center; gap: 9px; padding: 6px 8px; border: 0; border-radius: 7px;
  background: transparent; color: inherit; cursor: pointer; font-size: 13px;
}
.${c.picker} button:hover { background: var(--dsw-alias-interactive-bg-hover); }
.${c.swatch} { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.${c.tick} { margin-left: auto; color: var(--dsw-alias-button-info-fill); }

.${c.facts} { display: flex; flex-direction: column; gap: 7px; font-size: 13px; margin: 0; }
.${c.facts} div { display: flex; gap: 10px; }
.${c.facts} dt { color: var(--dsw-alias-label-tertiary); min-width: 78px; flex: none; }
.${c.facts} dd { margin: 0; }
.${c.note} { font-size: 13px; color: var(--dsw-alias-label-secondary); line-height: 1.5; margin: 0; }
.${c.links} { font-size: 12px; word-break: break-all; color: var(--dsw-alias-button-info-fill); }
.${c.notice} { padding: 16px; font-size: 13px; color: var(--dsw-alias-label-secondary); }

.${c.collector} {
  margin-top: auto; display: flex; align-items: center; gap: 7px; font-size: 11px;
  color: var(--dsw-alias-label-tertiary); padding: 12px 16px; border-top: 1px solid var(--dsw-alias-border-l1);
}
.${c.dotLive} { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); }

/* Разметка потока растёт с числом чатов; без потолка она сожмёт колонки Inbox до нуля. */
.${c.routes} {
  flex: none; max-height: 35%; overflow-y: auto; font-size: 13px;
  padding: 12px 16px; border-top: 1px solid var(--dsw-alias-border-l1);
}
.${c.routes} h3 { margin: 0 0 4px; font-size: 13px; }
.${c.routes} p { margin: 0 0 8px; color: var(--dsw-alias-label-secondary); }
.${c.routes} table { border-collapse: collapse; width: 100%; }
.${c.routes} th, .${c.routes} td { text-align: left; padding: 3px 8px 3px 0; }
.${c.routes} th { color: var(--dsw-alias-label-tertiary); font-weight: 500; }
`
