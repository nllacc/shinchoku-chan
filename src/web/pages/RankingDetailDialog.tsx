import { useCallback, useEffect, useState } from "react"
import { ApiError } from "../lib/apiError"
import { formatDateTime, formatPeriod, formatRate, formatScore } from "../lib/format"
import { fetchDetail, type RankingDetail } from "../lib/rankingApi"
import { Button } from "../ui/Button"
import { Dialog } from "../ui/Dialog"
import styles from "./RankingDetailDialog.module.css"

type State = { status: "loading" } | { status: "ready"; detail: RankingDetail } | { status: "notfound" } | { status: "failed"; error: ApiError }

// 読み込めない画像は要素ごと取り除く
function Picture({ src, alt, label }: { src?: string; alt: string; label: string }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return null
  return (
    <figure className={styles.figure}>
      <img className={styles.image} src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />
      <figcaption>{label}</figcaption>
    </figure>
  )
}

export function RankingDetailDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const [state, setState] = useState<State>({ status: "loading" })

  const load = useCallback(async () => {
    setState({ status: "loading" })
    try {
      const detail = await fetchDetail(taskId)
      setState(detail ? { status: "ready", detail } : { status: "notfound" })
    } catch (e) {
      setState({ status: "failed", error: e instanceof ApiError ? e : new ApiError(0, "unknown", "エラーが発生しました", true) })
    }
  }, [taskId])

  useEffect(() => {
    void load()
  }, [load])

  const d = state.status === "ready" ? state.detail : null
  const metric = d?.metric
  const unit = metric ? ` ${metric.unit}` : ""
  const value = (scaled: number) => (metric ? `${scaled / 10 ** metric.scale}${unit}` : "")

  return (
    <Dialog open title={d ? d.title : "作業の詳細"} onClose={onClose} actions={<Button kind="secondary" onClick={onClose}>閉じる</Button>}>
      {state.status === "loading" && <p className={styles.state} aria-busy="true">読み込み中…</p>}
      {state.status === "notfound" && <p className={styles.state}>見つかりませんでした</p>}
      {state.status === "failed" && (
        <div role="alert">
          <p>{state.error.message}</p>
          {state.error.retryable && <Button onClick={() => void load()}>再試行</Button>}
        </div>
      )}
      {d && (
        <>
          <dl className={styles.list}>
            <dt>ユーザー名</dt>
            <dd>
              <a className={styles.link} href={d.profileUrl} target="_blank" rel="noopener noreferrer">
                {d.handle}
              </a>
            </dd>
            <dt>ゴール</dt>
            <dd className={styles.text}>{d.goal}</dd>
            <dt>指標</dt>
            <dd>
              {d.metric.name}（{value(d.metric.startValue)} → {value(d.metric.goalValue)}）
            </dd>
            <dt>最終進捗度</dt>
            <dd>{formatRate(d.finalRatePermille)}</dd>
            <dt>評価点</dt>
            <dd>{formatScore(d.scoreHundredths)}</dd>
            <dt>欠測件数</dt>
            <dd>{d.missingCount}件</dd>
            <dt>期間</dt>
            <dd>
              {formatPeriod(d.durationDays)}（{formatDateTime(d.startedAt)} 〜 {formatDateTime(d.endsAt)}）
            </dd>
            <dt>概要</dt>
            <dd className={styles.text}>{d.summary}</dd>
            {d.resultDescription && (
              <>
                <dt>結果の説明</dt>
                <dd className={styles.text}>{d.resultDescription}</dd>
              </>
            )}
          </dl>
          <div className={styles.images}>
            <Picture src={d.startImageUrl} alt="開始前の画像" label="開始前" />
            <Picture src={d.evidenceUrl} alt="結果の画像" label="結果" />
          </div>
        </>
      )}
    </Dialog>
  )
}
