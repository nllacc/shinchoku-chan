import type { RankingDetail, RankingRow } from "../../src/web/lib/rankingApi"
import { vi } from "vitest"

export const row = (n: number, over: Partial<RankingRow> = {}): RankingRow => ({
  taskId: `t${n}`,
  handle: `user${n}.test`,
  profileUrl: `https://bsky.app/profile/user${n}.test`,
  summary: `概要${n}`,
  durationDays: 7,
  scoreHundredths: 10000 - n * 100,
  finalRatePermille: 1000 - n,
  ...over,
})

export const detail = (over: Partial<RankingDetail> = {}): RankingDetail => ({
  taskId: "t1",
  handle: "user1.test",
  profileUrl: "https://bsky.app/profile/user1.test",
  title: "毎日走る",
  summary: "概要の全文です",
  goal: "10km を走る",
  metric: { name: "距離", unit: "km", scale: 1, startValue: 0, goalValue: 100 },
  durationDays: 7,
  startedAt: Date.parse("2026-10-19T00:00:00+09:00"),
  endsAt: Date.parse("2026-10-26T00:00:00+09:00"),
  scoreHundredths: 8735,
  finalRatePermille: 1000,
  missingCount: 2,
  resultDescription: "走りきった",
  ...over,
})

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

/** 幅を指定して matchMedia を差し替える(480 以下を狭い画面とみなす) */
export function setWidth(width: number) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: /max-width:\s*(\d+)px/.test(q) ? width <= Number(/max-width:\s*(\d+)px/.exec(q)![1]) : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}
