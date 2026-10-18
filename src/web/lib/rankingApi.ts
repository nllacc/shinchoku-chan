import { ApiError, requestJson } from "./apiError"

export type SortKey = "score" | "rate"
export type SortState = { sort: SortKey; order: "asc" | "desc" }

export type RankingRow = {
  taskId: string
  handle: string
  profileUrl: string
  summary: string
  durationDays: number
  scoreHundredths: number
  finalRatePermille: number
}

export type RankingDetail = {
  taskId: string
  handle: string
  profileUrl: string
  title: string
  summary: string
  goal: string
  metric: { name: string; unit: string; scale: number; startValue: number; goalValue: number }
  durationDays: number
  startedAt: number
  endsAt: number
  scoreHundredths: number
  finalRatePermille: number
  missingCount: number
  resultDescription: string | null
  startImageUrl?: string
  evidenceUrl?: string
}

export function fetchRanking(q: SortState & { cursor?: string }): Promise<{ rows: RankingRow[]; next?: string }> {
  const p = new URLSearchParams({ sort: q.sort, order: q.order })
  if (q.cursor) p.set("cursor", q.cursor)
  return requestJson(`/api/ranking?${p}`)
}

/** 存在しない(または対象外の)作業は null */
export async function fetchDetail(taskId: string): Promise<RankingDetail | null> {
  try {
    return await requestJson<RankingDetail>(`/api/ranking/detail?id=${encodeURIComponent(taskId)}`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

export const DEFAULT_SORT: SortState = { sort: "score", order: "desc" }

// アドレスの検索部から並びを読む。不正な値は既定値に置き換える
export function parseSort(search: string): SortState {
  const p = new URLSearchParams(search)
  const sort = p.get("sort")
  const order = p.get("order")
  return {
    sort: sort === "score" || sort === "rate" ? sort : DEFAULT_SORT.sort,
    order: order === "asc" || order === "desc" ? order : DEFAULT_SORT.order,
  }
}
