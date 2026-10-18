import { describe, expect, test } from "vitest"
import { fillMissing } from "../../src/scoring/missing"
import { DEFAULT_SCORE_OPTIONS, type ScoreInput } from "../../src/scoring/score"

const DAY = 86_400_000
const base = (over: Partial<ScoreInput> = {}): ScoreInput => ({
  startedAt: 0, endsAt: 3 * DAY, dailyTarget: 1, records: [], final: null, ...over,
})

describe("fillMissing", () => {
  test("scoring/AC-8: 3日の作業で2日目に記録がないとき、経過割合0.5に補完点が置かれる", () => {
    const r = fillMissing(base({ records: [{ at: 0.5 * DAY, permille: 200 }, { at: 2.5 * DAY, permille: 600 }] }), DEFAULT_SCORE_OPTIONS)
    expect(r.points).toHaveLength(1)
    expect(r.points[0]!.x).toBeCloseTo(0.5, 10)
  })

  test("scoring/AC-9: 補完点の前後の実記録が0.2と0.6のとき、補完点は0.4", () => {
    const r = fillMissing(base({ records: [{ at: 0.5 * DAY, permille: 200 }, { at: 2.5 * DAY, permille: 600 }] }), DEFAULT_SCORE_OPTIONS)
    expect(r.points[0]!.y).toBeCloseTo(0.4, 10)
  })

  test("scoring/AC-10: 補完点の前に実記録がないとき、直後の値になる(後ろだけでも同様)", () => {
    const r = fillMissing(base({ records: [{ at: 1.5 * DAY, permille: 700 }] }), DEFAULT_SCORE_OPTIONS)
    expect(r.points[0]).toMatchObject({ y: 0.7 })
    const r2 = fillMissing(base({ records: [{ at: 0.5 * DAY, permille: 300 }] }), DEFAULT_SCORE_OPTIONS)
    expect(r2.points.map((p) => p.y)).toEqual([0.3, 0.3])
  })

  test("記録が全くなければ補完点は0", () => {
    expect(fillMissing(base(), DEFAULT_SCORE_OPTIONS).points.map((p) => p.y)).toEqual([0, 0, 0])
  })

  test("scoring/AC-11: 日の必須回数が3で記録が1件の日は不足が2になる", () => {
    const r = fillMissing(base({ endsAt: DAY, dailyTarget: 3, records: [{ at: 1000, permille: 100 }] }), DEFAULT_SCORE_OPTIONS)
    expect(r.missingCount).toBe(2)
    expect(r.points).toHaveLength(0) // 1件以上ある日には補完点を置かない
  })

  test("記録が必須回数を超える日の不足は0(負にならない)", () => {
    const records = [1, 2, 3].map((n) => ({ at: n * 1000, permille: 100 }))
    expect(fillMissing(base({ endsAt: DAY, dailyTarget: 1, records }), DEFAULT_SCORE_OPTIONS).missingCount).toBe(0)
  })

  test("scoring/AC-12: 欠測が6件あっても、減点は10点(1000)で止まる", () => {
    const r = fillMissing(base({ endsAt: 6 * DAY }), DEFAULT_SCORE_OPTIONS)
    expect(r.missingCount).toBe(6)
    expect(r.penaltyHundredths).toBe(1000)
  })

  test("scoring/AC-13: 単価1点・上限3点を指定すると、欠測5件の減点が3点", () => {
    const r = fillMissing(base({ endsAt: 5 * DAY }), { penaltyPerMissingHundredths: 100, penaltyCapHundredths: 300 })
    expect(r.penaltyHundredths).toBe(300)
  })
})
