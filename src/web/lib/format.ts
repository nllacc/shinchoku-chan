// 評価点・進捗度・期間の表示形式
export function formatScore(scoreHundredths: number): string {
  return (scoreHundredths / 100).toFixed(2)
}

export function formatRate(permille: number): string {
  return `${Math.round(permille / 10)}%`
}

export const formatPeriod = (days: number): string => `${days}日間`

// ミリ秒を「M/D HH:mm」(日本時間)で表す
export function formatDateTime(ms: number): string {
  const d = new Date(ms + 9 * 3_600_000)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

// 0 時からの分を「HH:mm」で表す
export const formatMinute = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
