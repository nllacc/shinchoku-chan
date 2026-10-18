import { describe, expect, test } from "vitest"
import { fromScaled, progressPermille, toScaled } from "../../src/lexicon/numeric"

describe("numeric", () => {
  test("lexicon/AC-3: 小数桁数2で整数1250を変換すると12.5が得られる", () => {
    expect(fromScaled(1250, 2)).toBe(12.5)
    expect(toScaled(12.5, 2)).toBe(1250)
  })

  test.each([
    [0, 100, 25, 250],
    [80, 60, 70, 500],
    [0, 100, 120, 1200],
  ])("progressPermille(%i→%i, %i) = %i", (startValue, goalValue, value, expected) => {
    expect(progressPermille({ startValue, goalValue }, value)).toBe(expected)
  })

  test("lexicon/AC-4: 開始値とゴール値が同じならRangeError", () => {
    expect(() => progressPermille({ startValue: 5, goalValue: 5 }, 5)).toThrow(RangeError)
  })
})
