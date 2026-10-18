import type { MouseEvent, ReactNode } from "react"
import styles from "./Button.module.css"
import { useSlot } from "./UiProvider"

export type ButtonKind = "primary" | "secondary" | "danger"

export type ButtonProps = {
  kind?: ButtonKind
  busy?: boolean
  disabled?: boolean
  type?: "button" | "submit"
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  children: ReactNode
  "aria-label"?: string
}

export function BaseButton({
  kind = "primary",
  busy = false,
  disabled = false,
  type = "button",
  onClick,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${styles.button} ${styles[kind]}`}
      data-ui="button"
      data-kind={kind}
      disabled={disabled}
      aria-busy={busy || undefined}
      // 処理中はフォーカスを保ったまま、操作だけを受け付けない
      aria-disabled={busy || undefined}
      onClick={(e) => {
        if (busy || disabled) return e.preventDefault()
        onClick?.(e)
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Button(props: ButtonProps) {
  const Impl = useSlot("Button", BaseButton)
  return <Impl {...props} />
}
