import { describe, expect, test } from "vitest"
import { deviationArea } from "../../src/scoring/area"

describe("deviationArea", () => {
  test("scoring/AC-5: 進捗が経過割合と一致すると面積0(100点)", () => {
    expect(deviationArea([{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }])).toBeCloseTo(0, 10)
  })

  test("scoring/AC-6: 進捗が常に0なら面積0.5(0点)", () => {
    expect(deviationArea([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBeCloseTo(0.5, 10)
  })

  test("scoring/AC-7: 進捗が常に1なら面積0.5(0点)", () => {
    expect(deviationArea([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }])).toBeCloseTo(0.5, 10)
  })

  test("前半0・後半1の階段は面積0.25", () => {
    expect(deviationArea([{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 1, y: 1 }])).toBeCloseTo(0.25, 10)
  })

  test("符号が変わる区間は交点で分けて積分する", () => {
    // (0,0.2)→(1,0.8) と y=x の差は 0.2 → -0.2。交点で2つの三角形になる
    expect(deviationArea([{ x: 0, y: 0.2 }, { x: 1, y: 0.8 }])).toBeCloseTo(0.1, 10)
    expect(deviationArea([{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }])).toBeCloseTo(0.25, 10)
  })
})
