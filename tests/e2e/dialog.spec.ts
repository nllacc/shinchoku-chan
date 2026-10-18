import { expect, test } from "@playwright/test"

test.describe("ui-foundation: ダイアログとレイアウト", () => {
  test("ui-foundation/AC-9: ダイアログを開き Tab を繰り返し Esc を押すとフォーカスが外へ出ず、Esc で閉じて元の要素へ戻る", async ({ page }) => {
    await page.goto("/styleguide")
    const opener = page.getByRole("button", { name: "ダイアログを開く" })
    await opener.click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab")
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
    }
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(opener).toBeFocused()
  })

  test("ui-foundation/AC-10: Tab で全操作部品に到達でき、フォーカス時に輪郭が表示される", async ({ page }) => {
    await page.goto("/styleguide")
    const total = await page.locator("button:not([disabled]), input, tbody tr[tabindex='0']").count()
    const seen = new Set<string>()
    for (let i = 0; i < total + 2; i++) {
      await page.keyboard.press("Tab")
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement
        const nth = [...document.querySelectorAll(el.tagName)].indexOf(el)
        return { key: `${el.tagName}#${nth}`, outline: getComputedStyle(el).outlineStyle, isBody: el === document.body }
      })
      if (info.isBody) continue
      seen.add(info.key)
      expect(info.outline, info.key).not.toBe("none")
    }
    // aria-disabled(処理中)のボタンもフォーカスを受けるため、総数以上に到達する
    expect(seen.size).toBeGreaterThanOrEqual(total)
  })

  test("ui-foundation/AC-11: 幅360ピクセルで横スクロールが発生しない", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto("/styleguide")
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
  })
})
