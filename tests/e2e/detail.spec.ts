import { expect, test } from "@playwright/test"
import { mockRanking } from "./fixtures"

test("web-ranking/AC-6: 一覧の行を選んで Esc で閉じると、同じ並びとスクロール位置に戻る", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 400 })
  await mockRanking(page, { total: 30 })
  await page.goto("/?sort=score&order=asc")
  await expect(page.getByText("user30.test").first()).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 300))
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBeGreaterThan(0)
  await page.getByText("概要25").click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText("ゴール25")).toBeVisible()
  await expect(page).toHaveURL(/detail=t25/)
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/order=asc/)
  expect(await page.evaluate(() => window.scrollY)).toBe(before)
  await expect(page.locator("tbody tr").first().locator("td").first()).toHaveText("user30.test")
})

test("web-ranking/AC-6: ?detail= を付けたアドレスを直接開くと同じ詳細が表示される", async ({ page }) => {
  await mockRanking(page)
  await page.goto("/?detail=t2")
  await expect(page.getByRole("dialog").getByText("ゴール2")).toBeVisible()
})
