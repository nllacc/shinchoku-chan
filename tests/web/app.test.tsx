import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { App } from "../../src/web/App"
import { AuthProvider } from "../../src/web/auth/AuthProvider"
import { json, setWidth } from "./helpers"

beforeEach(() => {
  setWidth(1024)
  history.replaceState(null, "", "/")
  vi.stubGlobal("fetch", async () => json({ rows: [] }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test("web-ranking/AC-11: ヘッダーの4つの要素が表示され、遷移が機能する", async () => {
  render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  )
  const nav = screen.getByRole("navigation", { name: "メイン" })
  expect(nav.textContent).toContain("ランキング")
  expect(screen.getByRole("link", { name: "作業を始める" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "サインイン" })).toBeTruthy()
  expect(screen.getByRole("combobox", { name: "テーマ" })).toBeTruthy()
  fireEvent.click(screen.getByRole("link", { name: "作業を始める" }))
  expect(location.pathname).toBe("/new")
  expect(await screen.findByRole("heading", { name: "作業を始める" })).toBeTruthy()
  fireEvent.click(screen.getByRole("link", { name: "ランキング" }))
  expect(location.pathname).toBe("/")
  expect(await screen.findByRole("heading", { name: "ランキング" })).toBeTruthy()
})

test("web-ranking/AC-11: テーマの選択が反映される", () => {
  render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  )
  fireEvent.change(screen.getByRole("combobox", { name: "テーマ" }), { target: { value: "dark" } })
  expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
})
