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
}

// コレクション識別子から型を引く
export type RecordOf<K extends CollectionNsid> = K extends keyof RecordMap ? RecordMap[K] : never
