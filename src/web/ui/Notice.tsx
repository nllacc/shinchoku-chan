import type { ReactNode } from "react"
import styles from "./Notice.module.css"
import { useSlot } from "./UiProvider"

export type NoticeProps = {
  // info は空の状態などの案内、error は失敗(読み上げで即時に伝える)
  tone?: "info" | "error"
  actions?: ReactNode
  children: ReactNode
}

export function BaseNotice({ tone = "info", actions, children }: NoticeProps) {
  return (
    <div
      className={`${styles.notice} ${styles[tone]}`}
      data-ui="notice"
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
    >
      <p className={styles.text}>{children}</p>
      {actions}
    </div>
  )
}

export function Notice(props: NoticeProps) {
  const Impl = useSlot("Notice", BaseNotice)
  return <Impl {...props} />
}
