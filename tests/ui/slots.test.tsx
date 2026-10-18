import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { Button, type ButtonProps } from "../../src/web/ui/Button"
import { UiProvider } from "../../src/web/ui/UiProvider"

const Replaced = ({ children }: ButtonProps) => <button data-impl="custom">{children}</button>
const DangerButton = (p: ButtonProps) => <Button kind="danger" {...p} />

describe("差し替えの仕組み", () => {
  test("ui-foundation/AC-7: 個別の部品が既定の種別を上書きしたボタンは、指定した種別で表示される", () => {
    render(<DangerButton>削除</DangerButton>)
    expect(screen.getByRole("button", { name: "削除" }).dataset.kind).toBe("danger")
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

  test("差し替えが未指定なら基底の実装を使う", () => {
    render(
      <UiProvider overrides={{}}>
        <Button>基底</Button>
      </UiProvider>,
    )
    expect(screen.getByRole("button").dataset.ui).toBe("button")
  })
})
