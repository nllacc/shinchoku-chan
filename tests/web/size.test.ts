import { join } from "node:path"
import { expect, test } from "vitest"
import { LIMITS, measureFirstLoad } from "../../scripts/check-size.mjs"

// npm run build の後に実行する
test("web-ranking/AC-14: ランキング画面の初回表示のスクリプトを圧縮した転送サイズが120キロバイト以下", () => {
  const size = measureFirstLoad(join(import.meta.dirname, "../.."))
  expect(size).toBeGreaterThan(0)
  expect(size).toBeLessThanOrEqual(LIMITS.firstLoad)
})
