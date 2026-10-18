import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { Badge } from "../../src/web/ui/Badge"
import { Button, type ButtonProps } from "../../src/web/ui/Button"
import { Card } from "../../src/web/ui/Card"
import { DataTable } from "../../src/web/ui/DataTable"
import { DescriptionList } from "../../src/web/ui/DescriptionList"
import { Dialog } from "../../src/web/ui/Dialog"
import { Field } from "../../src/web/ui/Field"
import { Figure } from "../../src/web/ui/Figure"
import { Header } from "../../src/web/ui/Header"
import { Link } from "../../src/web/ui/Link"
import { Notice } from "../../src/web/ui/Notice"
import { Select } from "../../src/web/ui/Select"
import { Skeleton } from "../../src/web/ui/Skeleton"
import { UiProvider, type Slots } from "../../src/web/ui/UiProvider"

const Replaced = ({ children }: ButtonProps) => (
  <button data-impl="custom">{children}</button>
)
const DangerButton = (p: ButtonProps) => <Button kind="danger" {...p} />

describe("差し替えの仕組み", () => {
  test("ui-foundation/AC-7: 個別の部品が既定の種別を上書きしたボタンは、指定した種別で表示される", () => {
    render(<DangerButton>削除</DangerButton>)
    expect(screen.getByRole("button", { name: "削除" }).dataset.kind).toBe(
      "danger",
    )
  })

  test("ui-foundation/AC-7: 既定の種別は主、呼び出し側の指定が優先される", () => {
    render(
      <>
        <Button>a</Button>
        <DangerButton kind="secondary">b</DangerButton>
      </>,
    )
    expect(screen.getByText("a").dataset.kind).toBe("primary")
    expect(screen.getByText("b").dataset.kind).toBe("secondary")
  })

  test("ui-foundation/AC-8: 全体の差し替えを指定すると、すべてのボタンが差し替えた実装になる", () => {
    render(
      <UiProvider overrides={{ Button: Replaced }}>
        <Button>一</Button>
        <DangerButton>二</DangerButton>
      </UiProvider>,
    )
    const all = screen.getAllByRole("button")
    expect(all).toHaveLength(2)
    expect(all.every((b) => b.dataset.impl === "custom")).toBe(true)
  })

  test("ui-foundation/AC-8: すべての基底部品を差し替えられ、差し替えた実装で表示される", () => {
    const stub = (name: string) => () => (
      <div data-testid="replaced" data-impl={name} />
    )
    const names = [
      "Button",
      "Dialog",
      "Card",
      "Badge",
      "Field",
      "Select",
      "DataTable",
      "Link",
      "Notice",
      "Skeleton",
      "DescriptionList",
      "Header",
      "Figure",
    ] as const
    const overrides = Object.fromEntries(
      names.map((n) => [n, stub(n)]),
    ) as unknown as Partial<Slots>
    render(
      <UiProvider overrides={overrides}>
        <Button>a</Button>
        <Dialog open title="t" onClose={() => {}} />
        <Card heading="h" />
        <Badge>b</Badge>
        <Field label="f" />
        <Select label="s" options={[]} value="" onChange={() => {}} />
        <DataTable caption="c" columns={[]} rows={[]} rowKey={() => ""} />
        <Link href="/">l</Link>
        <Notice>n</Notice>
        <Skeleton />
        <DescriptionList items={[]} />
        <Header brand="b" />
        <Figure src="x" alt="a" caption="c" />
      </UiProvider>,
    )
    expect(
      screen.getAllByTestId("replaced").map((e) => e.dataset.impl),
    ).toEqual([...names])
  })

  test("差し替えが未指定なら基底の実装を使う", () => {
    render(
      <UiProvider overrides={{}}>
        <Button>基底</Button>
      </UiProvider>,
    )
    expect(screen.getByRole("button").dataset.ui).toBe("button")
  })
})
