import { defineConfig } from "@playwright/test"

// 実ブラウザでの試験。ビルド済みの画面を Vite の preview で配信する
export default defineConfig({
  testDir: "tests/e2e",
  // ブラウザの版が合わない環境では PLAYWRIGHT_CHROMIUM_PATH で実行ファイルを指定する
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
  },
  webServer: {
    command: "npx vite build && npx vite preview --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
