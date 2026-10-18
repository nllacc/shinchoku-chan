# 受理と再確認 タスク一覧

## Phase 1: 作業の受理

- 対応: D-1, D-2, D-3, D-4, D-8
- [x] T-1.1: `src/receipt/botRepo.ts` に Bot のリポジトリへの書き込みを実装する。
- [x] T-1.2: `src/receipt/anchor.ts` に起点投稿の検証を実装する。
- [x] T-1.3: `src/receipt/windows.ts` に窓の算出を実装し、設計の例の表を単体テストにする。
- [x] T-1.4: `src/receipt/enroll.ts` に作業の受理を実装する。
- [x] T-1.5: `src/receipt/routes.ts` に API の経路を登録する。
- 検証: `npx vitest run tests/receipt/windows.test.ts tests/receipt/anchor.test.ts tests/receipt/enroll.test.ts`

## Phase 2: 報告の受理

- 対応: D-5
- [x] T-2.1: `src/receipt/submit.ts` に手順 1〜10 を実装する。
- [x] T-2.2: 期限・参照・証跡画像・二重受理の各拒否を、受け入れ条件のタグ付きで単体テストにする。
- [x] T-2.3: CPU 時間と外部通信の回数を測るテストと、模擬の PDS と API 経路での通しのテストを追加する。
- 検証: `npx vitest run tests/receipt/submit.test.ts tests/receipt/perf.test.ts tests/receipt/integration.test.ts`

## Phase 3: 期限切れと再確認

- 対応: D-6, D-7
- [x] T-3.1: `src/receipt/expire.ts` を実装し、定期実行へ登録する。
- [x] T-3.2: `src/receipt/recheck.ts` を実装し、改変・削除の検出と取消を単体テストにする。
- 検証: `npx vitest run tests/receipt/expire.test.ts tests/receipt/recheck.test.ts`
