import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { checkContrast, ratio } from "../../scripts/check-contrast.mjs"

const dir = join(import.meta.dirname, "../../src/web/tokens")
const prim = readFileSync(join(dir, "primitive.css"), "utf8")
const sem = readFileSync(join(dir, "semantic.css"), "utf8")

describe("コントラスト比", () => {
  test("計算式: 黒と白は21、同色は1", () => {
    expect(ratio("#000000", "#ffffff")).toBeCloseTo(21, 5)
    expect(ratio("#777777", "#777777")).toBe(1)
  })

  test("ui-foundation/AC-12: 明暗両テーマの組み合わせがすべて4.5以上", () => {
    const res = checkContrast(prim, sem)
    expect(new Set(res.map((r: any) => r.theme))).toEqual(
      new Set(["light", "dark"]),
    )
    expect(res.filter((r: any) => !r.ok)).toEqual([])
  })

  test("基準未満の組み合わせは失敗として検出される", () => {
    const bad = sem.replace(
      "--color-muted: var(--gray-600);",
      "--color-muted: var(--gray-300);",
    )
    expect(checkContrast(prim, bad).some((r: any) => !r.ok)).toBe(true)
  })
})
