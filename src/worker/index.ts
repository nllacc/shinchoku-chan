// fetch と scheduled の入口
import type { Env } from "../platform/env"
import { finalizeTasks, reevaluateStale } from "../ranking/finalize"
import { rankingRoutes } from "../ranking/routes"
import { expireCheckins } from "../receipt/expire"
import { recheckRecords } from "../receipt/recheck"
import { receiptRoutes } from "../receipt/routes"
import { route, type Route } from "./router"
import { registerTick, runTick } from "./tick"

/** 各機能が経路を追加する先 */
export const routes: Route[] = [...receiptRoutes, ...rankingRoutes]

// 定期実行の処理(登録順に実行される)
registerTick({ name: "expire-checkins", run: expireCheckins })
registerTick({ name: "recheck-records", run: recheckRecords })
registerTick({ name: "finalize-tasks", run: finalizeTasks })
registerTick({ name: "reevaluate-stale", run: reevaluateStale })

export default {
  fetch: (req: Request, env: Env) => route(req, env, routes),
  scheduled: (event: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(runTick(event.scheduledTime, env))
  },
} satisfies ExportedHandler<Env>
