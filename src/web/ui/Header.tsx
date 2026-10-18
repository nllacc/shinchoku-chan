import type { ReactNode } from "react"
import styles from "./Header.module.css"
import { useSlot } from "./UiProvider"

// brand は左端の題、children は右側の操作の並び
export type HeaderProps = {
  brand: ReactNode
  navLabel?: string
  children?: ReactNode
}

export function BaseHeader({
  brand,
  navLabel = "メイン",
  children,
}: HeaderProps) {
  return (
    <header className={styles.header} data-ui="header">
      <div className={styles.brand}>{brand}</div>
      <nav className={styles.nav} aria-label={navLabel}>
        {children}
      </nav>
    </header>
  )
}

export function Header(props: HeaderProps) {
  const Impl = useSlot("Header", BaseHeader)
  return <Impl {...props} />
}
