import { createStore, type ReportRow, type TaskRow } from "../../src/platform/store"
import { FakeNet, enrolled, testEnv } from "../receipt/fakeNet"

export const NOW = Date.parse("2026-10-19T01:00:00.000Z")
export const DAY = 86_400_000

export const reportRow = (task: TaskRow, over: Partial<ReportRow> = {}): ReportRow => ({
  checkinId: `c${Math.random().toString(36).slice(2, 10)}`,
  taskId: task.id,
  kind: "progress",
  receiptUri: `at://did:plc:bot/x.bot.receipt/${Math.random().toString(36).slice(2, 8)}`,
  receiptCid: "bafyreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
  recordUri: "at://did:plc:u/x.progress/1",
  recordCid: "bafyreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
  value: 0,
  receivedAt: task.startedAt + DAY / 2,
  note: null,
  revoked: null,
  checkedAt: 0,
  ...over,
})

/** 受理済みで、期間が終わり、結果確認が済んだ作業を作る(指標は 0〜300、scale 1) */
export async function endedTask(net: FakeNet, over: Partial<TaskRow> = {}, state: TaskRow["resultState"] = "accepted") {
  const { row } = await enrolled(net, NOW, { durationDays: 2, slot: "morning" })
  const task: TaskRow = { ...row, resultState: state, ...over }
  await createStore(testEnv).tasks.put(task)
  return task
}

/** 作業の複製(別の作業 ID・URI として) */
export async function cloneTask(task: TaskRow, n: number, over: Partial<TaskRow> = {}) {
  const copy: TaskRow = { ...task, id: `${task.id}-${n}`, taskUri: `${task.taskUri}-${n}`, ...over }
  await createStore(testEnv).tasks.put(copy)
  return copy
}
