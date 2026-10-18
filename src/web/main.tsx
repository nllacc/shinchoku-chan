import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./tokens/primitive.css"
import "./tokens/semantic.css"
import "./tokens/component.css"
import "./global.css"
import { Styleguide } from "./ui/Styleguide"
import { initTheme } from "./ui/theme"

initTheme()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Styleguide />
  </StrictMode>,
)
