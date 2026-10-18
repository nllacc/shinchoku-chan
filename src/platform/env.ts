// Worker の環境（バインディング・環境変数・シークレット）の型
export type Env = {
  DB: D1Database
  ASSETS: Fetcher
  BOT_DID: string
  BOT_HANDLE: string
  PUBLIC_ORIGIN: string
  /** 本番の公開ドメインで稼働を始めた日（YYYY-MM-DD）。ウォームアップの起点 */
  BOT_START_DATE?: string
  /** 保存先の実装。未指定は d1 */
  STORE_KIND?: string
  BOT_APP_PASSWORD: string
  RKEY_SECRET: string
  ADMIN_TOKEN: string
  /** システムオプション（OPT_ で始まる環境変数） */
  [option: `OPT_${string}`]: string | undefined
}
