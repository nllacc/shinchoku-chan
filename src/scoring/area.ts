import type { Point } from "./curve"

// 区間ごとに |曲線 − x| を積分する。符号が変わる区間は交点で分ける
export function deviationArea(curve: Point[]): number {
  let area = 0
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1]!
    const b = curve[i]!
    const w = b.x - a.x
    const d0 = a.y - a.x
    const d1 = b.y - b.x
    if (d0 * d1 >= 0) area += ((Math.abs(d0) + Math.abs(d1)) / 2) * w
    else {
      const t = Math.abs(d0) / (Math.abs(d0) + Math.abs(d1))
      area += ((Math.abs(d0) * t + Math.abs(d1) * (1 - t)) / 2) * w
    }
  }
  return area
}
