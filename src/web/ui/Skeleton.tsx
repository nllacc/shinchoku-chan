import styles from "./Skeleton.module.css"
import { useSlot } from "./UiProvider"

export type SkeletonProps = { lines?: number; label?: string }

// 読み込み中の骨組み
export function BaseSkeleton({
  lines = 4,
  label = "読み込み中",
}: SkeletonProps) {
  return (
    <div aria-busy="true" aria-label={label} data-ui="skeleton">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={styles.line} />
      ))}
    </div>
  )
}

export function Skeleton(props: SkeletonProps) {
  const Impl = useSlot("Skeleton", BaseSkeleton)
  return <Impl {...props} />
}
