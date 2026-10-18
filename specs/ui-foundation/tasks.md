# UI基盤 タスク一覧

## Phase 1: 設計値と検査

- 対応: D-1, D-2, D-3
- [x] T-1.1: Vite と React を導入し、`src/web/tokens/` の3つの CSS を作成する。
- [x] T-1.2: `scripts/check-css-tokens.mjs` を実装し、違反例の単体テストを追加する。
- [x] T-1.3: `scripts/check-contrast.mjs` を実装し、明暗の組み合わせを検査する。
- [x] T-1.4: `src/web/ui/theme.ts` にテーマの切り替えを実装する。
- 検証: `npx vitest run tests/ui/tokens.test.ts tests/ui/contrast.test.ts`
- E2E: `tests/e2e/theme.spec.ts` 暗の環境設定で確認用の画面を開き、手動で明へ切り替える → 背景色が暗から明へ変わる

## Phase 2: 差し替えの仕組みと基底部品

- 対応: D-4, D-5
- [x] T-2.1: `src/web/ui/UiProvider.tsx` に差し替えの文脈と取得の処理を実装する。
- [x] T-2.2: Button と Badge の基底部品を、スタイルとあわせて実装する。
- [x] T-2.3: Field と Card の基底部品を実装する。
- [x] T-2.4: DataTable の基底部品を実装する。
- 検証: `npx vitest run tests/ui/slots.test.tsx tests/ui/components.test.tsx`
- E2E: `tests/e2e/components.spec.ts` 確認用の画面で全体の差し替えを指定する → すべてのボタンが差し替えた実装で表示される

## Phase 3: ダイアログと確認用の画面

- 対応: D-6, D-7, D-8, D-9
- [x] T-3.1: `src/web/ui/Dialog.tsx` にフォーカスの閉じ込めと閉じ方を実装する。
- [x] T-3.2: `src/web/ui/Styleguide.tsx` に全部品の一覧を作成する。
- [x] T-3.3: gzip 後の容量を検査するスクリプトをビルドに追加する。
- [x] T-3.4: Select・Link・Notice・Skeleton・DescriptionList・Header・Figure の基底部品を追加し、Field と DataTable を含む全部品を差し替えの対象にする。
- [x] T-3.5: `scripts/check-ui-usage.mjs` を実装し、画面の素の要素の使用を検査する。
- 検証: `npm run build && npx vitest run tests/ui/size.test.ts tests/ui/usage.test.ts`
- E2E: `tests/e2e/dialog.spec.ts` ダイアログを開き Tab を繰り返し Esc を押す → フォーカスが外へ出ず、Esc で閉じて元の要素へ戻る
