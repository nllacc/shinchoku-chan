// 評価の入力の組み立て・確定・再評価
import { loadOptions } from "../platform/options"
import type { Env } from "../platform/env"
import { evaluationRowFromRecords } from "../platform/rows"
import { createStore, type ReportRow, type TaskRow } from "../platform/store"
import { progressPermille } from "../lexicon/numeric"
import { NSID } from "../lexicon/nsid"
import type { EvaluationRecord } from "../lexicon/types"
import { writeBotRecord } from "../receipt/botRepo"
import { computeScore, type ScoreInput, type ScoreResult } from "../scoring/score"

const LIMIT = 5

export function buildScoreInput(task: TaskRow, reports: ReportRow[]): ScoreInput {
  const range = { startValue: task.startValue, goalValue: task.goalValue }
  const alive = reports.filter((r) => r.revoked === null)
  const progress = alive.filter((r) => r.kind === "progress")
  const result = alive.find((r) => r.kind === "result")
  return {
    startedAt: task.startedAt,
    endsAt: task.endsAt,
    dailyTarget: task.dailyTarget,
    records: progress.map((r) => ({ at: r.receivedAt, permille: progressPermille(range, r.value) })),
    final: result ? { permille: progressPermille(range, result.value) } : null,
  }
}

// 評価のレコードを Bot のリポジトリへ追加し、データベースの行を置き換える
async function evaluate(task: TaskRow, now: number, env: Env): Promise<void> {
  const store = createStore(env)
  const opts = loadOptions(env)
  const score: ScoreResult = computeScore(buildScoreInput(task, await store.reports.listByTask(task.id)), {
    penaltyPerMissingHundredths: opts.penaltyPerMissingHundredths,
    penaltyCapHundredths: opts.penaltyCapHundredths,
  })
  const evaluation: EvaluationRecord = {
    subject: task.did,
    enrollment: { uri: task.enrollmentUri, cid: task.enrollmentCid },
    algorithm: score.algorithm,
    scoreHundredths: score.scoreHundredths,
    finalRatePermille: score.finalRatePermille,
    missingCount: score.missingCount,
    finalizedAt: new Date(now).toISOString(),
  }
  const { ref } = await writeBotRecord(env, NSID.evaluation, evaluation)
  await store.evaluations.put(evaluationRowFromRecords({ evaluation, evaluationRef: ref, task }))
}

/** 結果確認が済んだ終了済みの作業を、1回につき 5 件まで評価する */
export async function finalizeTasks(now: number, env: Env): Promise<void> {
  const store = createStore(env)
  for (const task of await store.tasks.listFinalizable(now, LIMIT)) {
    try {
      await evaluate(task, now, env)
      await store.tasks.patch(task.id, { status: "ended" })
    } catch (e) {
      // 作業は active のまま残り、次の定期実行で再試行される
      console.warn(`finalize failed for ${task.id}: ${e instanceof Error ? e.message : e}`)
    }
  }
}

/** 取消で古くなった評価を、取消を除いて 5 件まで再評価する */
export async function reevaluateStale(now: number, env: Env): Promise<void> {
  const store = createStore(env)
  for (const row of await store.evaluations.listStale(LIMIT)) {
    try {
      const task = await store.tasks.get(row.taskId)
      if (!task || task.status === "withdrawn" || !row.visible) {
        // 取り下げられた作業は対象外のまま。再び選ばれないよう stale だけ戻す
        await store.evaluations.patch(row.taskId, { stale: false })
        continue
      }
      await evaluate(task, now, env)
    } catch (e) {
      console.warn(`reevaluate failed for ${row.taskId}: ${e instanceof Error ? e.message : e}`)
    }
  }
}
