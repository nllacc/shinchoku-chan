import { useCallback, useEffect, useState } from "react"
import { ApiError } from "../lib/apiError"
import {
  formatDateTime,
  formatPeriod,
  formatRate,
  formatScore,
} from "../lib/format"
import { fetchDetail, type RankingDetail } from "../lib/rankingApi"
import { Button } from "../ui/Button"
import { DescriptionList } from "../ui/DescriptionList"
import { Dialog } from "../ui/Dialog"
import { Figure } from "../ui/Figure"
import { Link } from "../ui/Link"
import { Notice } from "../ui/Notice"
import { Skeleton } from "../ui/Skeleton"
import styles from "./RankingDetailDialog.module.css"

type State =
  | { status: "loading" }
  | { status: "ready"; detail: RankingDetail }
  | { status: "notfound" }
  | { status: "failed"; error: ApiError }

export function RankingDetailDialog({
  taskId,
  onClose,
}: {
  taskId: string
  onClose: () => void
}) {
  const [state, setState] = useState<State>({ status: "loading" })

  const load = useCallback(async () => {
    setState({ status: "loading" })
    try {
      const detail = await fetchDetail(taskId)
      setState(detail ? { status: "ready", detail } : { status: "notfound" })
    } catch (e) {
      setState({
        status: "failed",
        error:
          e instanceof ApiError
            ? e
            : new ApiError(0, "unknown", "エラーが発生しました", true),
      })
    }
  }, [taskId])

  useEffect(() => {
    void load()
  }, [load])

  const d = state.status === "ready" ? state.detail : null
  const metric = d?.metric
  const unit = metric ? ` ${metric.unit}` : ""
  const value = (scaled: number) =>
    metric ? `${scaled / 10 ** metric.scale}${unit}` : ""

  return (
    <Dialog
      open
      title={d ? d.title : "作業の詳細"}
      onClose={onClose}
      actions={
        <Button kind="secondary" onClick={onClose}>
          閉じる
        </Button>
      }
    >
      {state.status === "loading" && <Skeleton lines={3} />}
      {state.status === "notfound" && <Notice>見つかりませんでした</Notice>}
      {state.status === "failed" && (
        <Notice
          tone="error"
          actions={
            state.error.retryable ? (
              <Button onClick={() => void load()}>再試行</Button>
            ) : undefined
          }
        >
          {state.error.message}
        </Notice>
      )}
      {d && (
        <>
          <DescriptionList
            items={[
              {
                term: "ユーザー名",
                description: (
                  <Link href={d.profileUrl} external>
                    {d.handle}
                  </Link>
                ),
              },
              { term: "ゴール", description: d.goal, preserveBreaks: true },
              {
                term: "指標",
                description: `${d.metric.name}（${value(d.metric.startValue)} → ${value(d.metric.goalValue)}）`,
              },
              {
                term: "最終進捗度",
                description: formatRate(d.finalRatePermille),
              },
              { term: "評価点", description: formatScore(d.scoreHundredths) },
              { term: "欠測件数", description: `${d.missingCount}件` },
              {
                term: "期間",
                description: `${formatPeriod(d.durationDays)}（${formatDateTime(d.startedAt)} 〜 ${formatDateTime(d.endsAt)}）`,
              },
              { term: "概要", description: d.summary, preserveBreaks: true },
              ...(d.resultDescription
                ? [
                    {
                      term: "結果の説明",
                      description: d.resultDescription,
                      preserveBreaks: true,
                    },
                  ]
                : []),
            ]}
          />
          <div className={styles.images}>
            <Figure src={d.startImageUrl} alt="開始前の画像" caption="開始前" />
            <Figure src={d.evidenceUrl} alt="結果の画像" caption="結果" />
          </div>
        </>
      )}
    </Dialog>
  )
}
