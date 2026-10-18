import { afterEach, expect, test, vi } from "vitest"
import { ApiError } from "../../src/web/lib/apiError"
import { fetchDetail, fetchRanking, parseSort } from "../../src/web/lib/rankingApi"
import { json, row } from "./helpers"

afterEach(() => vi.unstubAllGlobals())

test("web-ranking/AC-4: 最終進捗度の昇順のアドレスから同じ並びを読み取る", () => {
  expect(parseSort("?sort=rate&order=asc")).toEqual({ sort: "rate", order: "asc" })
})

test("web-ranking/AC-4: 不正な sort・order は既定値に置き換える", () => {
  expect(parseSort("?sort=x&order=y")).toEqual({ sort: "score", order: "desc" })
  expect(parseSort("")).toEqual({ sort: "score", order: "desc" })
})

test("web-ranking/AC-5: 続きの取得に cursor を付けて呼ぶ", async () => {
  const f = vi.fn(async () => json({ rows: [row(1)], next: "c2" }))
  vi.stubGlobal("fetch", f)
  const r = await fetchRanking({ sort: "rate", order: "asc", cursor: "c1" })
  expect(f).toHaveBeenCalledWith("/api/ranking?sort=rate&order=asc&cursor=c1", undefined)
  expect(r.next).toBe("c2")
})

test("web-ranking/AC-9: 失敗は ApiError(retryable 付き)になる", async () => {
  vi.stubGlobal("fetch", async () => json({ error: { kind: "internal", message: "失敗しました", retryable: true } }, 500))
  await expect(fetchRanking({ sort: "score", order: "desc" })).rejects.toMatchObject({ message: "失敗しました", retryable: true })
  vi.stubGlobal("fetch", async () => {
    throw new TypeError("offline")
  })
  await expect(fetchRanking({ sort: "score", order: "desc" })).rejects.toBeInstanceOf(ApiError)
})

test("web-ranking/AC-7: 詳細が 404 のときは null", async () => {
  vi.stubGlobal("fetch", async () => json({ error: { kind: "not-found", message: "x", retryable: false } }, 404))
  expect(await fetchDetail("t1")).toBeNull()
})
