import type { ReactNode } from "react"
import styles from "./Card.module.css"
import { useSlot } from "./UiProvider"

// heading・actions は差し込み口。見出しの階層(level)は呼び出し側が文書の構造に合わせて指定する
export type CardProps = {
  heading: ReactNode
  level?: 2 | 3 | 4
  actions?: ReactNode
  children?: ReactNode
}

export function BaseCard({ heading, level = 2, actions, children }: CardProps) {
  const H = `h${level}` as "h2" | "h3" | "h4"
  return (
    <section className={styles.card}>
      <H className={styles.heading}>{heading}</H>
      <div>{children}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </section>
  )
}

export function Card(props: CardProps) {
  const Impl = useSlot("Card", BaseCard)
  return <Impl {...props} />
}
