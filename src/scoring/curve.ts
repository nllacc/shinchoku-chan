import type { ScoreInput } from "./score"

export type Point = { x: number; y: number }

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

// 起点・受理された記録・補完点・終点を、時刻順に結ぶ点列を作る
export function buildCurve(input: ScoreInput, extra: Point[]): Point[] {
  const span = input.endsAt - input.startedAt
  const real = input.records
    .filter((r) => r.at >= input.startedAt && r.at <= input.endsAt)
    .sort((a, b) => a.at - b.at)
    .map((r) => ({ x: (r.at - input.startedAt) / span, y: clamp01(r.permille / 1000) }))
  const last = real.length > 0 ? real[real.length - 1]!.y : 0
  const end = input.final ? clamp01(input.final.permille / 1000) : last
  // 同じ x の点は並べた順(安定整列)に隣接する
  return [{ x: 0, y: 0 }, ...real, ...extra, { x: 1, y: end }].sort((a, b) => a.x - b.x)
}
