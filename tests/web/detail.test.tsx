import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { RankingDetailDialog } from "../../src/web/pages/RankingDetailDialog"
import { Ranking } from "../../src/web/pages/Ranking"
import { detail, json, row, setWidth } from "./helpers"

beforeEach(() => {
  setWidth(1024)
  history.replaceState(null, "", "/")
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test("web-ranking/AC-7: 詳細にゴール・概要の全文・欠測件数が表示される", async () => {
  vi.stubGlobal("fetch", async () => json(detail()))
  render(<RankingDetailDialog taskId="t1" onClose={() => {}} />)
  const dlg = await screen.findByRole("dialog")
  await screen.findByText("10km を走る")
  for (const s of ["10km を走る", "概要の全文です", "2件", "走りきった", "87.35", "100%"]) expect(dlg.textContent).toContain(s)
})

test("web-ranking/AC-8: 画像が表示され、読み込めない画像は取り除かれる", async () => {
  vi.stubGlobal("fetch", async () => json(detail({ startImageUrl: "https://img.test/a.png", evidenceUrl: "https://img.test/b.png" })))
  render(<RankingDetailDialog taskId="t1" onClose={() => {}} />)
  await screen.findByAltText("開始前の画像")
  expect(screen.getByAltText("結果の画像")).toBeTruthy()
  fireEvent.error(screen.getByAltText("結果の画像"))
  expect(screen.queryByAltText("結果の画像")).toBeNull()
  expect(screen.getByAltText("開始前の画像")).toBeTruthy()
})

test("web-ranking/AC-7: 404 は「見つかりませんでした」を表示し、閉じる操作が残る", async () => {
  vi.stubGlobal("fetch", async () => json({ error: { kind: "not-found", message: "x", retryable: false } }, 404))
  const onClose = vi.fn()
  render(<RankingDetailDialog taskId="zz" onClose={onClose} />)
  await screen.findByText("見つかりませんでした")
  fireEvent.click(screen.getByRole("button", { name: "閉じる" }))
  expect(onClose).toHaveBeenCalled()
})

test("web-ranking/AC-6: 行を選ぶとダイアログが開き、Esc で閉じて並びが保たれる", async () => {
  vi.stubGlobal("fetch", async (url: string) =>
    url.startsWith("/api/ranking/detail") ? json(detail()) : json({ rows: [row(1), row(2)] }),
  )
  render(<Ranking />)
  fireEvent.click((await screen.findByText("概要1")).closest("tr")!)
  await screen.findByRole("dialog")
  expect(location.search).toContain("detail=t1")
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(location.search).not.toContain("detail")
  expect(screen.getAllByRole("row")).toHaveLength(3)
})
