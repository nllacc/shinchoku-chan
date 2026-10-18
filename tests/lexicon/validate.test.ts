import { describe, expect, test } from "vitest"
import { NSID } from "../../src/lexicon/nsid"
import { validateRecord } from "../../src/lexicon/validate"
import { at, checkin, enrollment, later, progress, receipt, ref, result, task } from "./fixtures"

const reasons = (r: ReturnType<typeof validateRecord>) => (r.ok ? [] : r.issues.map((i) => i.reason))
const withoutKey = <T extends object>(o: T, k: string) => Object.fromEntries(Object.entries(o).filter(([n]) => n !== k))

describe("構造検証", () => {
  test("lexicon/AC-1: 必須項目を満たす作業は成功し、必須が1つ欠けると失敗する", () => {
    expect(validateRecord(NSID.task, task()).ok).toBe(true)
    for (const k of ["summary", "title", "goal", "metric", "durationDays", "anchor", "createdAt"]) {
      expect(validateRecord(NSID.task, withoutKey(task(), k)).ok).toBe(false)
    }
  })

  test("lexicon/AC-2: 開始前画像を省略した作業は成功する", () => {
    expect(validateRecord(NSID.task, task()).ok).toBe(true)
  })

  test("lexicon/AC-5: 期間0日と8日は失敗し、2日と7日は成功する", () => {
    expect(reasons(validateRecord(NSID.task, task({ durationDays: 0 })))).toContain("duration-out-of-range")
    expect(validateRecord(NSID.task, task({ durationDays: 8 })).ok).toBe(false)
    expect(validateRecord(NSID.task, task({ durationDays: 2 })).ok).toBe(true)
    expect(validateRecord(NSID.task, task({ durationDays: 7 })).ok).toBe(true)
  })

  test("lexicon/AC-4: 開始値とゴール値が同じ指標の作業は失敗する", () => {
    const m = { name: "距離", unit: "km", scale: 0, startValue: 5, goalValue: 5 }
    expect(reasons(validateRecord(NSID.task, task({ metric: m })))).toContain("metric-range-empty")
  })

  test("lexicon/AC-6: 1日で時間帯あり・3日で時間帯なしはどちらも失敗する", () => {
    expect(reasons(validateRecord(NSID.task, task({ durationDays: 1 })))).toContain("slot-forbidden")
    const { slot: _, ...noSlot } = task({ durationDays: 3 })
    expect(reasons(validateRecord(NSID.task, noSlot))).toContain("slot-required")
    expect(validateRecord(NSID.task, withoutKey(task({ durationDays: 1 }), "slot")).ok).toBe(true)
  })

  test("lexicon/AC-7: 実測値のない進捗報告は失敗する", () => {
    expect(validateRecord(NSID.progress, withoutKey(progress(), "value")).ok).toBe(false)
  })

  test("lexicon/AC-8: メモと証跡画像を省略した進捗報告は成功する", () => {
    expect(validateRecord(NSID.progress, progress()).ok).toBe(true)
  })

  test("lexicon/AC-9: 結果説明のない結果報告は失敗し、ある場合は成功する", () => {
    expect(validateRecord(NSID.result, withoutKey(result(), "description")).ok).toBe(false)
    expect(validateRecord(NSID.result, result()).ok).toBe(true)
  })

  test("lexicon/AC-11: 受理は通知窓と日の必須回数のどちらが欠けても失敗する", () => {
    expect(validateRecord(NSID.enrollment, enrollment()).ok).toBe(true)
    expect(validateRecord(NSID.enrollment, withoutKey(enrollment(), "windows")).ok).toBe(false)
    expect(validateRecord(NSID.enrollment, withoutKey(enrollment(), "dailyTarget")).ok).toBe(false)
  })

  test("lexicon/AC-13: 未知のstatusの受領証は成功する", () => {
    const r = { ...withoutKey(receipt(), "record"), status: "future" }
    expect(validateRecord(NSID.receipt, withoutKey(r, "value")).ok).toBe(true)
  })

  test("lexicon/AC-14: 失敗の結果に違反した項目名と理由が含まれる", () => {
    const r = validateRecord(NSID.progress, withoutKey(progress(), "value"))
    expect(r).toEqual({ ok: false, issues: [{ path: "value", reason: "required" }] })
    const bad = validateRecord(NSID.task, task({ summary: "x".repeat(1501) }))
    expect(bad.ok === false && bad.issues[0]!.path).toBe("summary")
  })

  test("lexicon/AC-18: 同一ユーザーの2件の作業はどちらも単独で成功する", () => {
    expect(validateRecord(NSID.task, task()).ok).toBe(true)
    expect(validateRecord(NSID.task, task({ title: "読書", summary: "本を読む" })).ok).toBe(true)
  })

  test("未知のコレクション識別子はRangeError", () => {
    expect(() => validateRecord("x.y.z" as never, {})).toThrow(RangeError)
  })
})

describe("作業名の規則", () => {
  const titleReasons = (title: string) => reasons(validateRecord(NSID.task, task({ title })))

  test("lexicon/AC-19: 空・13文字・改行・URL・メンション入りは失敗する", () => {
    expect(validateRecord(NSID.task, task({ title: "" })).ok).toBe(false)
    expect(validateRecord(NSID.task, task({ title: "あ".repeat(13) })).ok).toBe(false)
    expect(titleReasons("a\nb")).toContain("title-unsafe")
    expect(titleReasons("https://x.jp")).toContain("title-unsafe")
    expect(titleReasons("a.com")).toContain("title-unsafe")
    expect(titleReasons("@user")).toContain("title-unsafe")
    expect(titleReasons("＠user")).toContain("title-unsafe")
  })

  test("lexicon/AC-20: 12文字ちょうどの日本語の作業名は成功する", () => {
    expect(validateRecord(NSID.task, task({ title: "あ".repeat(12) })).ok).toBe(true)
  })
})

describe("意味規則の理由コード", () => {
  test("enrollment: ends-before-start / window-inverted", () => {
    expect(reasons(validateRecord(NSID.enrollment, { ...enrollment(), endsAt: at }))).toContain("ends-before-start")
    const w = [{ startMinute: 700, endMinute: 700 }]
    expect(reasons(validateRecord(NSID.enrollment, { ...enrollment(), windows: w }))).toContain("window-inverted")
  })

  test("checkin: expires-before-issued / seq-required", () => {
    expect(reasons(validateRecord(NSID.checkin, { ...checkin(), expiresAt: at }))).toContain("expires-before-issued")
    expect(reasons(validateRecord(NSID.checkin, withoutKey(checkin(), "seq")))).toContain("seq-required")
    expect(validateRecord(NSID.checkin, { ...withoutKey(checkin(), "seq"), kind: "result" }).ok).toBe(true)
  })

  test("receipt: accepted/expiredの組み合わせ", () => {
    expect(reasons(validateRecord(NSID.receipt, withoutKey(receipt(), "value")))).toContain("accepted-needs-record-and-value")
    expect(reasons(validateRecord(NSID.receipt, { ...receipt(), status: "expired" }))).toContain("expired-forbids-record-and-value")
    expect(validateRecord(NSID.receipt, receipt()).ok).toBe(true)
  })

  test("revocation・evaluationは追加規則なし", () => {
    expect(validateRecord(NSID.revocation, { subject: receipt().subject, target: ref, reason: "tampered", detectedAt: later }).ok).toBe(true)
    expect(
      validateRecord(NSID.evaluation, {
        subject: receipt().subject, enrollment: ref, algorithm: "v1", scoreHundredths: 10000, finalRatePermille: 1000, missingCount: 0, finalizedAt: later,
      }).ok,
    ).toBe(true)
  })
})
