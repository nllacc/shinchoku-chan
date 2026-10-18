import { expect, test } from "@playwright/test"

test.describe("ui-foundation: 部品", () => {
  test("ui-foundation/AC-8: 全体の差し替えを指定すると、すべてのボタンが差し替えた実装で表示される", async ({ page }) => {
    await page.goto("/styleguide")
    await page.getByLabel("全体のボタンを差し替える").check()
    const buttons = page.locator('[data-ui="button"]')
    expect(await buttons.count()).toBeGreaterThan(5)
    expect(await page.locator('[data-ui="button"]:not([data-impl="custom"])').count()).toBe(0)
  })

  test("ui-foundation/AC-5: 表の並べ替えの列を押すと並びが変わる", async ({ page }) => {
    await page.goto("/styleguide")
    const first = () => page.locator("tbody tr").first().locator("td").nth(1).innerText()
    expect(await first()).toBe("作業A")
    await page.getByRole("button", { name: "順位" }).click() // 降順
    expect(await first()).toBe("作業C")
  })

  test("ui-foundation/AC-4: 用途の値の主色を変えるとボタンとバッジの色が同時に変わる", async ({ page }) => {
    await page.goto("/styleguide")
    const colors = () =>
      page.evaluate(() => {
        const bg = (s: string) => getComputedStyle(document.querySelector(s)!).backgroundColor
        return [bg('[data-ui="button"][data-kind="primary"]'), bg('[data-tone="default"]')]
      })
    const before = await colors()
    expect(before[0]).toBe(before[1])
    await page.addStyleTag({ content: ":root { --color-primary: rgb(200, 0, 0) !important; }" })
    const after = await colors()
    expect(after).toEqual(["rgb(200, 0, 0)", "rgb(200, 0, 0)"])
  })
})
