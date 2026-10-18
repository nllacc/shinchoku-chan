import { describe, expect, test } from "vitest"
import {
  dayNumber,
  jstDayStart,
  minuteOfDay,
  slotToWindow,
  windowToRange,
} from "../../src/platform/time"

const jst = (y: number, m: number, d: number, h = 0, min = 0) =>
  Date.UTC(y, m - 1, d, h, min) - 9 * 3_600_000

describe("time", () => {
  test("platform/AC-5: 日本時間の深夜0時が日の境界で、朝は480分から720分の窓になる", () => {
    expect(jstDayStart(jst(2026, 10, 1, 23, 59))).toBe(jst(2026, 10, 1))
    expect(jstDayStart(jst(2026, 10, 2, 0, 0))).toBe(jst(2026, 10, 2))
    expect(jstDayStart(jst(2026, 10, 1) - 1)).toBe(jst(2026, 9, 30))
    expect(slotToWindow("morning")).toEqual({ startMinute: 480, endMinute: 720 })
    expect(slotToWindow("noon")).toEqual({ startMinute: 720, endMinute: 960 })
    expect(slotToWindow("evening")).toEqual({ startMinute: 960, endMinute: 1200 })
  })

  test("窓を日の開始からの範囲へ変換する", () => {
    const day = jst(2026, 10, 1)
    expect(windowToRange(day, slotToWindow("morning"))).toEqual({
      from: day + 480 * 60_000,
      to: day + 720 * 60_000,
    })
  })

  test("日番号と日本時間の0時からの分", () => {
    expect(dayNumber(jst(1970, 1, 1))).toBe(0)
    expect(dayNumber(jst(1970, 1, 2) - 1)).toBe(0)
    expect(dayNumber(jst(1970, 1, 2))).toBe(1)
    expect(minuteOfDay(jst(2026, 10, 1, 9, 30))).toBe(570)
    expect(minuteOfDay(jst(2026, 10, 1, 23, 59))).toBe(1439)
    expect(minuteOfDay(jst(2026, 10, 2, 0, 0))).toBe(0)
  })
})
