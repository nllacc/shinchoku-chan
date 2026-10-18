import type { ReactNode } from "react"
import styles from "./Badge.module.css"
import { useSlot } from "./UiProvider"

export type BadgeProps = { tone?: "default" | "danger"; children: ReactNode }

// 色だけに頼らず、必ず文言を持つ
export function BaseBadge({ tone = "default", children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`} data-tone={tone}>
      {children}
    </span>
  )
}

export function Badge(props: BadgeProps) {
  const Impl = useSlot("Badge", BaseBadge)
  return <Impl {...props} />
}
