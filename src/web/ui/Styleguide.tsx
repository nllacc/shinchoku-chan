import { setTheme, type Theme } from "./theme"

const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "明" },
  { value: "dark", label: "暗" },
  { value: "system", label: "環境設定" },
]

export function Styleguide() {
  return (
    <main className="page">
      <h1>部品一覧</h1>
      <section aria-labelledby="theme-title">
        <h2 id="theme-title">テーマ</h2>
        {THEMES.map((t) => (
          <button key={t.value} type="button" onClick={() => setTheme(t.value)}>
            {t.label}
          </button>
        ))}
      </section>
    </main>
  )
}
