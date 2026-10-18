import { deviationArea } from "./area"
import { buildCurve, clamp01 } from "./curve"
import { fillMissing } from "./missing"

export type ScoreOptions = {
  penaltyPerMissingHundredths: number // 既定 200
  penaltyCapHundredths: number // 既定 1000
}

export const DEFAULT_SCORE_OPTIONS: ScoreOptions = {
  penaltyPerMissingHundredths: 200,
  penaltyCapHundredths: 1000,
}

export type ScoreInput = {
  startedAt: number // ミリ秒
  endsAt: number
  dailyTarget: number // 1 以上 10 以下
  records: { at: number; permille: number }[] // 受理された進捗記録
  final: { permille: number } | null // 受理された結果報告
}

export type ScoreResult = {
  algorithm: "linear-v1"
  scoreHundredths: number // 0 以上 10000 以下
  finalRatePermille: number
  missingCount: number
}

function validate(input: ScoreInput): void {
  if (!Number.isInteger(input.dailyTarget) || input.dailyTarget < 1 || input.dailyTarget > 10) {
    throw new RangeError(`dailyTarget: ${input.dailyTarget}`)
  }
  if (!Number.isFinite(input.startedAt) || !Number.isFinite(input.endsAt) || input.endsAt <= input.startedAt) {
    throw new RangeError("period")
  }
  const values = [...input.records.map((r) => r.permille), ...(input.final ? [input.final.permille] : [])]
  if (values.some((v) => typeof v !== "number" || !Number.isFinite(v))) throw new RangeError("permille")
}

export function computeScore(input: ScoreInput, options: ScoreOptions = DEFAULT_SCORE_OPTIONS): ScoreResult {
  validate(input)
  // 期間外の記録は無視する
  const inRange = input.records.filter((r) => r.at >= input.startedAt && r.at <= input.endsAt)
  const scoped: ScoreInput = { ...input, records: inRange }
  const { points, missingCount, penaltyHundredths } = fillMissing(scoped, options)
  const curve = buildCurve(scoped, points)
  const area = deviationArea(curve)
  const base = 10000 - Math.round(area * 2 * 10000)
  const end = curve[curve.length - 1]!.y
  return {
    algorithm: "linear-v1",
    scoreHundredths: Math.min(10000, Math.max(0, base - penaltyHundredths)),
    finalRatePermille: Math.round(clamp01(end) * 1000),
    missingCount,
  }
}
