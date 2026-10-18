import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { LIMITS, measureSizes } from "../../scripts/check-size.mjs"

describe("容量(gzip 後)", () => {
  // npm run build の後に実行する
  const sizes = measureSizes(join(import.meta.dirname, "../.."))

  test("ui-foundation/AC-13: 全スタイルを圧縮した転送サイズが20キロバイト以下", async () => {
    expect((await sizes).css).toBeGreaterThan(0)
    expect((await sizes).css).toBeLessThanOrEqual(LIMITS.css)
  })

  test("ui-foundation/AC-14: 基底部品のスクリプトを圧縮した転送サイズが30キロバイト以下", async () => {
    expect((await sizes).script).toBeGreaterThan(0)
    expect((await sizes).script).toBeLessThanOrEqual(LIMITS.script)
  })
})
