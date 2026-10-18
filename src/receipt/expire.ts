// 期限切れの受領証の作成
import type { Env } from "../platform/env"
import { verifyCid } from "../platform/pds"
import { reportRowFromRecords } from "../platform/rows"
import { createStore } from "../platform/store"
import { NSID } from "../lexicon/nsid"
import type { ReceiptRecord } from "../lexicon/types"
import { readBotRecord, writeBotRecord } from "./botRepo"

const LIMIT = 20

export async function expireCheckins(now: number, env: Env): Promise<void> {
  const store = createStore(env)
  for (const open of await store.openCheckins.listExpired(now, LIMIT)) {
    try {
      const receipt: ReceiptRecord = {
        subject: open.did,
        checkin: { uri: open.checkinUri, cid: open.checkinCid },
        status: "expired",
        receivedAt: new Date(now).toISOString(),
      }
      const w = await writeBotRecord(env, NSID.receipt, receipt, open.id)
      let acceptedLate = false
      if (!w.created) {
        // 期限の直前に受理された報告の登録が途中で止まっていた場合は、その登録を完了させる
        const existing = await readBotRecord(env, NSID.receipt, open.id)
        const value = existing?.value as ReceiptRecord | undefined
        if (value?.status === "accepted" && value.record) {
          const task = await store.tasks.get(open.taskId)
          const rec = await verifyCid(task?.pds ?? "", value.record.uri)
          await store.reports.put(
            reportRowFromRecords({ receipt: value, receiptRef: w.ref, kind: open.kind, taskId: open.taskId, userRecord: rec.value as never, recordRef: value.record }),
          )
          acceptedLate = true
        }
      }
      if (open.kind === "result") await store.tasks.patch(open.taskId, { resultState: acceptedLate ? "accepted" : "expired" })
      await store.openCheckins.delete(open.id)
    } catch (e) {
      // その行は次の定期実行で再試行する
      console.warn(`expire failed for ${open.id}: ${e instanceof Error ? e.message : e}`)
    }
  }
}
