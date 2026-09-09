/**
 * Сводка по задержке. Считается по тому, что заявка и так несёт: время отправки в канале
 * и время попадания в базу. Отдельной телеметрии для этого не заводится.
 */
export interface LatencySummary {
  count: number
  min: number
  p50: number
  p90: number
  max: number
  /** Сколько заявок вышло за бюджет — те самые, что помечаются пришедшими с задержкой. */
  overBudget: number
  budgetMs: number
}

/** Перцентиль по ближайшему рангу: на выборке в десяток замеров интерполяция лжёт. */
export function percentile(sorted: readonly number[], share: number): number {
  if (sorted.length === 0) return 0
  const rank = Math.ceil(share * sorted.length)
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1]!
}

export function summarize(samples: readonly number[], budgetMs = 5 * 60 * 1000): LatencySummary {
  const sorted = [...samples].sort((left, right) => left - right)
  return {
    count: sorted.length,
    min: sorted.length === 0 ? 0 : sorted[0]!,
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    max: sorted.length === 0 ? 0 : sorted[sorted.length - 1]!,
    overBudget: sorted.filter((value) => value > budgetMs).length,
    budgetMs,
  }
}

/** Строка отчёта: миллисекунды до секунды, чтобы читалось глазами, а не считалось в уме. */
export function formatSummary(summary: LatencySummary, title: string): string {
  if (summary.count === 0) return `${title}: замеров нет`
  const sec = (ms: number) => `${(ms / 1000).toFixed(2)} с`
  return [
    `${title}: ${summary.count} замеров`,
    `  медиана ${sec(summary.p50)}   p90 ${sec(summary.p90)}   максимум ${sec(summary.max)}   минимум ${sec(summary.min)}`,
    `  за бюджетом ${sec(summary.budgetMs)}: ${summary.overBudget}`,
  ].join('\n')
}
