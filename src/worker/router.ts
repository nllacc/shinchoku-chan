// APIの経路表と共通の応答形式
import type { Env } from "../platform/env"

export type ApiError = {
  error: { kind: string; message: string; retryable: boolean }
}

export type Route = {
  method: "GET" | "POST"
  path: string
  handler: (req: Request, env: Env) => Promise<Response>
}

export function errorResponse(
  status: number,
  kind: string,
  message: string,
  retryable = false,
): Response {
  const body: ApiError = { error: { kind, message, retryable } }
  return Response.json(body, { status })
}

export async function route(
  req: Request,
  env: Env,
  routes: Route[],
): Promise<Response> {
  const url = new URL(req.url)
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req)
  const hit = routes.find((r) => r.path === url.pathname && r.method === req.method)
  if (!hit) return errorResponse(404, "not-found", `no route: ${req.method} ${url.pathname}`)
  try {
    return await hit.handler(req, env)
  } catch (e) {
    console.error("handler failed", e)
    return errorResponse(500, "internal", "internal error", true)
  }
}
