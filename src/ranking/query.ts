// 一覧のクエリとページ送り
import type { Env } from "../platform/env"
import { createStore, type EvaluationRow } from "../platform/store"

export type SortKey = "score" | "rate"
export type RankingQuery = { sort: SortKey; order: "asc" | "desc"; cursor?: string }
export type RankingRow = {
  taskId: string
  handle: string
  profileUrl: string
  summary: string
  durationDays: number
  scoreHundredths: number
  finalRatePermille: number
}

export const PAGE_SIZE = 50
const SUMMARY_MAX = 80

export class BadQueryError extends Error {}

export const profileUrl = (handle: string) => `https://bsky.app/profile/${handle}`

// 概要の冒頭を 80 文字(書記素ではなくコードポイント)までに切り、超える場合は省略記号を付ける
export function excerpt(text: string): string {
  const chars = [...text]
  return chars.length > SUMMARY_MAX ? `${chars.slice(0, SUMMARY_MAX).join("")}…` : text
}

const b64 = {
  enc: (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""),
  dec: (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0))),
}

type After = [number, number, string]

export function encodeCursor(row: EvaluationRow, sort: SortKey): string {
  const base = sort === "score" ? row.scoreHundredths : row.finalRatePermille
  return b64.enc(JSON.stringify([base, row.finalizedAt, row.taskId]))
}

export function decodeCursor(cursor: string): After {
  try {
    const v = JSON.parse(b64.dec(cursor))
    if (Array.isArray(v) && v.length === 3 && Number.isFinite(v[0]) && Number.isFinite(v[1]) && typeof v[2] === "string") return v as After
  } catch {
    // 下の例外へ進む
  }
  throw new BadQueryError("invalid cursor")
}

export async function queryRanking(env: Env, q: RankingQuery): Promise<{ rows: RankingRow[]; next?: string }> {
  if (q.sort !== "score" && q.sort !== "rate") throw new BadQueryError("invalid sort")
  if (q.order !== "asc" && q.order !== "desc") throw new BadQueryError("invalid order")
  const after = q.cursor ? decodeCursor(q.cursor) : undefined
  // 51 件目の有無で、次のページがあるかを決める
  const found = await createStore(env).evaluations.page({ sort: q.sort, order: q.order, after, limit: PAGE_SIZE + 1 })
  const page = found.slice(0, PAGE_SIZE)
  return {
    rows: page.map((r) => ({
      taskId: r.taskId,
      handle: r.handle,
      profileUrl: profileUrl(r.handle),
      summary: excerpt(r.summary),
      durationDays: r.durationDays,
      scoreHundredths: r.scoreHundredths,
      finalRatePermille: r.finalRatePermille,
    })),
    next: found.length > PAGE_SIZE ? encodeCursor(page[PAGE_SIZE - 1]!, q.sort) : undefined,
  }
}
