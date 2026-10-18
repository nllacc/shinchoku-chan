import { describe, expect, test } from "vitest"
import { buildCurve } from "../../src/scoring/curve"
import type { ScoreInput } from "../../src/scoring/score"

const DAY = 86_400_000
const base = (over: Partial<ScoreInput> = {}): ScoreInput => ({
  startedAt: 0, endsAt: 4 * DAY, dailyTarget: 1, records: [], final: null, ...over,
})

describe("buildCurve", () => {
  test("scoring/AC-1: 進捗率1.2と-0.1の記録は1と0として扱われる", () => {
    const c = buildCurve(base({ records: [{ at: DAY, permille: 1200 }, { at: 2 * DAY, permille: -100 }] }), [])
    expect(c.map((p) => p.y)).toEqual([0, 1, 0, 0])
  })

  test("scoring/AC-2: 起点と終点の間に記録が2件あるとき、曲線が4点を時刻順に結ぶ", () => {
    const c = buildCurve(base({ records: [{ at: 2 * DAY, permille: 800 }, { at: DAY, permille: 300 }] }), [])
    expect(c).toEqual([{ x: 0, y: 0 }, { x: 0.25, y: 0.3 }, { x: 0.5, y: 0.8 }, { x: 1, y: 0.8 }])
  })

  test("scoring/AC-3: 結果報告があれば終点がその値、なければ最後の記録の値", () => {
    const records = [{ at: DAY, permille: 300 }]
    expect(buildCurve(base({ records, final: { permille: 900 } }), []).at(-1)!.y).toBe(0.9)
    expect(buildCurve(base({ records }), []).at(-1)!.y).toBe(0.3)
  })

  test("scoring/AC-4: 記録も結果もない作業の終点は0", () => {
    expect(buildCurve(base(), []).at(-1)).toEqual({ x: 1, y: 0 })
  })

  test("補完点も時刻順に並ぶ", () => {
    const c = buildCurve(base({ records: [{ at: 3 * DAY, permille: 500 }] }), [{ x: 0.125, y: 0.1 }])
    expect(c.map((p) => p.x)).toEqual([0, 0.125, 0.75, 1])
  })
})
