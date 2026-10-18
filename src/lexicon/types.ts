import type { CollectionNsid, NSID } from "./nsid"

export type StrongRef = { uri: string; cid: string }

// アップロード済みの画像（blob）の参照
export type BlobRef = {
  $type: "blob"
  ref: { $link: string }
  mimeType: string
  size: number
}

export type Metric = {
  name: string
  unit: string
  scale: number
  startValue: number
  goalValue: number
}

export type Slot = "morning" | "noon" | "evening" | (string & {})

export type TimeWindow = { startMinute: number; endMinute: number }

export type TaskRecord = {
  summary: string
  title: string
  goal: string
  metric: Metric
  durationDays: number
  slot?: Slot
  startImage?: BlobRef
  anchor: StrongRef
  createdAt: string
}

export type ProgressRecord = {
  task: StrongRef
  checkin: StrongRef
  value: number
  note?: string
  evidence?: BlobRef
  createdAt: string
}

export type ResultRecord = {
  task: StrongRef
  checkin: StrongRef
  finalValue: number
  description: string
  evidence?: BlobRef
  createdAt: string
}

export type RecordMap = {
  [NSID.task]: TaskRecord
  [NSID.progress]: ProgressRecord
  [NSID.result]: ResultRecord
  [NSID.enrollment]: EnrollmentRecord
  [NSID.checkin]: CheckinRecord
  [NSID.receipt]: ReceiptRecord
  [NSID.revocation]: RevocationRecord
  [NSID.evaluation]: EvaluationRecord
}

// コレクション識別子から型を引く
export type RecordOf<K extends CollectionNsid> = RecordMap[K]

export type EnrollmentRecord = {
  subject: string
  task: StrongRef
  startedAt: string
  endsAt: string
  durationDays: number
  windows: TimeWindow[]
  dailyTarget: number
  scale: number
  startValue: number
  goalValue: number
}

export type CheckinRecord = {
  subject: string
  enrollment: StrongRef
  kind: "progress" | "result" | (string & {})
  seq?: number
  nonce: string
  issuedAt: string
  expiresAt: string
}

export type ReceiptRecord = {
  subject: string
  checkin: StrongRef
  status: "accepted" | "expired" | (string & {})
  record?: StrongRef
  value?: number
  receivedAt: string
}

export type RevocationRecord = {
  subject: string
  target: StrongRef
  reason: "tampered" | "deleted" | (string & {})
  detectedAt: string
}

export type EvaluationRecord = {
  subject: string
  enrollment: StrongRef
  algorithm: string
  scoreHundredths: number
  finalRatePermille: number
  missingCount: number
  finalizedAt: string
}
