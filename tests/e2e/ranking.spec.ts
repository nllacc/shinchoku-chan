import { expect, test } from "@playwright/test"
import { mockRanking } from "./fixtures"

test.describe("web-ranking: 一覧", () => {
  test("web-ranking/AC-3: 評価点の列を選ぶと並びが降順から昇順へ変わる", async ({ page }) => {
    await mockRanking(page)
    await page.goto("/")
    const firstUser = () => page.locator("tbody tr").first().locator("td").first()
    await expect(firstUser()).toHaveText("user1.test")
    await page.getByRole("button", { name: "評価点" }).click()
    await expect(firstUser()).toHaveText("user5.test")
    await expect(page).toHaveURL(/order=asc/)
  })

  test("web-ranking/AC-12: 幅360ピクセルでカード表示になり、横スクロールが発生しない", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await mockRanking(page)
    await page.goto("/")
    await expect(page.getByText("user1.test").first()).toBeVisible()
    await expect(page.locator("table")).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  })

  test("web-ranking/AC-15: 応答が300ミリ秒のとき、アクセスから1.5秒以内に一覧が表示される", async ({ page }) => {
    await mockRanking(page, { delay: 300 })
    const t0 = Date.now()
    await page.goto("/")
    await expect(page.getByText("user1.test")).toBeVisible()
    expect(Date.now() - t0).toBeLessThanOrEqual(1500)
  })
})
