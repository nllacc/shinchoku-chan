export type Theme = "light" | "dark" | "system"

const KEY = "theme"

export function setTheme(theme: Theme): void {
  if (theme === "system") document.documentElement.removeAttribute("data-theme")
  else document.documentElement.setAttribute("data-theme", theme)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // 保存できない環境では保持しない
  }
}

// 起動時に、保存されたテーマを反映する(なければ環境設定に従う)
export function initTheme(): Theme {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(KEY)
  } catch {
    // 読めない環境では環境設定に従う
  }
  const theme: Theme = saved === "light" || saved === "dark" ? saved : "system"
  if (theme !== "system") document.documentElement.setAttribute("data-theme", theme)
  return theme
}
