import { useState } from "react"
import styles from "./Figure.module.css"
import { useSlot } from "./UiProvider"

export type FigureProps = { src?: string; alt: string; caption: string }

// 読み込めない画像は、要素ごと取り除く
export function BaseFigure({ src, alt, caption }: FigureProps) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return null
  return (
    <figure className={styles.figure} data-ui="figure">
      <img
        className={styles.image}
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setBroken(true)}
      />
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

export function Figure(props: FigureProps) {
  const Impl = useSlot("Figure", BaseFigure)
  return <Impl {...props} />
}
