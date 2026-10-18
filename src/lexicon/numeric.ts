// 整数スケール値の変換と進捗率の算出（浮動小数点を保存せず、scale 倍した整数で保持する）
export function toScaled(value: number, scale: number): number {
  return Math.round(value * 10 ** scale)
}

export function fromScaled(scaled: number, scale: number): number {
  return scaled / 10 ** scale
}

// 開始値を 0、ゴール値を 1000 とした進捗率（千分率）。ゴールを超えれば 1000 を超える
export function progressPermille(
  range: { startValue: number; goalValue: number },
  value: number,
): number {
  if (range.startValue === range.goalValue)
    throw new RangeError("metric-range-empty")
  return Math.round(
    ((value - range.startValue) * 1000) / (range.goalValue - range.startValue),
  )
}
