import { lazy, Suspense, useState } from "react"
import { useAuth } from "./auth/AuthProvider"
import { linkClick, useLocation } from "./lib/nav"
import { Ranking } from "./pages/Ranking"
import { Button } from "./ui/Button"
import { Header } from "./ui/Header"
import { Link } from "./ui/Link"
import { Select } from "./ui/Select"
import { getTheme, setTheme, type Theme } from "./ui/theme"

// ランキング以外の画面は、開かれたときに読み込む
const NewTask = lazy(() => import("./pages/NewTask"))
const Checkin = lazy(() => import("./pages/Checkin"))
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"))

const THEME_OPTIONS = [
  { value: "system", label: "環境設定" },
  { value: "light", label: "明" },
  { value: "dark", label: "暗" },
]

function AppHeader() {
  const auth = useAuth()
  const [theme, setThemeState] = useState<Theme>(getTheme())
  return (
    <Header
      brand={
        <Link href="/" tone="plain" onClick={linkClick("/")}>
          進捗ちゃん
        </Link>
      }
    >
      <Link href="/" onClick={linkClick("/")}>
        ランキング
      </Link>
      <Link href="/new" onClick={linkClick("/new")}>
        作業を始める
      </Link>
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
      <Select
        label="テーマ"
        hideLabel
        options={THEME_OPTIONS}
        value={theme}
        onChange={(v) => {
          setThemeState(v as Theme)
          setTheme(v as Theme)
        }}
      />
    </Header>
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
      <AppHeader />
      <Suspense fallback={<main className="page" aria-busy="true" />}>
        <Routes />
      </Suspense>
    </>
  )
}
