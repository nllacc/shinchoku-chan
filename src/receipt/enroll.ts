// 作業の受理
import { getEntitlement } from "../platform/entitlement"
import type { Env } from "../platform/env"
import { RecordNotFoundError, resolveDid, verifyCid } from "../platform/pds"
import { enrollmentKey } from "../platform/rkey"
import { taskRowFromRecords } from "../platform/rows"
import { createStore } from "../platform/store"
import type { Window } from "../platform/time"
import { NSID } from "../lexicon/nsid"
import type { EnrollmentRecord, TaskRecord } from "../lexicon/types"
import { validateRecord } from "../lexicon/validate"
import { verifyAnchor } from "./anchor"
import { readBotRecord, writeBotRecord } from "./botRepo"
import { decideWindows } from "./windows"

const DAY_MS = 86_400_000

export type EnrollResult =
  | { ok: true; taskId: string; startedAt: number; endsAt: number; windows: Window[] }
  | { ok: false; status: 409 | 422 | 502; reason: string }

const fail = (status: 409 | 422 | 502, reason: string): EnrollResult => ({ ok: false, status, reason })

export async function enrollTask(env: Env, taskUri: string, now: number): Promise<EnrollResult> {
  // 1. collection が task であること
  const [scheme, , did, collection, rkey] = taskUri.split("/")
  if (scheme !== "at:" || !did?.startsWith("did:") || collection !== NSID.task || !rkey) return fail(422, "bad-uri")

  // 2. 登録済みなら保存済みの結果を返す
  const store = createStore(env)
  const done = await store.tasks.getByTaskUri(taskUri)
  if (done) return { ok: true, taskId: done.id, startedAt: done.startedAt, endsAt: done.endsAt, windows: done.windows }

  // 3. PDS と handle を解決し、レコードを取得して CID を照合、構造と意味規則を検証する
  let owner: { pds: string; handle: string }
  let got: { ok: boolean; cid: string; value: unknown }
  try {
    const r = await resolveDid(did)
    owner = { pds: r.pds, handle: r.handle ?? did }
    got = await verifyCid(owner.pds, taskUri)
  } catch (e) {
    if (e instanceof RecordNotFoundError) return fail(422, "invalid-record")
    return fail(502, "pds-unreachable")
  }
  if (!got.ok) return fail(422, "invalid-record")
  if (!validateRecord(NSID.task, got.value).ok) return fail(422, "invalid-record")
  const task = got.value as TaskRecord

  // 4. 起点投稿
  try {
    if (!(await verifyAnchor(env, did, task.anchor))) return fail(422, "anchor-invalid")
  } catch {
    return fail(502, "pds-unreachable")
  }

  // 5. 同時進行数
  const flags = await getEntitlement(env, did, now)
  if ((await store.tasks.countActive(did)) >= flags.maxConcurrentTasks) return fail(409, "limit-reached")

  // 6-7. 通知窓と期間
  const startedAt = now
  const endsAt = now + task.durationDays * DAY_MS
  const windows = decideWindows(task, startedAt, endsAt)

  // 8. Bot のリポジトリへ受理レコードを作る(同じキーがあれば既存の内容を使う)
  const key = await enrollmentKey(env.RKEY_SECRET, taskUri)
  const record: EnrollmentRecord = {
    subject: did,
    task: { uri: taskUri, cid: got.cid },
    startedAt: new Date(startedAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
    durationDays: task.durationDays,
    windows,
    dailyTarget: 1,
    scale: task.metric.scale,
    startValue: task.metric.startValue,
    goalValue: task.metric.goalValue,
  }
  let enrollment: EnrollmentRecord = record
  let ref
  try {
    const w = await writeBotRecord(env, NSID.enrollment, record, key)
    ref = w.ref
    if (!w.created) {
      const existing = await readBotRecord(env, NSID.enrollment, key)
      if (existing) enrollment = existing.value as EnrollmentRecord
    }
  } catch {
    return fail(502, "bot-write-failed")
  }

  // 9. 行を作って登録する
  try {
    const row = taskRowFromRecords({ enrollment, enrollmentRef: ref, task, owner: { did, ...owner }, flags })
    await store.tasks.put(row)
    return { ok: true, taskId: row.id, startedAt: row.startedAt, endsAt: row.endsAt, windows: row.windows }
  } catch {
    return fail(502, "store-failed")
  }
}
