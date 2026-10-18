import type { ReactNode } from "react"
import styles from "./DescriptionList.module.css"
import { useSlot } from "./UiProvider"

export type DescriptionItem = {
  term: string
  description: ReactNode
  // 長文の改行をそのまま表示する
  preserveBreaks?: boolean
}

export type DescriptionListProps = { items: DescriptionItem[] }

// 項目名と内容の組を並べる
export function BaseDescriptionList({ items }: DescriptionListProps) {
  return (
    <dl className={styles.list} data-ui="description-list">
      {items.map((it) => (
        <div key={it.term} className={styles.row}>
          <dt className={styles.term}>{it.term}</dt>
          <dd
            className={
              it.preserveBreaks
                ? `${styles.description} ${styles.breaks}`
                : styles.description
            }
          >
            {it.description}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function DescriptionList(props: DescriptionListProps) {
  const Impl = useSlot("DescriptionList", BaseDescriptionList)
  return <Impl {...props} />
}
