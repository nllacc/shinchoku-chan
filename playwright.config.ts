import { existsSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { chromium, defineConfig } from "@playwright/test"

// 指定の版のブラウザがない環境では、導入済みの別の版のヘッドレスシェルを使う
function fallbackChromium(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH
  if (existsSync(chromium.executablePath())) return undefined
  const base = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(homedir(), ".cache/ms-playwright"))
  const dirs = existsSync(base) ? readdirSync(base).filter((d) => d.startsWith("chromium_headless_shell-")).sort().reverse() : []
  for (const d of dirs) {
    const p = join(base, d, "chrome-headless-shell-linux64/chrome-headless-shell")
    if (existsSync(p)) return p
  }
  return undefined
}

// 実ブラウザでの試験。ビルド済みの画面を Vite の preview で配信する
export default defineConfig({
  testDir: "tests/e2e",
  // ブラウザの版が合わない環境では PLAYWRIGHT_CHROMIUM_PATH で実行ファイルを指定する
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: { executablePath: fallbackChromium() },
  },
  webServer: {
    command: "npx vite build && npx vite preview --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
