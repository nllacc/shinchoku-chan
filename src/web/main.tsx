import { StrictMode, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import "./tokens/primitive.css"
import "./tokens/semantic.css"
import "./tokens/component.css"
import "./global.css"
import { App } from "./App"
import { AuthProvider } from "./auth/AuthProvider"
import { Styleguide } from "./ui/Styleguide"
import { initTheme } from "./ui/theme"

initTheme()

// 見本の画面だけは枠組みの外で表示する
const Page: () => ReactElement =
  location.pathname === "/styleguide"
    ? Styleguide
    : () => (
        <AuthProvider>
          <App />
        </AuthProvider>
      )

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
)
