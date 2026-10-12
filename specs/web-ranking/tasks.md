# ランキング画面 タスク一覧

## Phase 1: 取得と表示形式

- 対応: D-1, D-4
- [ ] T-1.1: `src/web/lib/format.ts` に表示形式を実装し、設計の表を単体テストにする。
- [ ] T-1.2: `src/web/lib/rankingApi.ts` に一覧と詳細の取得を実装する。
- [ ] T-1.3: 状態の遷移と、アドレスと並びの同期をテストする。
- 検証: `npx vitest run tests/web/format.test.ts tests/web/rankingApi.test.ts`

## Phase 2: 一覧の画面

- 対応: D-2
- [ ] T-2.1: `src/web/pages/Ranking.tsx` に表の表示と並べ替えを実装する。
- [ ] T-2.2: 狭い画面でのカード表示と、続きの読み込みを実装する。
- [ ] T-2.3: 読み込み中・0件・失敗の各状態を実装する。
- 検証: `npx vitest run tests/web/ranking.test.tsx`
- E2E: `tests/e2e/ranking.spec.ts` 評価の確定した作業が複数ある状態で一覧を開き、評価点の列を選ぶ → 並びが降順から昇順へ変わる

## Phase 3: 詳細とアプリの枠組み

- 対応: D-3, D-5, D-6
- [ ] T-3.1: `src/web/pages/RankingDetailDialog.tsx` に詳細の表示を実装する。
- [ ] T-3.2: `src/web/App.tsx` と `src/web/main.tsx` にヘッダーと遷移を実装する。
- [ ] T-3.3: 初回表示の配信容量を検査するスクリプトをビルドに追加する。
- 検証: `npm run build && npx vitest run tests/web/detail.test.tsx tests/web/size.test.ts`
- E2E: `tests/e2e/detail.spec.ts` 一覧の行を選び、Esc で閉じる → 詳細が開き、閉じると同じ並びとスクロール位置に戻る
