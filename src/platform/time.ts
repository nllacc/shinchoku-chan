// 日本時間の日境界と通知窓の変換
export type Window = { startMinute: number; endMinute: number }
export type Slot = "morning" | "noon" | "evening"

export const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 86_400_000

/** ms を含む日本時間の日の開始時刻（UTC のミリ秒） */
export function jstDayStart(ms: number): number {
  return Math.floor((ms + JST_OFFSET_MS) / DAY_MS) * DAY_MS - JST_OFFSET_MS
}

/** 日本時間の日番号（1970-01-01 を 0 とする） */
export function dayNumber(ms: number): number {
  return Math.floor((ms + JST_OFFSET_MS) / DAY_MS)
}

/** 日本時間の 0 時からの分（0 以上 1440 未満） */
export function minuteOfDay(ms: number): number {
  return Math.floor((((ms + JST_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS / 60_000)
}

const SLOT_WINDOWS: Record<Slot, Window> = {
  morning: { startMinute: 480, endMinute: 720 },
  noon: { startMinute: 720, endMinute: 960 },
  evening: { startMinute: 960, endMinute: 1200 },
}

export function slotToWindow(slot: Slot): Window {
  return { ...SLOT_WINDOWS[slot] }
}

export function windowToRange(
  dayStart: number,
  w: Window,
): { from: number; to: number } {
  return {
    from: dayStart + w.startMinute * 60_000,
    to: dayStart + w.endMinute * 60_000,
  }
}
