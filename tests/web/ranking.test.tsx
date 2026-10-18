import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { Ranking } from "../../src/web/pages/Ranking"
import { json, row, setWidth } from "./helpers"

// 並び・続きに応じた応答を返す模擬の API
function mockApi(pages: Record<string, { rows: ReturnType<typeof row>[]; next?: string }>, calls: string[] = []) {
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url)
    const u = new URL(url, "http://x")
    const key = `${u.searchParams.get("sort")}-${u.searchParams.get("order")}-${u.searchParams.get("cursor") ?? ""}`
    return json(pages[key] ?? { rows: [] })
  })
  return calls
}

beforeEach(() => {
  setWidth(1024)
  history.replaceState(null, "", "/")
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test("web-ranking/AC-1: 各行にユーザー名・概要・期間・評価点・最終進捗度が表示される", async () => {
  mockApi({ "score-desc-": { rows: [row(1, { scoreHundredths: 8735, finalRatePermille: 1000, durationDays: 14 })] } })
  render(<Ranking />)
  const tr = (await screen.findByText("user1.test")).closest("tr")!
  const text = tr.textContent
  for (const s of ["user1.test", "概要1", "14日間", "87.35", "100%"]) expect(text).toContain(s)
})

test("web-ranking/AC-2: ユーザー名はプロフィールへのリンクで、選んでも詳細は開かない", async () => {
  mockApi({ "score-desc-": { rows: [row(1)] } })
  render(<Ranking />)
  const a = await screen.findByRole("link", { name: "user1.test" })
  expect(a.getAttribute("href")).toBe("https://bsky.app/profile/user1.test")
  a.addEventListener("click", (e) => e.preventDefault())
  fireEvent.click(a)
  expect(location.search).not.toContain("detail")
})

test("web-ranking/AC-3: 評価点の列を選ぶたびに降順と昇順が切り替わり、並びが変わる", async () => {
  const calls = mockApi({
    "score-desc-": { rows: [row(1), row(2)] },
    "score-asc-": { rows: [row(2), row(1)] },
  })
  render(<Ranking />)
  await screen.findByText("user1.test")
  const order = () => screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0]!.textContent)
  expect(order()).toEqual(["user1.test", "user2.test"])
  fireEvent.click(screen.getByRole("button", { name: "評価点" }))
  await waitFor(() => expect(order()).toEqual(["user2.test", "user1.test"]))
  expect(screen.getByRole("columnheader", { name: "評価点" }).getAttribute("aria-sort")).toBe("ascending")
  expect(location.search).toContain("order=asc")
  expect(calls.at(-1)).toContain("order=asc")
  fireEvent.click(screen.getByRole("button", { name: "評価点" }))
  await waitFor(() => expect(order()).toEqual(["user1.test", "user2.test"]))
})

test("web-ranking/AC-4: 最終進捗度の昇順のアドレスを開くと同じ並びで取得する", async () => {
  history.replaceState(null, "", "/?sort=rate&order=asc")
  const calls = mockApi({ "rate-asc-": { rows: [row(3)] } })
  render(<Ranking />)
  await screen.findByText("user3.test")
  expect(calls[0]).toContain("sort=rate&order=asc")
  expect(screen.getByRole("columnheader", { name: "最終進捗度" }).getAttribute("aria-sort")).toBe("ascending")
})

test("web-ranking/AC-5: 「さらに表示」で続きが追加され、重複しない", async () => {
  const first = Array.from({ length: 50 }, (_, i) => row(i))
  mockApi({
    "score-desc-": { rows: first, next: "c1" },
    "score-desc-c1": { rows: [row(49), row(50)] },
  })
  render(<Ranking />)
  await screen.findByText("user0.test")
  fireEvent.click(screen.getByRole("button", { name: "さらに表示" }))
  await screen.findByText("user50.test")
  expect(screen.getAllByRole("row")).toHaveLength(1 + 51)
  expect(screen.queryByRole("button", { name: "さらに表示" })).toBeNull()
})

test("web-ranking/AC-9: 取得に失敗するとエラーと再試行が表示され、操作で再取得される", async () => {
  let ok = false
  vi.stubGlobal("fetch", async () =>
    ok ? json({ rows: [row(1)] }) : json({ error: { kind: "internal", message: "取得に失敗しました", retryable: true } }, 500),
  )
  render(<Ranking />)
  expect((await screen.findByRole("alert")).textContent).toContain("取得に失敗しました")
  ok = true
  fireEvent.click(screen.getByRole("button", { name: "再試行" }))
  await screen.findByText("user1.test")
})

test("web-ranking/AC-10: 0件のとき空の状態の案内が表示される", async () => {
  mockApi({ "score-desc-": { rows: [] } })
  render(<Ranking />)
  expect(await screen.findByText(/まだランキングに載った作業はありません/)).toBeTruthy()
})

test("web-ranking/AC-12: 狭い画面では表がカード表示になる", async () => {
  setWidth(360)
  mockApi({ "score-desc-": { rows: [row(1)] } })
  render(<Ranking />)
  await screen.findByText("user1.test")
  expect(screen.queryByRole("table")).toBeNull()
  expect(screen.getByRole("combobox", { name: /並べ替え/ })).toBeTruthy()
  await act(async () => {})
})
