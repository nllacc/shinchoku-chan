import type { CheckinRecord, EnrollmentRecord, ProgressRecord, ReceiptRecord, ResultRecord, TaskRecord } from "../../src/lexicon/types"

export const ref = {
  uri: "at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/app.bsky.feed.post/3kaaaaaaaaaaa",
  cid: "bafyreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
}
export const did = "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa"
export const at = "2026-10-18T00:00:00.000Z"
export const later = "2026-10-19T00:00:00.000Z"

export const task = (over: Partial<TaskRecord> = {}): TaskRecord => ({
  summary: "毎日ランニングする",
  title: "ランニング",
  goal: "30km 走る",
  metric: { name: "距離", unit: "km", scale: 1, startValue: 0, goalValue: 300 },
  durationDays: 3,
  slot: "morning",
  anchor: ref,
  createdAt: at,
  ...over,
})

export const progress = (): ProgressRecord => ({ task: ref, checkin: ref, value: 100, createdAt: at })
export const result = (): ResultRecord => ({ task: ref, checkin: ref, finalValue: 300, description: "達成した", createdAt: at })

export const enrollment = (): EnrollmentRecord => ({
  subject: did, task: ref, startedAt: at, endsAt: later, durationDays: 1,
  windows: [{ startMinute: 480, endMinute: 720 }], dailyTarget: 1, scale: 1, startValue: 0, goalValue: 300,
})
export const checkin = (): CheckinRecord => ({
  subject: did, enrollment: ref, kind: "progress", seq: 1, nonce: "a".repeat(22), issuedAt: at, expiresAt: later,
})
export const receipt = (): ReceiptRecord => ({ subject: did, checkin: ref, status: "accepted", record: ref, value: 100, receivedAt: at })
