import { beforeEach, describe, expect, test } from "vitest"
import { createStore, type EvaluationRow } from "../../src/platform/store"
import { BadQueryError, queryRanking } from "../../src/ranking/query"
import { resetDb, testEnv } from "../receipt/fakeNet"

const evalRow = (n: number, over: Partial<EvaluationRow> = {}): EvaluationRow => ({
  taskId: `t${String(n).padStart(4, "0")}`, handle: `u${n}.test`, summary: `概要${n}`, durationDays: 3, scoreHundredths: 5000,
  finalRatePermille: 500, missingCount: 0, algorithm: "linear-v1", evaluationUri: null, finalizedAt: 1_000_000 + n, stale: false, visible: true,
  ...over,
})
const put = (rows: EvaluationRow[]) => createStore(testEnv).evaluations.putMany(rows)
const q = (o: Partial<Parameters<typeof queryRanking>[1]> = {}) => queryRanking(testEnv, { sort: "score", order: "desc", ...o })

beforeEach(resetDb)

describe("queryRanking", () => {
  test("ranking/AC-6: 取り下げられた作業(visible が偽)は、一覧に出ない", async () => {
    await put([evalRow(1), evalRow(2, { visible: false })])
    expect((await q()).rows.map((r) => r.taskId)).toEqual(["t0001"])
  })

  test("ranking/AC-7: 評価点の降順では、評価点の高い順に並ぶ", async () => {
    await put([evalRow(1, { scoreHundredths: 3000 }), evalRow(2, { scoreHundredths: 9000 }), evalRow(3, { scoreHundredths: 6000 })])
    expect((await q()).rows.map((r) => r.scoreHundredths)).toEqual([9000, 6000, 3000])
    expect((await q({ order: "asc" })).rows.map((r) => r.scoreHundredths)).toEqual([3000, 6000, 9000])
  })

  test("ranking/AC-8: 最終進捗度の昇順では、低い順に並ぶ", async () => {
    await put([evalRow(1, { finalRatePermille: 800 }), evalRow(2, { finalRatePermille: 200 }), evalRow(3, { finalRatePermille: 1200 })])
    expect((await q({ sort: "rate", order: "asc" })).rows.map((r) => r.finalRatePermille)).toEqual([200, 800, 1200])
  })

  test("ranking/AC-9: 一覧の行のユーザー名が、プロフィールのURLへのリンクになっている", async () => {
    await put([evalRow(1, { handle: "alice.bsky.social" })])
    expect((await q()).rows[0]).toMatchObject({ handle: "alice.bsky.social", profileUrl: "https://bsky.app/profile/alice.bsky.social" })
  })

  test("ranking/AC-10: 一覧の概要は、冒頭の80文字までに切り詰められる", async () => {
    await put([evalRow(1, { summary: "あ".repeat(100) }), evalRow(2, { summary: "い".repeat(80) })])
    const rows = (await q()).rows
    expect(rows.find((r) => r.taskId === "t0001")!.summary).toBe("あ".repeat(80) + "…")
    expect(rows.find((r) => r.taskId === "t0002")!.summary).toBe("い".repeat(80))
  })

  test("ranking/AC-13: 同じ評価点が3件続く並びで、ページの境界をまたいでも重複も欠落も起きない", async () => {
    // 120 件のうち 48〜52 番目が同点(境界の 50 件目をまたぐ)
    const rows = Array.from({ length: 120 }, (_, i) => evalRow(i, { scoreHundredths: i >= 48 && i <= 52 ? 7000 : 10000 - i * 10 }))
    await put(rows)
    for (const order of ["desc", "asc"] as const) {
      const seen: string[] = []
      let cursor: string | undefined
      let pages = 0
      do {
        const r = await q({ order, cursor })
        seen.push(...r.rows.map((x) => x.taskId))
        cursor = r.next
        pages++
      } while (cursor)
      expect(pages).toBe(3)
      expect(seen).toHaveLength(120)
      expect(new Set(seen).size).toBe(120)
    }
  })

  test("同点は終了の新しい順に並ぶ", async () => {
    await put([evalRow(1, { finalizedAt: 100 }), evalRow(2, { finalizedAt: 300 }), evalRow(3, { finalizedAt: 200 })])
    expect((await q()).rows.map((r) => r.taskId)).toEqual(["t0002", "t0003", "t0001"])
  })

  test("ちょうど50件なら next はない", async () => {
    await put(Array.from({ length: 50 }, (_, i) => evalRow(i, { scoreHundredths: i })))
    const r = await q()
    expect(r.rows).toHaveLength(50)
    expect(r.next).toBeUndefined()
  })

  test("不正な sort・order・cursor は BadQueryError", async () => {
    await expect(q({ sort: "x" as never })).rejects.toBeInstanceOf(BadQueryError)
    await expect(q({ order: "up" as never })).rejects.toBeInstanceOf(BadQueryError)
    await expect(q({ cursor: "!!!" })).rejects.toBeInstanceOf(BadQueryError)
  })
})
