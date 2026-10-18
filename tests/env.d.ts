// 試験で使う cloudflare:workers の env の型
declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    ASSETS: Fetcher
    TEST_MIGRATIONS: import("@cloudflare/vitest-plugin").D1Migration[]
  }
}

declare module "*?raw" {
  const content: string
  export default content
}
