import { expect, test } from "vitest"
import { NSID } from "../../src/lexicon/nsid"
import { validateRecord } from "../../src/lexicon/validate"
import { task } from "./fixtures"

test("lexicon/AC-21: 全項目が上限長の作業を1000回検証した平均が5ミリ秒以下", () => {
  const full = task({
    summary: "あ".repeat(300),
    title: "あ".repeat(12),
    goal: "あ".repeat(200),
    metric: { name: "あ".repeat(30), unit: "あ".repeat(10), scale: 3, startValue: -1000000000, goalValue: 1000000000 },
    durationDays: 7,
  })
  expect(validateRecord(NSID.task, full).ok).toBe(true)
  const t0 = performance.now()
  for (let i = 0; i < 1000; i++) validateRecord(NSID.task, full)
  expect((performance.now() - t0) / 1000).toBeLessThanOrEqual(5)
})
