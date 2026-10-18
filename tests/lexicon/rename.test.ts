import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { renameNamespace } from "../../scripts/rename-namespace.mjs"
import defsRaw from "../../lexicons/com/example/shinchoku/defs.json?raw"
import registryRaw from "../../lexicons/registry.ts?raw"
import nsidRaw from "../../src/lexicon/nsid.ts?raw"


// workerd のファイルシステムは実リポジトリを見られないため、?raw で取り込んだ実物を一時ディレクトリへ書き出して試す
function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "lexrename-"))
  mkdirSync(join(root, "lexicons/com/example/shinchoku"), { recursive: true })
  mkdirSync(join(root, "src/lexicon"), { recursive: true })
  writeFileSync(join(root, "lexicons/com/example/shinchoku/defs.json"), defsRaw)
  writeFileSync(join(root, "lexicons/registry.ts"), registryRaw)
  writeFileSync(join(root, "src/lexicon/nsid.ts"), nsidRaw)
  return root
}

describe("renameNamespace", () => {
  test("lexicon/AC-15: 接頭辞を一括変更すると識別子とコードの定数が新しい値になる", () => {
    const root = sandbox()
    renameNamespace(root, "com.example.shinchoku", "app.nlla.shinchoku")
    const defs = JSON.parse(readFileSync(join(root, "lexicons/app/nlla/shinchoku/defs.json"), "utf8"))
    expect(defs.id).toBe("app.nlla.shinchoku.defs")
    expect(existsSync(join(root, "lexicons/com"))).toBe(false)
    expect(readFileSync(join(root, "src/lexicon/nsid.ts"), "utf8")).toContain('NSID_PREFIX = "app.nlla.shinchoku"')
    expect(readFileSync(join(root, "lexicons/registry.ts"), "utf8")).toContain("./app/nlla/shinchoku/defs.json")
  })

  test("lexicon/AC-15: 公開後(スナップショットが空でない)は何も書き換えず中止する", () => {
    const root = sandbox()
    writeFileSync(join(root, "lexicons.lock.json"), JSON.stringify({ "com.example.shinchoku.defs": {} }))
    expect(() => renameNamespace(root, "com.example.shinchoku", "app.nlla.shinchoku")).toThrow("published")
    expect(existsSync(join(root, "lexicons/com/example/shinchoku/defs.json"))).toBe(true)
  })

  test("lexicon/AC-15: 規則に合わない接頭辞は拒否する", () => {
    expect(() => renameNamespace(sandbox(), "com.example.shinchoku", "bad")).toThrow("invalid-prefix")
  })
})
