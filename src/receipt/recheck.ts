// 受理済みレコードの再確認と取消
import { loadOptions } from "../platform/options"
import type { Env } from "../platform/env"
import { RecordNotFoundError, verifyCid } from "../platform/pds"
import { createStore } from "../platform/store"
import { NSID } from "../lexicon/nsid"
import type { RevocationRecord, StrongRef } from "../lexicon/types"
import { writeBotRecord } from "./botRepo"

const LIMIT = 10
const HOUR = 3_600_000

type Verdict = "same" | "tampered" | "deleted"

async function inspect(pds: string, uri: string, cid: string): Promise<Verdict> {
  try {
    const r = await verifyCid(pds, uri)
    return r.cid === cid ? "same" : "tampered"
  } catch (e) {
    if (e instanceof RecordNotFoundError) return "deleted"
    throw e
  }
}

export async function recheckRecords(now: number, env: Env): Promise<void> {
  const store = createStore(env)
  const before = now - loadOptions(env).recheckIntervalHours * HOUR
  const reports = await store.reports.listDueForRecheck(before, LIMIT)
  const tasks = await store.tasks.listDueForRecheck(before, LIMIT - reports.length)

  const revoke = (subject: string, target: StrongRef, reason: "tampered" | "deleted") => {
    const record: RevocationRecord = { subject, target, reason, detectedAt: new Date(now).toISOString() }
    return writeBotRecord(env, NSID.revocation, record)
  }

  for (const r of reports) {
    try {
      const task = await store.tasks.get(r.taskId)
      if (!task) continue
      const verdict = await inspect(task.pds, r.recordUri, r.recordCid)
      if (verdict === "same") await store.reports.patch(r.checkinId, { checkedAt: now })
      else {
        await revoke(task.did, { uri: r.receiptUri, cid: r.receiptCid }, verdict)
        await store.reports.patch(r.checkinId, { revoked: verdict, checkedAt: now })
        await store.evaluations.patch(r.taskId, { stale: true })
      }
    } catch (e) {
      console.warn(`recheck failed for report ${r.checkinId}: ${e instanceof Error ? e.message : e}`)
    }
  }

  for (const t of tasks) {
    try {
      const verdict = await inspect(t.pds, t.taskUri, t.taskCid)
      if (verdict === "same") await store.tasks.patch(t.id, { checkedAt: now })
      else {
        await revoke(t.did, { uri: t.enrollmentUri, cid: t.enrollmentCid }, verdict)
        await store.tasks.patch(t.id, { status: "withdrawn", checkedAt: now })
        await store.evaluations.patch(t.id, { visible: false })
      }
    } catch (e) {
      console.warn(`recheck failed for task ${t.id}: ${e instanceof Error ? e.message : e}`)
    }
  }
}
