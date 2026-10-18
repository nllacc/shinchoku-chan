// レコードの値だけから保存先の行を作る純粋関数。保存先・時刻・乱数を読まない。
// 入力の型は必要な項目だけを持つ構造的な型で、lexicon のレコードの型がこれを満たす
import type { EntitlementFlags } from "./entitlement"
import type { EvaluationRow, OpenCheckinRow, ReportRow, TaskRow } from "./store"
import type { Window } from "./time"

export type StrongRef = { uri: string; cid: string }

export type EnrollmentLike = {
  task: StrongRef
  startedAt: string
  endsAt: string
  durationDays: number
  windows: Window[]
  dailyTarget: number
  scale: number
  startValue: number
  goalValue: number
}
export type TaskLike = {
  title: string
  summary: string
  goal: string
  metric: { name: string; unit: string }
  anchor: StrongRef
  startImage?: unknown
}
export type CheckinLike = {
  subject: string
  kind: "progress" | "result"
  seq?: number
  issuedAt: string
  expiresAt: string
}
export type ReceiptLike = {
  status: string
  record?: StrongRef
  value?: number
  receivedAt: string
}
export type UserReportLike = { note?: string; description?: string }
export type EvaluationLike = {
  scoreHundredths: number
  finalRatePermille: number
  missingCount: number
  algorithm: string
  finalizedAt: string
}

/** at:// の URI の末尾（キー）を取り出す */
export const rkeyOf = (uri: string): string => uri.slice(uri.lastIndexOf("/") + 1)
const ms = (iso: string) => Date.parse(iso)

/** task が null のとき（ユーザーの作業レコードが削除済み）は、自由記述を空にして withdrawn の行を作る */
export function taskRowFromRecords(i: {
  enrollment: EnrollmentLike
  enrollmentRef: StrongRef
  task: TaskLike | null
  owner: { did: string; handle: string; pds: string }
  flags: EntitlementFlags
}): TaskRow {
  const { enrollment: e, task: t } = i
  return {
    id: rkeyOf(i.enrollmentRef.uri),
    did: i.owner.did,
    handle: i.owner.handle,
    taskUri: e.task.uri,
    taskCid: e.task.cid,
    anchorUri: t?.anchor.uri ?? "",
    anchorCid: t?.anchor.cid ?? "",
    enrollmentUri: i.enrollmentRef.uri,
    enrollmentCid: i.enrollmentRef.cid,
    pds: i.owner.pds,
    title: t?.title ?? "",
    summary: t?.summary ?? "",
    goal: t?.goal ?? "",
    metricName: t?.metric.name ?? "",
    metricUnit: t?.metric.unit ?? "",
    scale: e.scale,
    startValue: e.startValue,
    goalValue: e.goalValue,
    durationDays: e.durationDays,
    dailyTarget: e.dailyTarget,
    windows: e.windows,
    startedAt: ms(e.startedAt),
    endsAt: ms(e.endsAt),
    evidenceRequired: Boolean(t?.startImage),
    priority: i.flags.priority,
    status: t ? "active" : "withdrawn",
    resultState: "none",
    lastNotifiedDay: null,
    notifiedWindows: 0,
    progressIssued: 0,
    checkedAt: 0,
  }
}

/** accepted の受領証だけを報告の行にする。結果報告の説明は note に入れる */
export function reportRowFromRecords(i: {
  receipt: ReceiptLike
  receiptRef: StrongRef
  kind: "progress" | "result"
  taskId: string
  userRecord: UserReportLike | null
  recordRef: StrongRef
}): ReportRow {
  if (i.receipt.status !== "accepted" || i.receipt.value === undefined) {
    throw new RangeError("only accepted receipts become report rows")
  }
  return {
    checkinId: rkeyOf(i.receiptRef.uri),
    taskId: i.taskId,
    kind: i.kind,
    receiptUri: i.receiptRef.uri,
    receiptCid: i.receiptRef.cid,
    recordUri: i.recordRef.uri,
    recordCid: i.recordRef.cid,
    value: i.receipt.value,
    receivedAt: ms(i.receipt.receivedAt),
    note: (i.kind === "result" ? i.userRecord?.description : i.userRecord?.note) ?? null,
    revoked: null,
    checkedAt: 0,
  }
}

export function openCheckinRowFromRecords(i: {
  checkin: CheckinLike
  checkinRef: StrongRef
  taskId: string
  replyUri: string | null
}): OpenCheckinRow {
  return {
    id: rkeyOf(i.checkinRef.uri),
    taskId: i.taskId,
    did: i.checkin.subject,
    kind: i.checkin.kind,
    seq: i.checkin.seq ?? null,
    checkinUri: i.checkinRef.uri,
    checkinCid: i.checkinRef.cid,
    replyUri: i.replyUri,
    issuedAt: ms(i.checkin.issuedAt),
    expiresAt: ms(i.checkin.expiresAt),
  }
}

export function evaluationRowFromRecords(i: {
  evaluation: EvaluationLike
  evaluationRef: StrongRef
  task: TaskRow
}): EvaluationRow {
  return {
    taskId: i.task.id,
    handle: i.task.handle,
    summary: i.task.summary,
    durationDays: i.task.durationDays,
    scoreHundredths: i.evaluation.scoreHundredths,
    finalRatePermille: i.evaluation.finalRatePermille,
    missingCount: i.evaluation.missingCount,
    algorithm: i.evaluation.algorithm,
    evaluationUri: i.evaluationRef.uri,
    finalizedAt: ms(i.evaluation.finalizedAt),
    stale: false,
    visible: i.task.status !== "withdrawn",
  }
}
