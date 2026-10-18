import type { KeyboardEvent, ReactNode } from "react"
import styles from "./DataTable.module.css"

export type Column<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  sortable?: boolean
}

export type SortState = { key: string; direction: "asc" | "desc" }

export type DataTableProps<T> = {
  caption: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  sort?: SortState
  // 並べ替えの指示だけを返す。並べ替えの実行は呼び出し側が行う
  onSortChange?: (next: SortState) => void
  // 行を選んだとき(クリックまたは Enter・Space)
  onRowActivate?: (row: T) => void
  empty?: ReactNode
}

export function DataTable<T>({ caption, columns, rows, rowKey, sort, onSortChange, onRowActivate, empty }: DataTableProps<T>) {
  const ariaSort = (c: Column<T>) => (sort?.key === c.key ? (sort.direction === "asc" ? "ascending" : "descending") : c.sortable ? "none" : undefined)
  const keyActivate = (row: T) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onRowActivate?.(row)
    }
  }
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className={styles.caption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" aria-sort={ariaSort(c)} className={styles.cell}>
                {c.sortable && onSortChange ? (
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => onSortChange({ key: c.key, direction: sort?.key === c.key && sort.direction === "desc" ? "asc" : "desc" })}
                  >
                    {c.header}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {empty ?? "データがありません"}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowActivate ? styles.activatable : undefined}
              tabIndex={onRowActivate ? 0 : undefined}
              onClick={onRowActivate ? () => onRowActivate(row) : undefined}
              onKeyDown={onRowActivate ? keyActivate(row) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={styles.cell}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
