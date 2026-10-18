import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, test, vi } from "vitest"
import { Badge } from "../../src/web/ui/Badge"
import { Button } from "../../src/web/ui/Button"
import { Card } from "../../src/web/ui/Card"
import { DataTable } from "../../src/web/ui/DataTable"
import { Dialog } from "../../src/web/ui/Dialog"
import { Field } from "../../src/web/ui/Field"
import { Styleguide } from "../../src/web/ui/Styleguide"

describe("基底部品", () => {
  test("ui-foundation/AC-5: 確認用の画面に13種の基底部品が表示される", async () => {
    render(<Styleguide />)
    expect(screen.getAllByRole("button").length).toBeGreaterThan(5)
    expect(screen.getAllByText(/達成|未達/).length).toBeGreaterThan(0) // Badge
    expect(screen.getAllByLabelText(/作業名/).length).toBeGreaterThan(0) // Field
    expect(screen.getByRole("heading", { name: "カードの見出し" })).toBeTruthy() // Card
    expect(screen.getByRole("table")).toBeTruthy() // DataTable
    expect(screen.getByRole("combobox", { name: "並び順" })).toBeTruthy() // Select
    expect(
      screen.getByRole("link", { name: "外部のリンク" }).getAttribute("rel"),
    ).toContain("noopener") // Link
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0) // Notice
    expect(screen.getAllByLabelText("読み込み中").length).toBeGreaterThan(0) // Skeleton
    expect(screen.getByText("ゴール").tagName).toBe("DT") // DescriptionList
    expect(screen.getByAltText("見本の画像")).toBeTruthy() // Figure
    expect(screen.getByRole("banner")).toBeTruthy() // Header
    await userEvent.click(
      screen.getByRole("button", { name: "ダイアログを開く" }),
    )
    expect(screen.getByRole("dialog")).toBeTruthy() // Dialog
  })

  test("ui-foundation/AC-6: 無効・処理中のボタンは操作を受け付けない", async () => {
    const onClick = vi.fn()
    render(
      <>
        <Button disabled onClick={onClick}>
          無効
        </Button>
        <Button busy onClick={onClick}>
          処理中
        </Button>
        <Button onClick={onClick}>通常</Button>
      </>,
    )
    await userEvent.click(screen.getByRole("button", { name: "無効" }))
    await userEvent.click(screen.getByRole("button", { name: "処理中" }))
    expect(onClick).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: "処理中" }).getAttribute("aria-busy"),
    ).toBe("true")
    await userEvent.click(screen.getByRole("button", { name: "通常" }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test("Field: ラベルと入力が関連付き、エラーは aria-describedby で結ばれる", () => {
    render(<Field label="作業名" hint="12文字まで" error="必須です" />)
    const input = screen.getByLabelText("作業名")
    const ids = input.getAttribute("aria-describedby")!.split(" ")
    expect(ids.map((i) => document.getElementById(i)?.textContent)).toEqual([
      "12文字まで",
      "必須です",
    ])
    expect(input.getAttribute("aria-invalid")).toBe("true")
  })

  test("Card: 見出しの階層を指定でき、差し込み口に要素を渡せる", () => {
    render(
      <Card heading="見出し" level={3} actions={<button>操作</button>}>
        本文
      </Card>,
    )
    expect(
      screen.getByRole("heading", { level: 3, name: "見出し" }),
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "操作" })).toBeTruthy()
  })

  test("Badge: 文言を持つ", () => {
    render(<Badge tone="danger">未達</Badge>)
    expect(screen.getByText("未達").dataset.tone).toBe("danger")
  })

  test("DataTable: 並べ替えの列に aria-sort、並べ替えの指示を返し、行の選択ができる", async () => {
    const onSort = vi.fn()
    const onRow = vi.fn()
    render(
      <DataTable
        caption="表"
        columns={[
          {
            key: "n",
            header: "数",
            sortable: true,
            render: (r: { n: number }) => r.n,
          },
        ]}
        rows={[{ n: 1 }, { n: 2 }]}
        rowKey={(r) => String(r.n)}
        sort={{ key: "n", direction: "asc" }}
        onSortChange={onSort}
        onRowActivate={onRow}
      />,
    )
    expect(
      screen
        .getByRole("columnheader", { name: "数" })
        .getAttribute("aria-sort"),
    ).toBe("ascending")
    await userEvent.click(screen.getByRole("button", { name: "数" }))
    expect(onSort).toHaveBeenCalledWith({ key: "n", direction: "desc" })
    const rows = screen.getAllByRole("row")
    rows[2]!.focus()
    await userEvent.keyboard("{Enter}")
    expect(onRow).toHaveBeenCalledWith({ n: 2 })
  })

  test("DataTable: 行がなければ空の表示", () => {
    render(
      <DataTable
        caption="表"
        columns={[{ key: "n", header: "数", render: () => null }]}
        rows={[]}
        rowKey={() => ""}
      />,
    )
    expect(screen.getByText("データがありません")).toBeTruthy()
  })
})

function Harness({ busy = false }: { busy?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>開く</button>
      <Dialog
        open={open}
        title="確認"
        onClose={() => setOpen(false)}
        busy={busy}
        actions={<button onClick={() => setOpen(false)}>閉じる</button>}
      >
        <input aria-label="内容" />
      </Dialog>
    </>
  )
}

describe("ダイアログ", () => {
  test("ui-foundation/AC-9: Tab を繰り返してもフォーカスが外へ出ず、Esc で閉じて元の要素へ戻る", async () => {
    render(<Harness />)
    const opener = screen.getByRole("button", { name: "開く" })
    await userEvent.click(opener)
    const dialog = screen.getByRole("dialog")
    expect(dialog.contains(document.activeElement)).toBe(true)
    for (let i = 0; i < 6; i++) {
      await userEvent.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
    await userEvent.tab({ shift: true })
    expect(dialog.contains(document.activeElement)).toBe(true)
    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  test("外側の操作で閉じる", async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole("button", { name: "開く" }))
    const overlay = screen.getByRole("dialog").parentElement!
    await userEvent.pointer({ keys: "[MouseLeft]", target: overlay })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  test("処理中は Esc でも閉じない。題と関連付く", async () => {
    render(<Harness busy />)
    await userEvent.click(screen.getByRole("button", { name: "開く" }))
    await userEvent.keyboard("{Escape}")
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByRole("heading", { name: "確認" })).toBeTruthy()
    expect(dialog.getAttribute("aria-modal")).toBe("true")
  })
})
