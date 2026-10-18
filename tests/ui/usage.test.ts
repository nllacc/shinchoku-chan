import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { checkUiUsage, loadSources } from "../../scripts/check-ui-usage.mjs"

describe("基底部品の使用の検査", () => {
  test("現在の画面に、基底部品を介さない素の要素がない", () => {
    expect(
      checkUiUsage(loadSources(join(import.meta.dirname, "../.."))),
    ).toEqual([])
  })

  test("ui-foundation/AC-15: 画面が素の要素を直接使うと失敗する", () => {
    const bad = checkUiUsage({
      "pages/X.tsx":
        "export const X = () => <><a href='/'>x</a><select /><button>b</button><input /><img src='' /></>",
    })
    expect(bad.map((v: { detail: string }) => v.detail).sort()).toEqual([
      "<a>",
      "<button>",
      "<img>",
      "<input>",
      "<select>",
    ])
  })

  test("ui-foundation/AC-15: 基底部品の実装(ui 配下)とコメント中の記述は対象外", () => {
    expect(
      checkUiUsage({
        "ui/Button.tsx": "<button />",
        "pages/X.tsx":
          "// <a href> を使わない\nexport const X = () => <main />",
      }),
    ).toEqual([])
  })
})
