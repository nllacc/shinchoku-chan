import { expect, test } from "vitest"
import { computeScore } from "../../src/scoring/score"

test("scoring/AC-17: 記録100件の作業を1000回計算した平均が1ミリ秒以下", () => {
  const DAY = 86_400_000
  const records = Array.from({ length: 100 }, (_, k) => ({ at: Math.floor(((k + 0.5) / 100) * 7 * DAY), permille: Math.round(((k + 1) / 100) * 1000) }))
  const i = { startedAt: 0, endsAt: 7 * DAY, dailyTarget: 10, records, final: { permille: 1000 } }
  computeScore(i)
  const t0 = performance.now()
  for (let n = 0; n < 1000; n++) computeScore(i)
  expect((performance.now() - t0) / 1000).toBeLessThanOrEqual(1)
})
