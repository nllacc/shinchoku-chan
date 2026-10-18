import { describe, expect, test } from "vitest"
import { computeScore, DEFAULT_SCORE_OPTIONS, type ScoreInput } from "../../src/scoring/score"

const DAY = 86_400_000
const input = (over: Partial<ScoreInput> = {}): ScoreInput => ({
  startedAt: 0, endsAt: 2 * DAY, dailyTarget: 1, records: [], final: null, ...over,
})
const ideal = (n: number) => Array.from({ length: n }, (_, k) => ({ at: ((k + 1) / n) * 2 * DAY - 1, permille: Math.round(((k + 1) / n) * 1000) }))

describe("computeScore", () => {
  test("理想の直線に乗る作業は満点に近く、欠測がなければ減点なし", () => {
    const r = computeScore(input({ records: [{ at: 0.5 * DAY, permille: 250 }, { at: 1.5 * DAY, permille: 750 }], final: { permille: 1000 } }))
    expect(r).toMatchObject({ algorithm: "linear-v1", missingCount: 0, finalRatePermille: 1000 })
    expect(r.scoreHundredths).toBeGreaterThan(9500)
  })

  test("scoring/AC-14: 減点後の評価点が負になる場合は0点", () => {
    const r = computeScore(input({ endsAt: 7 * DAY }), DEFAULT_SCORE_OPTIONS)
    expect(r.scoreHundredths).toBe(0)
    expect(r.missingCount).toBe(7)
  })

  test("減点は評価点から引かれる", () => {
    const r = computeScore(input({ endsAt: DAY, dailyTarget: 3, records: [{ at: 1, permille: 0 }] }), { penaltyPerMissingHundredths: 200, penaltyCapHundredths: 1000 })
    // 記録は進捗0のみ: 面積0.5で素点0
    expect(r.missingCount).toBe(2)
    const r2 = computeScore(input({ endsAt: DAY, dailyTarget: 2, records: [{ at: 1, permille: 0 }, { at: DAY - 1, permille: 1000 }] }))
    expect(r2.scoreHundredths).toBeLessThanOrEqual(10000)
    expect(r2.missingCount).toBe(0)
  })

  test("scoring/AC-15: 同じ入力を2回計算した結果が完全に一致する", () => {
    const i = input({ records: ideal(5) })
    expect(computeScore(i)).toEqual(computeScore(i))
    expect(computeScore(i)).toEqual(computeScore(structuredClone(i)))
  })

  test("scoring/AC-16: 日の必須回数が0または11(整数でない値も)はRangeError", () => {
    for (const dailyTarget of [0, 11, 1.5, NaN]) expect(() => computeScore(input({ dailyTarget }))).toThrow(RangeError)
    expect(() => computeScore(input({ dailyTarget: 1 }))).not.toThrow()
    expect(() => computeScore(input({ dailyTarget: 10 }))).not.toThrow()
  })

  test("期間が0以下・進捗率が数値でない場合はRangeError", () => {
    expect(() => computeScore(input({ endsAt: 0 }))).toThrow(RangeError)
    expect(() => computeScore(input({ records: [{ at: 1, permille: NaN }] }))).toThrow(RangeError)
  })

  test("期間外の記録は無視される", () => {
    const a = computeScore(input({ records: [{ at: -5, permille: 900 }, { at: 3 * DAY, permille: 900 }] }))
    expect(a).toEqual(computeScore(input()))
  })
})
