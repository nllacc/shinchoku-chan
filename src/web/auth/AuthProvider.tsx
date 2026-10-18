import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

export type AuthState = {
  /** サインイン中のハンドル。未サインインは null */
  handle: string | null
  signIn: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthState>({ handle: null, signIn: () => {}, signOut: () => {} })

// サインイン状態の保持。実際のサインイン手順は作業の登録の画面側で差し替える
export function AuthProvider({ children }: { children: ReactNode }) {
  const [handle, setHandle] = useState<string | null>(null)
  const value = useMemo<AuthState>(() => ({ handle, signIn: () => setHandle(null), signOut: () => setHandle(null) }), [handle])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthState => useContext(AuthContext)
