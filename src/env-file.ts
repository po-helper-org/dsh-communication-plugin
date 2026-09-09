/**
 * Чтение `.env`.
 *
 * Разбор свой, а не `process.loadEnvFile`: тот кладёт значения в `process.env` всего
 * процесса, то есть внутри харнесса — в окружение, видимое любому его инструменту.
 * Ключ приложения Telegram остаётся значением, которое читает только этот раздел.
 */
import { readFileSync } from 'node:fs'

/** Строки вида `KEY=value`, `export KEY=value`, с кавычками и комментариями. */
export function parseEnvFile(text: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (match === null) continue
    const [, key, rest] = match as unknown as [string, string, string]
    const quoted = /^(['"])([\s\S]*)\1$/.exec(rest.trim())
    // Комментарий отрезается только у незакавыченного значения: внутри кавычек `#` — данные.
    values[key] = quoted === null
      ? rest.replace(/\s+#.*$/, '').trim()
      : (quoted as unknown as [string, string, string])[2]
  }
  return values
}

/** Файла нет или он не читается — это не ошибка: переменные могли прийти из окружения. */
export function readEnvFile(path: string): Record<string, string> {
  try {
    return parseEnvFile(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

/** Окружение процесса важнее файла: разовый запуск с переменной в строке должен побеждать. */
export function mergeEnv(
  file: Record<string, string>,
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const merged: NodeJS.ProcessEnv = { ...file }
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && value !== '') merged[key] = value
  }
  return merged
}
