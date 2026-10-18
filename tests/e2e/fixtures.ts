import type { Page } from "@playwright/test"

export const makeRow = (n: number) => ({
  taskId: `t${n}`,
  handle: `user${n}.test`,
  profileUrl: `https://bsky.app/profile/user${n}.test`,
  summary: `概要${n}`,
  durationDays: 7,
  scoreHundredths: 10000 - n * 100,
  finalRatePermille: 1000 - n,
})

export const makeDetail = (n: number) => ({
  ...makeRow(n),
  title: `作業${n}`,
  goal: `ゴール${n}`,
  metric: { name: "距離", unit: "km", scale: 1, startValue: 0, goalValue: 100 },
  startedAt: Date.parse("2026-10-19T00:00:00+09:00"),
  endsAt: Date.parse("2026-10-26T00:00:00+09:00"),
  missingCount: 1,
  resultDescription: null,
})

/** /api/ranking と詳細を模擬する。delay はミリ秒 */
export async function mockRanking(page: Page, opts: { total?: number; delay?: number } = {}) {
  const total = opts.total ?? 5
  await page.route("**/api/ranking/detail*", async (route) => {
    const id = new URL(route.request().url()).searchParams.get("id") ?? ""
    await route.fulfill({ json: makeDetail(Number(id.slice(1))) })
  })
  await page.route("**/api/ranking?*", async (route) => {
    const u = new URL(route.request().url())
    if (opts.delay) await new Promise((r) => setTimeout(r, opts.delay))
    const asc = u.searchParams.get("order") === "asc"
    const ids = Array.from({ length: total }, (_, i) => i + 1)
    if (asc) ids.reverse()
    await route.fulfill({ json: { rows: ids.map(makeRow) } })
  })
}
