// システムオプションの既定値と、環境変数（OPT_ で始まる名前）からの読み出し
import type { Env } from "./env"

export type Options = {
  triggersPerDay: number
  maxUsersPerTrigger: number
  checkinWindowMinutes: number
  penaltyPerMissingHundredths: number
  penaltyCapHundredths: number
  freeWindowRange: [number, number]
  premiumWindowRange: [number, number]
  maxWindows: number
  maxDailyTarget: number
  recheckIntervalHours: number
  priorityWeightPerMissedDay: number
  warmupDays: number
  replyGapMinSeconds: number
  replyGapMaxSeconds: number
  cheerMinReplies: number
  cheerEnabled: number
}

export const DEFAULT_OPTIONS: Options = {
  triggersPerDay: 8,
  maxUsersPerTrigger: 5,
  checkinWindowMinutes: 30,
  penaltyPerMissingHundredths: 200,
  penaltyCapHundredths: 1000,
  freeWindowRange: [480, 1200],
  premiumWindowRange: [360, 1380],
  maxWindows: 3,
  maxDailyTarget: 3,
  recheckIntervalHours: 24,
  priorityWeightPerMissedDay: 1,
  warmupDays: 30,
  replyGapMinSeconds: 5,
  replyGapMaxSeconds: 30,
  cheerMinReplies: 2,
  cheerEnabled: 1,
}

// 整数の項目の範囲（両端を含む）
const RANGES: Record<string, [number, number]> = {
  triggersPerDay: [1, 24],
  maxUsersPerTrigger: [1, 50],
  checkinWindowMinutes: [5, 120],
  penaltyPerMissingHundredths: [0, 10_000],
  penaltyCapHundredths: [0, 10_000],
  maxWindows: [0, 10],
  maxDailyTarget: [1, 10],
  recheckIntervalHours: [1, 168],
  priorityWeightPerMissedDay: [0, 10],
  warmupDays: [1, 90],
  replyGapMinSeconds: [0, 60],
  replyGapMaxSeconds: [0, 120],
  cheerMinReplies: [2, 50],
  cheerEnabled: [0, 1],
}

/** triggersPerDay → OPT_TRIGGERS_PER_DAY */
export function optionEnvName(name: string): string {
  return `OPT_${name.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`
}

const parseInteger = (raw: string): number | null =>
  /^-?\d+$/.test(raw.trim()) ? Number(raw.trim()) : null

const parseRange = (raw: string): [number, number] | null => {
  const m = /^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(raw)
  if (!m) return null
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a < b && b <= 1440 ? [a, b] : null
}

export function loadOptions(env: Env): Options {
  const result: Options = structuredClone(DEFAULT_OPTIONS)
  const warn = (name: string, raw: string) =>
    console.warn(`option ${optionEnvName(name)}=${JSON.stringify(raw)} is invalid; using the default`)
  const out = result as Record<string, unknown>
  for (const name of Object.keys(DEFAULT_OPTIONS)) {
    const raw = env[optionEnvName(name) as `OPT_${string}`]
    if (raw === undefined || raw === "") continue
    if (name === "freeWindowRange" || name === "premiumWindowRange") {
      const v = parseRange(raw)
      if (v) out[name] = v
      else warn(name, raw)
      continue
    }
    const v = parseInteger(raw)
    const range = RANGES[name] as [number, number]
    if (v !== null && v >= range[0] && v <= range[1]) out[name] = v
    else warn(name, raw)
  }
  // 返信の間隔の最大は最小以上にする
  if (result.replyGapMaxSeconds < result.replyGapMinSeconds) {
    console.warn("replyGapMaxSeconds is smaller than replyGapMinSeconds; using the minimum")
    result.replyGapMaxSeconds = result.replyGapMinSeconds
  }
  return result
}
