// ランキングの API 経路(閲覧は認証を要求しない)
import type { Env } from "../platform/env"
import { errorResponse, type Route } from "../worker/router"
import { getDetail } from "./detail"
import { BadQueryError, queryRanking, type RankingQuery } from "./query"

async function rankingHandler(req: Request, env: Env): Promise<Response> {
  const p = new URL(req.url).searchParams
  const q = { sort: p.get("sort") ?? "score", order: p.get("order") ?? "desc", cursor: p.get("cursor") ?? undefined }
  try {
    return Response.json(await queryRanking(env, q as RankingQuery))
  } catch (e) {
    if (e instanceof BadQueryError) return errorResponse(400, "bad-request", e.message)
    throw e
  }
}

async function detailHandler(req: Request, env: Env): Promise<Response> {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return errorResponse(400, "bad-request", "id is required")
  const detail = await getDetail(env, id)
  return detail ? Response.json(detail) : errorResponse(404, "not-found", "unknown task")
}

export const rankingRoutes: Route[] = [
  { method: "GET", path: "/api/ranking", handler: rankingHandler },
  { method: "GET", path: "/api/ranking/detail", handler: detailHandler },
]
