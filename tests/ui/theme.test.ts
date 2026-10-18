import { beforeEach, describe, expect, test } from "vitest"
import { initTheme, setTheme } from "../../src/web/ui/theme"

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute("data-theme")
})

describe("theme", () => {
  test("ui-foundation/AC-3: 手動で暗→明に切り替えると data-theme が変わり保存される", () => {
    setTheme("dark")
    expect(document.documentElement.dataset.theme).toBe("dark")
    setTheme("light")
    expect(document.documentElement.dataset.theme).toBe("light")
    expect(localStorage.getItem("theme")).toBe("light")
  })

  test("system を指定すると data-theme を外す", () => {
    setTheme("dark")
    setTheme("system")
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false)
  })

  test("保存された値を起動時に反映する", () => {
    localStorage.setItem("theme", "dark")
    expect(initTheme()).toBe("dark")
    expect(document.documentElement.dataset.theme).toBe("dark")
  })

  test("保存に失敗しても表示は切り替わる", () => {
    const orig = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error("denied")
    }
    try {
      setTheme("dark")
      expect(document.documentElement.dataset.theme).toBe("dark")
    } finally {
      Storage.prototype.setItem = orig
    }
  })
})
