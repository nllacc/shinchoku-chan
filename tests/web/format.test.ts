import { expect, test } from "vitest"
import { formatPeriod, formatRate, formatScore } from "../../src/web/lib/format"

const cases: [string, (n: number) => string, number, string][] = [
  ["評価点 8735", formatScore, 8735, "87.35"],
  ["評価点 0", formatScore, 0, "0.00"],
  ["進捗度 1000", formatRate, 1000, "100%"],
  ["進捗度 1253", formatRate, 1253, "125%"],
  ["進捗度 -50", formatRate, -50, "-5%"],
]
for (const [name, fn, input, out] of cases) {
  test(`web-ranking/AC-13: ${name} は「${out}」と表示される`, () => {
    expect(fn(input)).toBe(out)
  })
}

test("期間は「N日間」", () => {
  expect(formatPeriod(7)).toBe("7日間")
})
