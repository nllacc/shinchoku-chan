// fetch の入口。scheduled は定期実行の実装（tick）の追加時に加える
import type { Env } from "../platform/env"
import { route, type Route } from "./router"

/** 各機能が経路を追加する先 */
export const routes: Route[] = []

export default {
  fetch: (req: Request, env: Env) => route(req, env, routes),
} satisfies ExportedHandler<Env>
