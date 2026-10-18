import { useState, type ReactNode } from "react"
import { Badge } from "./Badge"
import { Button, type ButtonProps } from "./Button"
import { Card } from "./Card"
import { DataTable, type SortState } from "./DataTable"
import { DescriptionList } from "./DescriptionList"
import { Dialog } from "./Dialog"
import { Field } from "./Field"
import { Figure } from "./Figure"
import { Header } from "./Header"
import { Link } from "./Link"
import { Notice } from "./Notice"
import { Select } from "./Select"
import { Skeleton } from "./Skeleton"
import { setTheme, type Theme } from "./theme"
import { UiProvider } from "./UiProvider"

const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "明" },
  { value: "dark", label: "暗" },
  { value: "system", label: "環境設定" },
]

// 全体の差し替えの例: 基底のボタンの代わりに使う実装
function ReplacedButton({ children, onClick, disabled }: ButtonProps) {
  return (
    <button
      type="button"
      data-ui="button"
      data-impl="custom"
      disabled={disabled}
      onClick={onClick}
    >
      【差し替え】{children}
    </button>
  )
}

// 個別の部品による上書きの例: 基底のボタンの既定の種別を危険にして包む
function DeleteButton(props: Omit<ButtonProps, "kind">) {
  return <Button kind="danger" {...props} />
}

type Row = { rank: number; name: string; score: number }
const ROWS: Row[] = [
  { rank: 1, name: "作業A", score: 92 },
  { rank: 2, name: "作業B", score: 78 },
  { rank: 3, name: "作業C", score: 64 },
]

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  )
}

const SAMPLE_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="gray"/></svg>',
  )

const row = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--spacing-control)",
  alignItems: "center",
} as const

export function Styleguide() {
  const [replaced, setReplaced] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [busyDialog, setBusyDialog] = useState(false)
  const [choice, setChoice] = useState("a")
  const [sort, setSort] = useState<SortState>({ key: "rank", direction: "asc" })
  const rows = [...ROWS].sort((a, b) => {
    const k = sort.key as keyof Row
    return (a[k] < b[k] ? -1 : 1) * (sort.direction === "asc" ? 1 : -1)
  })

  return (
    <UiProvider overrides={replaced ? { Button: ReplacedButton } : {}}>
      <main className="page">
        <h1>部品一覧</h1>

        <Section id="theme" title="テーマ">
          <div style={row}>
            {THEMES.map((t) => (
              <Button
                key={t.value}
                kind="secondary"
                onClick={() => setTheme(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </Section>

        <Section id="parts" title="部品">
          <h3>ボタン</h3>
          <div style={row}>
            <Button>主</Button>
            <Button kind="secondary">副</Button>
            <Button kind="danger">危険</Button>
            <Button disabled>無効</Button>
            <Button busy>処理中</Button>
            <DeleteButton>個別の部品(既定の種別を上書き)</DeleteButton>
          </div>
          <h3>バッジ</h3>
          <div style={row}>
            <Badge>達成</Badge>
            <Badge tone="danger">未達</Badge>
          </div>
          <h3>入力欄</h3>
          <Field
            label="作業名"
            hint="12文字まで"
            placeholder="例: ランニング"
          />
          <Field
            label="作業名(エラー)"
            error="作業名を入力してください"
            defaultValue=""
          />
          <h3>カード</h3>
          <Card
            heading="カードの見出し"
            level={4}
            actions={<Button kind="secondary">操作</Button>}
          >
            カードの本文
          </Card>
          <h3>表</h3>
          <DataTable
            caption="ランキングの例"
            columns={[
              {
                key: "rank",
                header: "順位",
                sortable: true,
                render: (r: Row) => r.rank,
              },
              { key: "name", header: "作業", render: (r: Row) => r.name },
              {
                key: "score",
                header: "評価点",
                sortable: true,
                render: (r: Row) => r.score,
              },
            ]}
            rows={rows}
            rowKey={(r) => r.name}
            sort={sort}
            onSortChange={setSort}
          />
          <h3>選択欄</h3>
          <Select
            label="並び順"
            hint="表示の順序を選びます"
            options={[
              { value: "a", label: "評価点が高い順" },
              { value: "b", label: "評価点が低い順" },
            ]}
            value={choice}
            onChange={setChoice}
          />
          <h3>リンク</h3>
          <div style={row}>
            <Link href="https://bsky.app" external>
              外部のリンク
            </Link>
            <Link href="#parts">ページ内のリンク</Link>
          </div>
          <h3>通知</h3>
          <Notice>案内の例: まだ作業がありません</Notice>
          <Notice tone="error" actions={<Button>再試行</Button>}>
            エラーの例: 取得に失敗しました
          </Notice>
          <h3>骨組み</h3>
          <Skeleton lines={2} />
          <h3>定義リスト</h3>
          <DescriptionList
            items={[
              { term: "ゴール", description: "10km を走る" },
              {
                term: "概要",
                description: "1行目\n2行目",
                preserveBreaks: true,
              },
            ]}
          />
          <h3>画像</h3>
          <Figure src={SAMPLE_IMAGE} alt="見本の画像" caption="見本" />
          <h3>ヘッダー</h3>
          <Header brand="見本のヘッダー">
            <Link href="#parts">リンク</Link>
            <Button kind="secondary">操作</Button>
          </Header>
          <h3>ダイアログ</h3>
          <Button onClick={() => setDialog(true)}>ダイアログを開く</Button>
          <Dialog
            open={dialog}
            title="確認"
            onClose={() => setDialog(false)}
            busy={busyDialog}
            actions={
              <>
                <Button
                  kind="secondary"
                  onClick={() => setDialog(false)}
                  disabled={busyDialog}
                >
                  閉じる
                </Button>
                <Button
                  busy={busyDialog}
                  onClick={() => {
                    setBusyDialog(true)
                    setTimeout(() => {
                      setBusyDialog(false)
                      setDialog(false)
                    }, 600)
                  }}
                >
                  実行
                </Button>
              </>
            }
          >
            <Field label="メモ" />
          </Dialog>
        </Section>

        <Section id="override" title="差し替え">
          <label>
            <input
              type="checkbox"
              checked={replaced}
              onChange={(e) => setReplaced(e.target.checked)}
            />{" "}
            全体のボタンを差し替える
          </label>
        </Section>
      </main>
    </UiProvider>
  )
}
