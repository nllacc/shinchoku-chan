import { StrictMode, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import "./tokens/primitive.css"
import "./tokens/semantic.css"
import "./tokens/component.css"
import "./global.css"
import { Styleguide } from "./ui/Styleguide"
import { initTheme } from "./ui/theme"

initTheme()

// 経路ごとの画面。各画面の specs が追加する
const pages: Record<string, () => ReactElement> = {
  "/styleguide": Styleguide,
}

const Page = pages[location.pathname] ?? (() => <main className="page">準備中です</main>)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
)
