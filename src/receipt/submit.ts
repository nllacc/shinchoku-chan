// 進捗報告と結果報告の受理
import type { Env } from "../platform/env"
import { RecordNotFoundError, resolveDid, verifyCid } from "../platform/pds"
import { reportRowFromRecords, rkeyOf } from "../platform/rows"
import { createStore } from "../platform/store"
import { NSID } from "../lexicon/nsid"
import type { ProgressRecord, ReceiptRecord, ResultRecord, StrongRef } from "../lexicon/types"
import { validateRecord } from "../lexicon/validate"
import { readBotRecord, writeBotRecord } from "./botRepo"

export type SubmitResult =
  | { ok: true; status: "accepted"; receiptUri: string }
  | { ok: false; status: 409 | 410 | 422 | 502; reason: string; receiptUri?: string }

const fail = (status: 409 | 410 | 422 | 502, reason: string, receiptUri?: string): SubmitResult => ({ ok: false, status, reason, receiptUri })

export async function submitReport(env: Env, recordUri: string, now: number): Promise<SubmitResult> {
  // 1. collection が progress または result であること
  const [scheme, , did, collection, rkey] = recordUri.split("/")
  const kind = collection === NSID.progress ? "progress" : collection === NSID.result ? "result" : null
  if (scheme !== "at:" || !did?.startsWith("did:") || !kind || !rkey) return fail(422, "bad-uri")

  // 2. PDS から取得し CID を照合、構造と意味規則を検証する
  let pds: string
  let got: { ok: boolean; cid: string; value: unknown }
  try {
    pds = (await resolveDid(did)).pds
    got = await verifyCid(pds, recordUri)
  } catch (e) {
    if (e instanceof RecordNotFoundError) return fail(422, "invalid-record")
    return fail(502, "pds-unreachable")
  }
  if (!got.ok || !validateRecord(collection as typeof NSID.progress | typeof NSID.result, got.value).ok) return fail(422, "invalid-record")
  const record = got.value as ProgressRecord & Partial<ResultRecord>
  const value = kind === "progress" ? record.value! : record.finalValue!

  // 3. 確認依頼を引く。なければ受領証の有無で二重か不整合かを分ける
  const store = createStore(env)
  const checkinKey = rkeyOf(record.checkin.uri)
  const open = await store.openCheckins.get(checkinKey)
  if (!open) {
    try {
      const existing = await readBotRecord(env, NSID.receipt, checkinKey)
      return existing ? fail(409, "duplicate", existing.ref.uri) : fail(422, "mismatch")
    } catch {
      return fail(502, "bot-read-failed")
    }
  }

  // 4. 期限(Bot の受信時刻で判定する。記録の createdAt は使わない)
  if (now > open.expiresAt) return fail(410, "expired")

  // 5. 参照の整合
  const task = await store.tasks.get(open.taskId)
  if (
    !task ||
    did !== open.did ||
    kind !== open.kind ||
    record.task.uri !== task.taskUri ||
    record.task.cid !== task.taskCid ||
    record.checkin.uri !== open.checkinUri ||
    record.checkin.cid !== open.checkinCid
  ) {
    return fail(422, "mismatch")
  }

  // 6. 開始前の画像があった作業は、証跡画像が実在すること
  if (task.evidenceRequired) {
    const cid = record.evidence?.ref?.$link
    if (!cid) return fail(422, "evidence-missing")
    try {
      const head = await fetch(`${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`, { method: "HEAD" })
      if (!head.ok) return fail(422, "evidence-missing")
    } catch {
      return fail(502, "pds-unreachable")
    }
  }

  // 7-8. 受領証を確認依頼と同じキーで作る。作成済みなら同じ記録に対するものだけを受け入れる
  const receipt: ReceiptRecord = {
    subject: did,
    checkin: { uri: open.checkinUri, cid: open.checkinCid },
    status: "accepted",
    record: { uri: recordUri, cid: got.cid },
    value,
    receivedAt: new Date(now).toISOString(),
  }
  let receiptRef: StrongRef
  let accepted: ReceiptRecord = receipt
  try {
    const w = await writeBotRecord(env, NSID.receipt, receipt, checkinKey)
    receiptRef = w.ref
    if (!w.created) {
      const existing = await readBotRecord(env, NSID.receipt, checkinKey)
      accepted = (existing?.value as ReceiptRecord | undefined) ?? receipt
      if (accepted.status !== "accepted" || accepted.record?.uri !== recordUri) return fail(409, "duplicate", receiptRef.uri)
    }
  } catch {
    return fail(502, "bot-write-failed")
  }

  // 9. 保存先へ登録する
  try {
    await store.reports.put(
      reportRowFromRecords({ receipt: accepted, receiptRef, kind, taskId: task.id, userRecord: record, recordRef: { uri: recordUri, cid: got.cid } }),
    )
    await store.openCheckins.delete(open.id)
    if (kind === "result") await store.tasks.patch(task.id, { resultState: "accepted" })
  } catch {
    return fail(502, "store-failed")
  }
  return { ok: true, status: "accepted", receiptUri: receiptRef.uri }
}
