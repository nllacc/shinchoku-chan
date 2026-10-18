// 保存先の契約。実装（D1・メモリ）はこの型だけに依存させ、SQL などは実装の中に閉じる
import type { Env } from "./env"
import { createD1Store } from "./d1Store"
import type { Slot, Window } from "./time"

export type TaskStatus = "active" | "ended" | "withdrawn"
export type ResultState = "none" | "issued" | "accepted" | "expired"
export type CheckinKind = "progress" | "result"

export type TaskRow = {
  /** 受理レコードのキー */
  id: string
  did: string
  handle: string
  taskUri: string
  taskCid: string
  anchorUri: string
  anchorCid: string
  enrollmentUri: string
  enrollmentCid: string
  pds: string
  title: string
  summary: string
  goal: string
  metricName: string
  metricUnit: string
  scale: number
  startValue: number
  goalValue: number
  durationDays: number
  dailyTarget: number
  windows: Window[]
  startedAt: number
  endsAt: number
  evidenceRequired: boolean
  priority: boolean
  status: TaskStatus
  resultState: ResultState
  /** 最後に進捗の確認依頼を発行した日（日本時間の日番号） */
  lastNotifiedDay: number | null
  /** lastNotifiedDay の日に通知した窓の番号のビット列 */
  notifiedWindows: number
  progressIssued: number
  checkedAt: number
}
export type TaskMutable = Pick<
  TaskRow,
  | "status"
  | "resultState"
  | "lastNotifiedDay"
  | "notifiedWindows"
  | "progressIssued"
  | "checkedAt"
>

export type OpenCheckinRow = {
  id: string
  taskId: string
  did: string
  kind: CheckinKind
  seq: number | null
  checkinUri: string
  checkinCid: string
  replyUri: string | null
  issuedAt: number
  expiresAt: number
}

export type ReportRow = {
  checkinId: string
  taskId: string
  kind: CheckinKind
  receiptUri: string
  receiptCid: string
  recordUri: string
  recordCid: string
  value: number
  receivedAt: number
  note: string | null
  revoked: string | null
  checkedAt: number
}
export type ReportMutable = Pick<ReportRow, "revoked" | "checkedAt">

export type EvaluationRow = {
  taskId: string
  handle: string
  summary: string
  durationDays: number
  scoreHundredths: number
  finalRatePermille: number
  missingCount: number
  algorithm: string
  evaluationUri: string | null
  finalizedAt: number
  stale: boolean
  visible: boolean
}
export type EvaluationMutable = Pick<EvaluationRow, "stale" | "visible">
export type EvaluationPageQuery = {
  sort: "score" | "rate"
  order: "asc" | "desc"
  /** 前のページの最後の行の（基準値、finalizedAt、taskId） */
  after?: [number, number, string]
  limit: number
}

export type PlanTrigger = {
  id: string
  kind: "normal" | "priority"
  at: number
  slot?: Slot
  /** その帯に配分された通知時刻の数 */
  k?: number
  /** 計画を作った時点のその帯の無料ユーザー数 */
  users?: number
  taskId?: string
  window?: number
}
export type PlanRow = { dayStart: number; triggers: PlanTrigger[] }

export type BotSessionRow = {
  accessJwt: string
  refreshJwt: string
  expiresAt: number
}
export type EntitlementRow = {
  did: string
  plan: string
  /** JSON の文字列 */
  flags: string
  validUntil: number | null
}

export interface DataStore {
  botSession: {
    get(): Promise<BotSessionRow | null>
    put(row: BotSessionRow): Promise<void>
  }
  entitlements: {
    get(did: string): Promise<EntitlementRow | null>
    put(row: EntitlementRow): Promise<void>
  }
  plans: {
    get(dayStart: number): Promise<PlanRow | null>
    /** 先に保存された行があれば、保存せずにその行を返す */
    putIfAbsent(row: PlanRow): Promise<PlanRow>
  }
  tasks: {
    get(id: string): Promise<TaskRow | null>
    /** 見つかった行を ids の順に返す */
    getMany(ids: string[]): Promise<TaskRow[]>
    getByTaskUri(taskUri: string): Promise<TaskRow | null>
    put(row: TaskRow): Promise<void>
    putMany(rows: TaskRow[]): Promise<void>
    patch(id: string, fields: Partial<TaskMutable>): Promise<void>
    countActive(did: string): Promise<number>
    countActiveBySlot(dayStart: number): Promise<Record<Slot, number>>
    listPriority(dayStart: number, limit: number): Promise<TaskRow[]>
    listCandidates(now: number, limit: number): Promise<TaskRow[]>
    listPendingResult(now: number, limit: number): Promise<TaskRow[]>
    listFinalizable(now: number, limit: number): Promise<TaskRow[]>
    listDueForRecheck(before: number, limit: number): Promise<TaskRow[]>
  }
  openCheckins: {
    get(id: string): Promise<OpenCheckinRow | null>
    getMany(ids: string[]): Promise<OpenCheckinRow[]>
    put(row: OpenCheckinRow): Promise<void>
    putMany(rows: OpenCheckinRow[]): Promise<void>
    patch(id: string, fields: { replyUri: string }): Promise<void>
    delete(id: string): Promise<void>
    deleteMany(ids: string[]): Promise<void>
    listExpired(now: number, limit: number): Promise<OpenCheckinRow[]>
    listUnreplied(now: number, limit: number): Promise<OpenCheckinRow[]>
  }
  reports: {
    get(checkinId: string): Promise<ReportRow | null>
    put(row: ReportRow): Promise<void>
    putMany(rows: ReportRow[]): Promise<void>
    patch(checkinId: string, fields: Partial<ReportMutable>): Promise<void>
    listByTask(taskId: string): Promise<ReportRow[]>
    listDueForRecheck(before: number, limit: number): Promise<ReportRow[]>
  }
  evaluations: {
    get(taskId: string): Promise<EvaluationRow | null>
    getMany(ids: string[]): Promise<EvaluationRow[]>
    put(row: EvaluationRow): Promise<void>
    putMany(rows: EvaluationRow[]): Promise<void>
    patch(taskId: string, fields: Partial<EvaluationMutable>): Promise<void>
    listStale(limit: number): Promise<EvaluationRow[]>
    page(q: EvaluationPageQuery): Promise<EvaluationRow[]>
  }
}

/** STORE_KIND の値で保存先の実装を選ぶ。未知の値は例外を投げる */
export function createStore(env: Env): DataStore {
  const kind = env.STORE_KIND ?? "d1"
  if (kind === "d1") return createD1Store(env.DB)
  throw new Error(`unknown STORE_KIND: ${kind}`)
}
