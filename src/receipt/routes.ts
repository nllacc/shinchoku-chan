// 受理依頼の API 経路
import type { Env } from "../platform/env"
import { createStore } from "../platform/store"
import { errorResponse, type Route } from "../worker/router"
import { NSID } from "../lexicon/nsid"
import { readBotRecord } from "./botRepo"
import { enrollTask } from "./enroll"
import { submitReport } from "./submit"

async function bodyOf(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json()
    return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const retryable = (status: number) => status === 502

async function enrollHandler(req: Request, env: Env): Promise<Response> {
  const body = await bodyOf(req)
  if (typeof body?.taskUri !== "string") return errorResponse(422, "bad-request", "taskUri is required")
  const r = await enrollTask(env, body.taskUri, Date.now())
  if (!r.ok) return errorResponse(r.status, r.reason, r.reason, retryable(r.status))
  return Response.json({ taskId: r.taskId, startedAt: r.startedAt, endsAt: r.endsAt, windows: r.windows })
}

async function submitHandler(req: Request, env: Env): Promise<Response> {
  const body = await bodyOf(req)
  if (typeof body?.recordUri !== "string") return errorResponse(422, "bad-request", "recordUri is required")
  const r = await submitReport(env, body.recordUri, Date.now())
  if (!r.ok) return errorResponse(r.status, r.reason, r.reason, retryable(r.status))
  return Response.json({ status: r.status, receiptUri: r.receiptUri })
}

async function checkinHandler(req: Request, env: Env): Promise<Response> {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return errorResponse(422, "bad-request", "id is required")
  const store = createStore(env)
  const now = Date.now()
  const open = await store.openCheckins.get(id)
  if (!open) {
    const receipt = await readBotRecord(env, NSID.receipt, id).catch(() => null)
    if (!receipt) return errorResponse(404, "not-found", "unknown checkin")
    return Response.json({ now, status: receipt.value.status })
  }
  const task = await store.tasks.get(open.taskId)
  if (!task) return errorResponse(404, "not-found", "unknown task")
  return Response.json({
    now,
    did: open.did,
    kind: open.kind,
    status: "issued",
    expiresAt: open.expiresAt,
    taskRef: { uri: task.taskUri, cid: task.taskCid },
    checkinRef: { uri: open.checkinUri, cid: open.checkinCid },
    metric: { name: task.metricName, unit: task.metricUnit, scale: task.scale, startValue: task.startValue, goalValue: task.goalValue },
    evidenceRequired: task.evidenceRequired,
    taskSummary: task.title,
  })
}

export const receiptRoutes: Route[] = [
  { method: "POST", path: "/api/enroll", handler: enrollHandler },
  { method: "POST", path: "/api/submit", handler: submitHandler },
  { method: "GET", path: "/api/checkin", handler: checkinHandler },
]
