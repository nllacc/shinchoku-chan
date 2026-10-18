import path from "node:path"
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        // Worker・保存先・lexicon の試験(workerd 上で実行)
        plugins: [
          cloudflareTest(async () => {
            const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"))
            return {
              wrangler: { configPath: "./wrangler.toml" },
              miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
            }
          }),
        ],
        test: {
          name: "workers",
          include: ["tests/platform/**/*.test.ts", "tests/lexicon/**/*.test.ts", "tests/scoring/**/*.test.ts", "tests/receipt/**/*.test.ts", "tests/ranking/**/*.test.ts"],
          setupFiles: ["./tests/setup/applyMigrations.ts"],
        },
      },
      {
        // 画面の部品と設計値の試験(Node 上で実行。実ファイルを読める)
        plugins: [react()],
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["tests/ui/**/*.test.{ts,tsx}", "tests/web/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/ui/setup.ts"],
        },
      },
    ],
  },
})
