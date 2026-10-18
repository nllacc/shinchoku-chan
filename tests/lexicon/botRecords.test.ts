import { describe, expect, test } from "vitest"
import { Lexicons } from "@atproto/lexicon"
import { EXTERNAL_DOCS, LEXICON_DOCS } from "../../lexicons/registry"
import { NSID, type CollectionNsid } from "../../src/lexicon/nsid"

const BOT = [NSID.enrollment, NSID.checkin, NSID.receipt, NSID.revocation, NSID.evaluation] as const
const docs = LEXICON_DOCS as any[]
const main = (id: string) => docs.find((d) => d.id === id).defs.main.record

const ref = { uri: "at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/app.bsky.feed.post/3kaaaaaaaaaaa", cid: "bafyreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" }
const at = "2026-10-18T00:00:00.000Z"
const lex = new Lexicons([...LEXICON_DOCS, ...EXTERNAL_DOCS] as any)
// 構造だけの検証(意味規則は validate.ts が担当)
const structOk = (id: string, v: unknown) => {
  try {
    lex.assertValidRecord(id, { $type: id, ...(v as object) })
    return true
  } catch {
    return false
  }
}

describe("Bot側レコード", () => {
  test("lexicon/AC-10: Bot側5種の識別子はbot階層にあり定義が存在する", () => {
    for (const id of BOT) {
      expect(id).toContain(".bot.")
      expect(docs.some((d) => d.id === id)).toBe(true)
    }
  })

  test("lexicon/AC-11: enrollmentはwindowsとdailyTargetを必須とする", () => {
    const req = main(NSID.enrollment).required
    expect(req).toContain("windows")
    expect(req).toContain("dailyTarget")
  })

  test("lexicon/AC-12: Bot側全レコードの定義に更新日時の項目がない", () => {
    for (const id of BOT) {
      const names = Object.keys(main(id).properties)
      expect(names.filter((n) => /updated|modified/i.test(n))).toEqual([])
    }
  })

  test("lexicon/AC-13: 未知のstatusのreceiptは構造検証を通る", () => {
    expect(structOk(NSID.receipt, { subject: "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa", checkin: ref, status: "future-status", receivedAt: at })).toBe(true)
  })

  test("lexicon/AC-13: 未知のkind・reasonも構造検証を通る", () => {
    expect(structOk(NSID.revocation, { subject: "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa", target: ref, reason: "new-reason", detectedAt: at })).toBe(true)
  })

  test("列挙はenumでなくknownValuesで定義する", () => {
    expect(JSON.stringify(LEXICON_DOCS)).not.toContain('"enum"')
  })

  test("keyの種別: enrollment・checkin・receiptはany、revocation・evaluationはtid", () => {
    const key = (id: CollectionNsid) => docs.find((d) => d.id === id).defs.main.key
    expect([NSID.enrollment, NSID.checkin, NSID.receipt].map(key)).toEqual(["any", "any", "any"])
    expect([NSID.revocation, NSID.evaluation].map(key)).toEqual(["tid", "tid"])
  })
})
