import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import styles from "./Dialog.module.css"
import { useSlot } from "./UiProvider"

export type DialogProps = {
  open: boolean
  title: string
  onClose: () => void
  // 処理中は閉じる操作を受け付けない
  busy?: boolean
  children?: ReactNode
  actions?: ReactNode
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function BaseDialog({ open, title, onClose, busy = false, children, actions }: DialogProps) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const previous = useRef<HTMLElement | null>(null)

  // 開くときは開く前の要素を保持して内部の最初の操作部品へ、閉じるときは保持した要素へ戻す
  useEffect(() => {
    if (!open) return
    previous.current = document.activeElement as HTMLElement | null
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel.current)?.focus()
    return () => previous.current?.focus()
  }, [open])

  if (!open) return null

  const close = () => {
    if (!busy) onClose()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation()
      return close()
    }
    if (e.key !== "Tab") return
    const items = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
    if (items.length === 0) return e.preventDefault()
    const first = items[0]!
    const last = items[items.length - 1]!
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && close()} onKeyDown={onKeyDown}>
      <div ref={panel} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} aria-busy={busy || undefined}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div>{children}</div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Dialog(props: DialogProps) {
  const Impl = useSlot("Dialog", BaseDialog)
  return <Impl {...props} />
}
