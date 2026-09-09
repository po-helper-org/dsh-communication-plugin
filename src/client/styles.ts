/**
 * Стили раздела — обычный текст CSS, инжектируемый одним `<style>` в `document.head`
 * (см. `apply()` в index.tsx), а не CSS-модуль: сборка стороннего плагина не умеет
 * `*.module.css`, а вынесенный `lib/style.css` пакет не публикует, и вёрстка тихо ломается.
 *
 * Хеширования имён без CSS-модуля нет — коллизии предотвращает префикс `comm-` на каждом
 * селекторе через ту же карту, по которой строится разметка.
 *
 * Цвета — только токены харнесса `var(--dsw-alias-...)`: раздел живёт внутри чужой оболочки
 * и обязан следовать её теме.
 */
export const classNames = {
  navLayer: 'comm-nav-layer',
  navRail: 'comm-nav-rail',
  navBadge: 'comm-nav-badge',
  navBadgeLabel: 'comm-nav-badge-label',
  navCount: 'comm-nav-count',

  panel: 'comm-panel',
  header: 'comm-header',
  headerTitle: 'comm-header-title',
  iconButton: 'comm-icon-button',
  body: 'comm-body',
  notice: 'comm-notice',

  card: 'comm-card',
  cardMeta: 'comm-card-meta',
  cardText: 'comm-card-text',
  marks: 'comm-marks',
  mark: 'comm-mark',

  threadHead: 'comm-thread-head',
  threadLine: 'comm-thread-line',
  threadFocus: 'comm-thread-focus',
  linkList: 'comm-link-list',
  actions: 'comm-actions',
} as const

const c = classNames

export const styleText = `
.${c.navLayer} { display: flex; width: 100%; }
.${c.navRail} { justify-content: center; }
.${c.navBadge} {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 6px 10px; border: 0; border-radius: 8px; cursor: pointer;
  background: transparent; color: var(--dsw-alias-text-secondary);
}
.${c.navBadge}:hover { background: var(--dsw-alias-bg-hover); }
.${c.navBadge}[data-active] { background: var(--dsw-alias-bg-active); color: var(--dsw-alias-text-primary); }
.${c.navBadgeLabel} { font-size: 13px; }
.${c.navCount} {
  margin-left: auto; font-size: 11px; padding: 0 6px; border-radius: 10px;
  background: var(--dsw-alias-bg-active); color: var(--dsw-alias-text-primary);
}

.${c.panel} {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  background: var(--dsw-alias-bg-primary); color: var(--dsw-alias-text-primary);
}
.${c.header} {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; border-bottom: 1px solid var(--dsw-alias-border-primary);
}
.${c.headerTitle} { font-size: 15px; font-weight: 600; }
.${c.iconButton} {
  margin-left: auto; border: 0; background: transparent; cursor: pointer;
  color: var(--dsw-alias-text-secondary); padding: 4px 8px; border-radius: 6px;
}
.${c.iconButton}:hover { background: var(--dsw-alias-bg-hover); }
.${c.body} { flex: 1; overflow-y: auto; padding: 12px 16px; }
.${c.notice} { color: var(--dsw-alias-text-secondary); font-size: 13px; padding: 8px 0; }

.${c.card} {
  width: 100%; text-align: left; display: block; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-primary); border-radius: 10px;
  background: transparent; color: inherit; padding: 10px 12px; margin-bottom: 8px;
}
.${c.card}:hover { background: var(--dsw-alias-bg-hover); }
.${c.cardMeta} { display: flex; gap: 8px; font-size: 12px; color: var(--dsw-alias-text-secondary); }
.${c.cardText} { margin-top: 6px; font-size: 13px; line-height: 1.4; }
.${c.marks} { display: flex; gap: 6px; margin-left: auto; }
.${c.mark} {
  font-size: 11px; padding: 0 6px; border-radius: 10px;
  background: var(--dsw-alias-bg-active); color: var(--dsw-alias-text-secondary);
}

.${c.threadHead} { font-size: 12px; color: var(--dsw-alias-text-secondary); margin: 12px 0 6px; }
.${c.threadLine} { font-size: 13px; line-height: 1.5; padding: 4px 0; color: var(--dsw-alias-text-secondary); }
.${c.threadFocus} {
  font-size: 14px; line-height: 1.5; padding: 10px 12px; margin: 8px 0;
  border-left: 2px solid var(--dsw-alias-border-primary); color: var(--dsw-alias-text-primary);
}
.${c.linkList} { font-size: 12px; word-break: break-all; }
.${c.actions} { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--dsw-alias-border-primary); }
`
