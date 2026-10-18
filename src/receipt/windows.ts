// 通知窓の決定(朝昼夕の変換と1日の作業の自動選択)
import { jstDayStart, slotToWindow, windowToRange, type Slot, type Window } from "../platform/time"

const HOUR = 3_600_000
const SLOTS: Slot[] = ["morning", "noon", "evening"]
const MIN_WIDTH_MS = 60 * 60_000

export function decideWindows(task: { durationDays: number; slot?: string }, startedAt: number, endsAt: number): Window[] {
  // 未知の時間帯(将来追加された値)は、1日の作業と同じく自動で選ぶ
  const known = SLOTS.find((s) => s === task.slot)
  if (task.durationDays >= 2 && known) return [slotToWindow(known)]
  return [autoWindow(startedAt, endsAt)]
}

// 開始から 12 時間後を含む(なければ最も近い)朝・昼・夕の窓を選ぶ
export function autoWindow(startedAt: number, endsAt: number): Window {
  const target = startedAt + 12 * HOUR
  let best: { slot: Slot; distance: number; from: number } | null = null
  for (let day = jstDayStart(startedAt); day < endsAt; day += 24 * HOUR) {
    for (const slot of SLOTS) {
      const r = windowToRange(day, slotToWindow(slot))
      const from = Math.max(r.from, startedAt)
      const to = Math.min(r.to, endsAt)
      if (to - from < MIN_WIDTH_MS) continue
      const distance = target < from ? from - target : target > to ? target - to : 0
      if (!best || distance < best.distance || (distance === best.distance && from < best.from)) best = { slot, distance, from }
    }
  }
  // 期間が極端に短く候補がないときは夕を使う
  return slotToWindow(best?.slot ?? "evening")
}
