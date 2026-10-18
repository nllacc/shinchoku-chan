import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError } from "../lib/apiError"
import { formatPeriod, formatRate, formatScore } from "../lib/format"
import { navigate, useLocation } from "../lib/nav"
import {
  fetchRanking,
  parseSort,
  type RankingRow,
  type SortKey,
  type SortState,
} from "../lib/rankingApi"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { DataTable, type Column } from "../ui/DataTable"
import { Link } from "../ui/Link"
import { Notice } from "../ui/Notice"
import { Select } from "../ui/Select"
import { Skeleton } from "../ui/Skeleton"
import styles from "./Ranking.module.css"
import { RankingDetailDialog } from "./RankingDetailDialog"

type View =
  | { status: "loading" }
  | { status: "ready"; rows: RankingRow[]; next?: string }
  | { status: "more"; rows: RankingRow[]; next?: string }
  | { status: "empty" }
  | { status: "failed"; error: ApiError; rows: RankingRow[]; next?: string }

const SORT_OPTIONS: { value: string; label: string; state: SortState }[] = [
  {
    value: "score-desc",
    label: "評価点が高い順",
    state: { sort: "score", order: "desc" },
  },
  {
    value: "score-asc",
    label: "評価点が低い順",
    state: { sort: "score", order: "asc" },
  },
  {
    value: "rate-desc",
    label: "最終進捗度が高い順",
    state: { sort: "rate", order: "desc" },
  },
  {
    value: "rate-asc",
    label: "最終進捗度が低い順",
    state: { sort: "rate", order: "asc" },
  },
]

// 画面幅が 480 ピクセル以下かどうか
function useNarrow(): boolean {
  const query = "(max-width: 480px)"
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setNarrow(m.matches)
    m.addEventListener("change", on)
    return () => m.removeEventListener("change", on)
  }, [])
  return narrow
}

const mergeRows = (a: RankingRow[], b: RankingRow[]) => {
  const seen = new Set(a.map((r) => r.taskId))
  return [...a, ...b.filter((r) => !seen.has(r.taskId))]
}

function UserLink({ row }: { row: RankingRow }) {
  // ユーザー名のリンクは行の選択(詳細の表示)とは独立に動く
  return (
    <Link href={row.profileUrl} external>
      {row.handle}
    </Link>
  )
}

export function Ranking() {
  const { search } = useLocation()
  const sort = parseSort(search)
  const detailId = new URLSearchParams(search).get("detail")
  const narrow = useNarrow()
  const [view, setView] = useState<View>({ status: "loading" })
  const request = useRef(0)

  const setParams = useCallback((change: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(location.search)
    change(p)
    const qs = p.toString()
    navigate(`${location.pathname}${qs ? `?${qs}` : ""}`, { replace: true })
  }, [])

  const load = useCallback(async (s: SortState) => {
    const id = ++request.current
    setView({ status: "loading" })
    try {
      const r = await fetchRanking(s)
      if (id !== request.current) return
      setView(
        r.rows.length === 0
          ? { status: "empty" }
          : { status: "ready", rows: r.rows, next: r.next },
      )
    } catch (e) {
      if (id !== request.current) return
      setView({ status: "failed", error: toApiError(e), rows: [] })
    }
  }, [])

  // 並びが変わるたびに 1 ページ目から取り直す
  useEffect(() => {
    void load({ sort: sort.sort, order: sort.order })
  }, [sort.sort, sort.order, load])

  const loadMore = async () => {
    if (view.status !== "ready" && view.status !== "failed") return
    const current = view
    if (!current.next) return
    const id = ++request.current
    setView({ status: "more", rows: current.rows, next: current.next })
    try {
      const r = await fetchRanking({ ...sort, cursor: current.next })
      if (id !== request.current) return
      setView({
        status: "ready",
        rows: mergeRows(current.rows, r.rows),
        next: r.next,
      })
    } catch (e) {
      if (id !== request.current) return
      setView({
        status: "failed",
        error: toApiError(e),
        rows: current.rows,
        next: current.next,
      })
    }
  }

  const changeSort = (s: SortState) =>
    setParams((p) => {
      p.set("sort", s.sort)
      p.set("order", s.order)
    })

  const openDetail = (taskId: string) =>
    setParams((p) => p.set("detail", taskId))
  const closeDetail = () => setParams((p) => p.delete("detail"))

  const rows = "rows" in view ? view.rows : []
  const columns: Column<RankingRow>[] = [
    {
      key: "handle",
      header: "ユーザー名",
      render: (r) => <UserLink row={r} />,
    },
    { key: "summary", header: "概要", render: (r) => r.summary },
    {
      key: "period",
      header: "期間",
      render: (r) => (
        <span className={styles.score}>{formatPeriod(r.durationDays)}</span>
      ),
    },
    {
      key: "score",
      header: "評価点",
      sortable: true,
      render: (r) => (
        <span className={styles.score}>{formatScore(r.scoreHundredths)}</span>
      ),
    },
    {
      key: "rate",
      header: "最終進捗度",
      sortable: true,
      render: (r) => (
        <span className={styles.score}>{formatRate(r.finalRatePermille)}</span>
      ),
    },
  ]

  return (
    <main className="page">
      <h1>ランキング</h1>

      {narrow && (
        <div className={styles.toolbar}>
          <Select
            label="並べ替え"
            options={SORT_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            value={`${sort.sort}-${sort.order}`}
            onChange={(v) =>
              changeSort(SORT_OPTIONS.find((o) => o.value === v)!.state)
            }
          />
        </div>
      )}

      {view.status === "loading" && <Skeleton />}

      {view.status === "empty" && (
        <Notice>
          まだランキングに載った作業はありません。最初の作業を始めてみましょう。
        </Notice>
      )}

      {view.status === "failed" && view.rows.length === 0 && (
        <Notice
          tone="error"
          actions={
            view.error.retryable ? (
              <Button onClick={() => void load(sort)}>再試行</Button>
            ) : undefined
          }
        >
          {view.error.message}
        </Notice>
      )}

      {rows.length > 0 &&
        (narrow ? (
          <ul className={styles.cards}>
            {rows.map((r) => (
              <li key={r.taskId}>
                <Card
                  heading={<UserLink row={r} />}
                  level={2}
                  actions={
                    <Button
                      kind="secondary"
                      onClick={() => openDetail(r.taskId)}
                    >
                      詳細
                    </Button>
                  }
                >
                  <p>{r.summary}</p>
                  <p className={styles.meta}>
                    <span>{formatPeriod(r.durationDays)}</span>
                    <Badge>評価点 {formatScore(r.scoreHundredths)}</Badge>
                    <Badge>進捗 {formatRate(r.finalRatePermille)}</Badge>
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <DataTable
            caption="作業のランキング"
            columns={columns}
            rows={rows}
            rowKey={(r) => r.taskId}
            sort={{ key: sort.sort, direction: sort.order }}
            onSortChange={(next) =>
              changeSort({ sort: next.key as SortKey, order: next.direction })
            }
            onRowActivate={(r) => openDetail(r.taskId)}
          />
        ))}

      {view.status === "failed" && view.rows.length > 0 && (
        <Notice tone="error">
          続きを取得できませんでした。{view.error.message}
        </Notice>
      )}

      {(view.status === "ready" ||
        view.status === "more" ||
        view.status === "failed") &&
        view.next &&
        rows.length > 0 && (
          <div className={styles.more}>
            <Button
              kind="secondary"
              busy={view.status === "more"}
              onClick={() => void loadMore()}
            >
              {view.status === "failed" ? "再試行" : "さらに表示"}
            </Button>
          </div>
        )}

      {detailId && (
        <RankingDetailDialog taskId={detailId} onClose={closeDetail} />
      )}
    </main>
  )
}

function toApiError(e: unknown): ApiError {
  return e instanceof ApiError
    ? e
    : new ApiError(0, "unknown", "エラーが発生しました", true)
}
