import type { MouseEvent, ReactNode } from "react"
import styles from "./Link.module.css"
import { useSlot } from "./UiProvider"

export type LinkProps = {
  href: string
  // 別のサイトへのリンク。新しいタブで開き、参照元の情報を渡さない
  external?: boolean
  // plain は文字色を引き継ぎ、下線を付けない(ロゴなど)
  tone?: "default" | "plain"
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
  children: ReactNode
}

export function BaseLink({
  href,
  external = false,
  tone = "default",
  onClick,
  children,
}: LinkProps) {
  return (
    <a
      href={href}
      className={`${styles.link} ${styles[tone]}`}
      data-ui="link"
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      // 外部へのリンクは、囲んでいる要素(表の行など)の操作とは独立に動く
      onClick={(e) => {
        if (external) e.stopPropagation()
        onClick?.(e)
      }}
      onKeyDown={external ? (e) => e.stopPropagation() : undefined}
    >
      {children}
    </a>
  )
}

export function Link(props: LinkProps) {
  const Impl = useSlot("Link", BaseLink)
  return <Impl {...props} />
}
