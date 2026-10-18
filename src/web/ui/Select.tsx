import { useId } from "react"
import styles from "./Select.module.css"
import { useSlot } from "./UiProvider"

export type SelectOption = { value: string; label: string }

export type SelectProps = {
  label: string
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
  // ラベルを視覚的に隠す(読み上げには残す)
  hideLabel?: boolean
}

export function BaseSelect({
  label,
  options,
  value,
  onChange,
  hint,
  error,
  hideLabel = false,
}: SelectProps) {
  const id = useId()
  const describedBy =
    [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
      .filter(Boolean)
      .join(" ") || undefined
  return (
    <div className={styles.select}>
      <label
        htmlFor={id}
        className={hideLabel ? "visually-hidden" : styles.label}
      >
        {label}
      </label>
      <select
        id={id}
        className={styles.control}
        value={value}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        data-ui="select"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function Select(props: SelectProps) {
  const Impl = useSlot("Select", BaseSelect)
  return <Impl {...props} />
}
