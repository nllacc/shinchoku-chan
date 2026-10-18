import { describe, expect, test } from "vitest"
import { autoWindow, decideWindows } from "../../src/receipt/windows"

// 2026-10-19(月)の日本時間 h 時
const jst = (h: number, day = 19) => Date.parse(`2026-10-${String(day).padStart(2, "0")}T00:00:00.000Z`) - 9 * 3_600_000 + h * 3_600_000
const DAY = 86_400_000
const MORNING = { startMinute: 480, endMinute: 720 }
const EVENING = { startMinute: 960, endMinute: 1200 }

describe("windows", () => {
  test("receipt/AC-5: 期間が3日で朝を選んだ作業の通知窓が480分から720分になる", () => {
    expect(decideWindows({ durationDays: 3, slot: "morning" }, jst(10), jst(10) + 3 * DAY)).toEqual([MORNING])
  })

  test("receipt/AC-6: 10時開始の1日作業では、22時に最も近い夕の窓が選ばれる", () => {
    expect(autoWindow(jst(10), jst(10) + DAY)).toEqual(EVENING)
  })

  test("設計の表: 7時開始は夕、21時開始は翌朝", () => {
    expect(autoWindow(jst(7), jst(7) + DAY)).toEqual(EVENING)
    expect(autoWindow(jst(21), jst(21) + DAY)).toEqual(MORNING)
  })

  test("1日の作業は時間帯の指定があっても自動で選ぶ", () => {
    expect(decideWindows({ durationDays: 1, slot: "morning" }, jst(10), jst(10) + DAY)).toEqual([EVENING])
  })

  test("未知の時間帯は自動で選ぶ", () => {
    expect(decideWindows({ durationDays: 3, slot: "midnight" }, jst(10), jst(10) + 3 * DAY)).toHaveLength(1)
  })

  test("60分未満に切り取られる候補は選ばれない", () => {
    // 19:30 開始・翌 19:30 終了: 当日の夕は 30 分、翌日の夕は 3.5 時間。目標 07:30 → 翌朝(8:00-12:00)が最も近い
    expect(autoWindow(jst(19.5), jst(19.5) + DAY)).toEqual(MORNING)
  })
})
