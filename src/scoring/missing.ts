import { clamp01, type Point } from "./curve"
import type { ScoreInput, ScoreOptions } from "./score"

const DAY = 24 * 60 * 60 * 1000

// 日ごとの不足回数の合計(欠測)と、記録が0件の日の補完点を求める。
// 記録は at の昇順に整列済みであること
export function fillMissing(
  input: ScoreInput,
  options: ScoreOptions,
): { points: Point[]; missingCount: number; penaltyHundredths: number } {
  const days = Math.ceil((input.endsAt - input.startedAt) / DAY)
  const sorted = [...input.records].sort((a, b) => a.at - b.at)
  const points: Point[] = []
  let missing = 0
  let i = 0 // 整列済みの配列を1回で走査する
  let prev: { at: number; permille: number } | undefined
  for (let k = 0; k < days; k++) {
    const from = input.startedAt + k * DAY
    const to = from + DAY
    while (i < sorted.length && sorted[i]!.at < from) prev = sorted[i++]
    let count = 0
    while (i < sorted.length && sorted[i]!.at < to) {
      prev = sorted[i++]
      count++
    }
    missing += Math.max(0, input.dailyTarget - count)
    if (count > 0) continue
    // 直前は i の手前、直後は i の位置にある(この日の記録は0件)
    const before = prev
    const after = sorted[i]
    const ys = [before, after].filter((r) => r !== undefined).map((r) => clamp01(r!.permille / 1000))
    const y = ys.length === 0 ? 0 : ys.reduce((a, b) => a + b, 0) / ys.length
    points.push({ x: (k + 0.5) / days, y })
  }
  const penalty = Math.min(options.penaltyCapHundredths, missing * options.penaltyPerMissingHundredths)
  return { points, missingCount: missing, penaltyHundredths: penalty }
}
