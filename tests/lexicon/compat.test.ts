import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { LEXICON_DOCS } from "../../lexicons/registry"
import { compareLexicon, run, snapshotOf } from "../../scripts/check-lexicon-compat.mjs"

const base = () => snapshotOf(LEXICON_DOCS as any[])
const T = "com.example.shinchoku.task"
const kinds = (a: object, b: object) => compareLexicon(a, b).map((v: any) => v.kind)
const mutate = (fn: (s: any) => void) => {
  const s = base()
  fn(s)
  return s
}

describe("互換性検査", () => {
  test("同一のスナップショットは互換", () => {
    expect(compareLexicon(base(), base())).toEqual([])
  })

  test("lexicon/AC-16: 任意項目の追加は違反にならない", () => {
    const cur = mutate((s) => (s[T].properties.extra = { type: "string", maxLength: 10 }))
    expect(compareLexicon(base(), cur)).toEqual([])
  })

  test("lexicon/AC-16: 必須項目の削除は違反として検出される", () => {
    const cur = mutate((s) => (s[T].required = s[T].required.filter((n: string) => n !== "goal")))
    expect(compareLexicon(base(), cur)).toContainEqual({ nsid: T, path: "required", kind: "required-changed" })
  })

  test("必須の追加も違反(任意項目を必須にする)", () => {
    const cur = mutate((s) => s[T].required.push("startImage"))
    expect(kinds(base(), cur)).toEqual(["required-changed"])
  })

  test("プロパティの削除は違反", () => {
    const cur = mutate((s) => delete s[T].properties.startImage)
    expect(compareLexicon(base(), cur)).toContainEqual({ nsid: T, path: "startImage", kind: "property-removed" })
  })

  test("lexicon/AC-17: 型・refの変更は違反として検出される", () => {
    expect(kinds(base(), mutate((s) => (s[T].properties.durationDays.type = "string")))).toContain("type-changed")
    expect(kinds(base(), mutate((s) => (s[T].properties.anchor.ref = "other.Ref")))).toContain("type-changed")
  })

  test("lexicon/AC-17: 文字数上限の引き下げは違反として検出される", () => {
    const cur = mutate((s) => (s[T].properties.summary.maxLength = 100))
    expect(compareLexicon(base(), cur)).toContainEqual({ nsid: T, path: "summary", kind: "constraint-tightened" })
  })

  test("上限の引き上げ・下限の引き下げは許容し、下限の引き上げ・上限の新設は違反", () => {
    expect(kinds(base(), mutate((s) => (s[T].properties.summary.maxLength = 3000)))).toEqual([])
    expect(kinds(base(), mutate((s) => (s[T].properties.durationDays.minimum = 0)))).toEqual([])
    expect(kinds(base(), mutate((s) => (s[T].properties.durationDays.minimum = 2)))).toEqual(["constraint-tightened"])
    expect(kinds(base(), mutate((s) => delete s[T].properties.summary.maxLength))).toEqual([])
    const pub = mutate((s) => delete s[T].properties.summary.maxLength)
    expect(kinds(pub, base())).toEqual(["constraint-tightened"])
  })

  test("knownValuesへの値の追加は許容し、削除は違反", () => {
    const D = "com.example.shinchoku.defs#slot"
    expect(kinds(base(), mutate((s) => s[D].properties.$value.knownValues.push("night")))).toEqual([])
    expect(kinds(base(), mutate((s) => s[D].properties.$value.knownValues.pop()))).toEqual(["constraint-tightened"])
  })

  test("定義ごと消えた場合は違反", () => {
    expect(kinds(base(), mutate((s) => delete s[T]))).toEqual(["property-removed"])
  })
})

describe("run", () => {
  function sandbox() {
    const root = mkdtempSync(join(tmpdir(), "lexcompat-"))
    mkdirSync(join(root, "lexicons/com/example"), { recursive: true })
    writeFileSync(join(root, "lexicons/com/example/a.json"), JSON.stringify((LEXICON_DOCS as any[])[1]))
    return root
  }

  test("スナップショットなし(公開前)は互換、--updateで生成し、以後は検出する", () => {
    const root = sandbox()
    const logs: string[] = []
    expect(run(root, [], (m: string) => logs.push(m))).toBe(0)
    expect(existsSync(join(root, "lexicons.lock.json"))).toBe(false)
    expect(run(root, ["--update"])).toBe(0)
    expect(Object.keys(JSON.parse(readFileSync(join(root, "lexicons.lock.json"), "utf8")))).toContain("com.example.shinchoku.task")
    expect(run(root, [])).toBe(0)
    // 必須項目を削除した定義 → 違反で終了コード1
    const doc = JSON.parse(readFileSync(join(root, "lexicons/com/example/a.json"), "utf8"))
    doc.defs.main.record.required = doc.defs.main.record.required.filter((n: string) => n !== "goal")
    writeFileSync(join(root, "lexicons/com/example/a.json"), JSON.stringify(doc))
    expect(run(root, [], (m: string) => logs.push(m))).toBe(1)
    expect(logs.join("\n")).toContain("required-changed")
  })
})
