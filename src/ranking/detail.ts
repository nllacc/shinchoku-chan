// 詳細の組み立てと画像の URL
import type { Env } from "../platform/env"
import { verifyCid } from "../platform/pds"
import { createStore } from "../platform/store"
import { profileUrl } from "./query"

export type RankingDetail = {
  taskId: string
  handle: string
  profileUrl: string
  title: string
  summary: string
  goal: string
  metric: { name: string; unit: string; scale: number; startValue: number; goalValue: number }
  durationDays: number
  startedAt: number
  endsAt: number
  scoreHundredths: number
  finalRatePermille: number
  missingCount: number
  resultDescription: string | null
  startImageUrl?: string
  evidenceUrl?: string
}

const blobUrl = (pds: string, did: string, cid: string) =>
  `${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`

// 公開レコードから画像の CID を取り出す。削除済み・到達不能・CID 不一致のときは省略する
async function imageCid(pds: string, uri: string, field: string): Promise<string | undefined> {
  try {
    const got = await verifyCid(pds, uri)
    if (!got.ok) return undefined
    const cid = (got.value as Record<string, { ref?: { $link?: string } } | undefined>)[field]?.ref?.$link
    return typeof cid === "string" ? cid : undefined
  } catch {
    return undefined
  }
}

export async function getDetail(env: Env, taskId: string): Promise<RankingDetail | null> {
  const store = createStore(env)
  const [task, evaluation, reports] = await Promise.all([store.tasks.get(taskId), store.evaluations.get(taskId), store.reports.listByTask(taskId)])
  if (!task || !evaluation || !evaluation.visible) return null
  const result = reports.find((r) => r.kind === "result" && r.revoked === null)

  const [startCid, evidenceCid] = await Promise.all([
    task.evidenceRequired ? imageCid(task.pds, task.taskUri, "startImage") : undefined,
    result ? imageCid(task.pds, result.recordUri, "evidence") : undefined,
  ])
  return {
    taskId: task.id,
    handle: task.handle,
    profileUrl: profileUrl(task.handle),
    title: task.title,
    summary: task.summary,
    goal: task.goal,
    metric: { name: task.metricName, unit: task.metricUnit, scale: task.scale, startValue: task.startValue, goalValue: task.goalValue },
    durationDays: task.durationDays,
    startedAt: task.startedAt,
    endsAt: task.endsAt,
    scoreHundredths: evaluation.scoreHundredths,
    finalRatePermille: evaluation.finalRatePermille,
    missingCount: evaluation.missingCount,
    resultDescription: result?.note ?? null,
    startImageUrl: startCid ? blobUrl(task.pds, task.did, startCid) : undefined,
    evidenceUrl: evidenceCid ? blobUrl(task.pds, task.did, evidenceCid) : undefined,
  }
}
