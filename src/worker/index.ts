// fetch と scheduled の入口
import type { Env } from "../platform/env"
import { route, type Route } from "./router"
import { runTick } from "./tick"

/** 各機能が経路を追加する先 */
export const routes: Route[] = []

export default {
  fetch: (req: Request, env: Env) => route(req, env, routes),
  scheduled: (event: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(runTick(event.scheduledTime, env))
  },
} satisfies ExportedHandler<Env>
