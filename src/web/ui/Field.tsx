import { useId, type InputHTMLAttributes } from "react"
import styles from "./Field.module.css"
import { useSlot } from "./UiProvider"

export type FieldProps = {
  label: string
  hint?: string
  error?: string
  multiline?: boolean
} & Omit<InputHTMLAttributes<HTMLInputElement & HTMLTextAreaElement>, "id">

// ラベル・入力・説明・エラーを1組にする
export function BaseField({
  label,
  hint,
  error,
  multiline = false,
  ...input
}: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") ||
    undefined
  const common = {
    id,
    className: styles.input,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    ...input,
  }
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {multiline ? <textarea rows={4} {...common} /> : <input {...common} />}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function Field(props: FieldProps) {
  const Impl = useSlot("Field", BaseField)
  return <Impl {...props} />
}
