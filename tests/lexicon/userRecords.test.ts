import { describe, expect, test } from "vitest"
import { Lexicons } from "@atproto/lexicon"
import { LEXICON_DOCS } from "../../lexicons/registry"
import { NSID } from "../../src/lexicon/nsid"
import type { ProgressRecord, ResultRecord, TaskRecord } from "../../src/lexicon/types"

const bytes = (s: string) => new TextEncoder().encode(s).length

// maxLength(バイト)を超えない範囲で、指定の文字で目一杯に埋める
const fill = (maxBytes: number, ch = "あ") => ch.repeat(Math.floor(maxBytes / bytes(ch)))

const ref = { uri: `at://did:plc:${"a".repeat(24)}/app.bsky.feed.post/${"3".repeat(13)}`, cid: "b".repeat(59) }
const blob = { $type: "blob" as const, ref: { $link: "b".repeat(59) }, mimeType: "image/jpeg", size: 1000000 }
const metric = { name: fill(150), unit: fill(50), scale: 3, startValue: -1000000000, goalValue: 1000000000 }
const at = "2026-10-18T00:00:00.000Z"

const task: TaskRecord = {
  summary: fill(1500), title: fill(120), goal: fill(1000), metric, durationDays: 7, slot: "morning", startImage: blob, anchor: ref, createdAt: at,
}
const progress: ProgressRecord = { task: ref, checkin: ref, value: 1000000000, note: fill(700), evidence: blob, createdAt: at }
const result: ResultRecord = { task: ref, checkin: ref, finalValue: 1000000000, description: fill(2500), evidence: blob, createdAt: at }

describe("ユーザー側レコード", () => {
  test("lexicon/AC-22: 全項目が上限長のユーザー側3種のJSONが10キロバイト以下", () => {
    for (const r of [task, progress, result]) {
      expect(bytes(JSON.stringify(r))).toBeLessThanOrEqual(10 * 1024)
    }
  })

  test("lexicon/AC-10: ユーザー側3種はrecord型でkeyがtid、Bot側と別の階層にある", () => {
    const docs = LEXICON_DOCS as { id: string; defs: { main?: { type: string; key: string } } }[]
    for (const id of [NSID.task, NSID.progress, NSID.result]) {
      const d = docs.find((x) => x.id === id)!
      expect(d.defs.main).toMatchObject({ type: "record", key: "tid" })
    }
  })

  test("lexicon/AC-18: 同時進行数の上限を表す項目をtaskの定義に持たない", () => {
    const d = (LEXICON_DOCS as any[]).find((x) => x.id === NSID.task)
    const props = Object.keys(d.defs.main.record.properties)
    expect(props.filter((p) => /limit|max|concurrent|active/i.test(p))).toEqual([])
  })

  test("lexiconの定義がLexiconsに登録できる", () => {
    const lex = new Lexicons(LEXICON_DOCS as any)
    expect(lex.get(NSID.task)).toBeTruthy()
  })
})
