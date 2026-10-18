import { expect, test } from "@playwright/test"

test.describe("ui-foundation: テーマ", () => {
  test.use({ colorScheme: "dark" })

  test("ui-foundation/AC-3: 暗の環境設定で暗になり、手動で明に切り替えると背景色が変わる", async ({ page }) => {
    await page.goto("/styleguide")
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    const dark = await bg()
    await page.getByRole("button", { name: "明" }).click()
    const light = await bg()
    expect(light).not.toBe(dark)
    expect(light).toBe("rgb(246, 247, 249)")
    expect(dark).toBe("rgb(28, 31, 38)")
  })
})
