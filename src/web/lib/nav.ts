// ブラウザ側の遷移。履歴 API を包み、アドレスの変化を購読できるようにする
import { useSyncExternalStore } from "react"

const listeners = new Set<() => void>()

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  window.addEventListener("popstate", cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener("popstate", cb)
  }
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  if (to !== location.pathname + location.search) history[opts.replace ? "replaceState" : "pushState"](null, "", to)
  listeners.forEach((l) => l())
}

/** 現在のアドレス(パスと検索部)。変化すると再描画される */
export function useLocation(): { pathname: string; search: string } {
  const href = useSyncExternalStore(subscribe, () => location.pathname + location.search, () => "/")
  const i = href.indexOf("?")
  return i < 0 ? { pathname: href, search: "" } : { pathname: href.slice(0, i), search: href.slice(i) }
}

/** クリックを遷移に置き換えるリンク用。修飾キーつきと別タブは通常どおり */
export function linkClick(to: string) {
  return (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(to)
  }
}
