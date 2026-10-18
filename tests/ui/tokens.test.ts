import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { checkTokenUsage, loadFiles } from "../../scripts/check-css-tokens.mjs"
import { varsOf } from "../../scripts/css-tokens.mjs"

const root = join(import.meta.dirname, "../..")
const real = () => loadFiles(root)
const rules = (f: object) =>
  checkTokenUsage(f as never).map((v: { rule: string }) => v.rule)

describe("設計値の使い方の検査", () => {
  test("現在のスタイルに違反がない", () => {
    expect(checkTokenUsage(real())).toEqual([])
  })

  test("ui-foundation/AC-1: 部品の層が素の値を直接参照すると失敗する", () => {
    const f = real()
    f.component += "\n:root { --bad: var(--blue-500); }"
    expect(rules(f)).toContain("component-refs-non-semantic")
  })

  test("ui-foundation/AC-1: 用途の値が部品の値を参照すると失敗する", () => {
    const f = real()
    f.semantic += "\n:root { --color-bad: var(--button-bg); }"
    expect(rules(f)).toContain("semantic-refs-component")
  })

  test("ui-foundation/AC-2: 部品のスタイルに色や長さの直接の値があると失敗する", () => {
    const f = real()
    f.modules = { "A.module.css": ".a { color: #fff; padding: 8px; }" }
    expect(rules(f)).toEqual(["literal-in-module", "literal-in-module"])
  })

  test("ui-foundation/AC-2: 0 の長さ・変数・@media の条件の幅は違反にならない", () => {
    const f = real()
    f.modules = {
      "A.module.css":
        "@media (min-width: 480px) { .a { margin: 0; padding: var(--button-padding); } }",
    }
    expect(rules(f)).toEqual([])
  })

  test("ui-foundation/AC-3: 暗テーマの再定義は環境設定と手動指定で同じ値になる", () => {
    const css = readFileSync(join(root, "src/web/tokens/semantic.css"), "utf8")
    const byMedia = varsOf(css, ':root:not([data-theme="light"])', {
      media: "@media (prefers-color-scheme: dark)",
    })
    const byAttr = varsOf(css, ':root[data-theme="dark"]')
    expect(Object.keys(byAttr).length).toBeGreaterThan(0)
    expect(byMedia).toEqual(byAttr)
  })

  test("ui-foundation/AC-4: 用途の値の主色の変更だけで部品の値が追従する(部品の値は主色を値でなく参照で持つ)", () => {
    const f = real()
    const comp: Record<string, string> = varsOf(f.component, ":root")
    expect(comp["--button-bg"]).toBe("var(--color-primary)")
    expect(comp["--badge-bg"]).toBe("var(--color-primary)")
  })
})
