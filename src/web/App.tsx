import { lazy, Suspense, type ChangeEvent } from "react"
import { useAuth } from "./auth/AuthProvider"
import { linkClick, useLocation } from "./lib/nav"
import { Ranking } from "./pages/Ranking"
import { Button } from "./ui/Button"
import { getTheme, setTheme, type Theme } from "./ui/theme"
import styles from "./App.module.css"

// ランキング以外の画面は、開かれたときに読み込む
const NewTask = lazy(() => import("./pages/NewTask"))
const Checkin = lazy(() => import("./pages/Checkin"))
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"))

function Header() {
  const auth = useAuth()
  return (
    <header className={styles.header}>
      <a className={styles.brand} href="/" onClick={linkClick("/")}>
        進捗ちゃん
      </a>
      <nav className={styles.nav} aria-label="メイン">
        <a className={styles.link} href="/" onClick={linkClick("/")}>
          ランキング
        </a>
        <a className={styles.link} href="/new" onClick={linkClick("/new")}>
          作業を始める
        </a>
        {auth.handle ? (
          <>
            <span>{auth.handle}</span>
            <Button kind="secondary" onClick={auth.signOut}>
              サインアウト
            </Button>
          </>
        ) : (
          <Button kind="secondary" onClick={auth.signIn}>
            サインイン
          </Button>
        )}
        <label>
          <span className="visually-hidden">テーマ</span>
          <select
            className={styles.theme}
            defaultValue={getTheme()}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setTheme(e.target.value as Theme)}
          >
            <option value="system">環境設定</option>
            <option value="light">明</option>
            <option value="dark">暗</option>
          </select>
        </label>
      </nav>
    </header>
  )
}

function Routes() {
  const { pathname } = useLocation()
  if (pathname === "/") return <Ranking />
  if (pathname === "/new") return <NewTask />
  if (pathname.startsWith("/c/")) return <Checkin />
  if (pathname === "/oauth/callback") return <OAuthCallback />
  return (
    <main className="page">
      <h1>ページが見つかりません</h1>
    </main>
  )
}

export function App() {
  return (
    <>
      <Header />
      <Suspense fallback={<main className="page" aria-busy="true" />}>
        <Routes />
      </Suspense>
    </>
  )
}
