# 評価点の算出 タスク一覧

## Phase 1: 曲線と面積

- 対応: D-1, D-2, D-3
- [ ] T-1.1: `src/scoring/score.ts` に型と入力検査を定義する。
- [ ] T-1.2: `src/scoring/curve.ts` に曲線の構築と丸めを実装する。
- [ ] T-1.3: `src/scoring/area.ts` に面積の計算を実装し、設計の例の表を単体テストにする。
- 検証: `npx vitest run tests/scoring/curve.test.ts tests/scoring/area.test.ts`

## Phase 2: 欠測と補完

- 対応: D-4, D-5
- [ ] T-2.1: `src/scoring/missing.ts` に補完点と欠測件数の算出を実装する。
- [ ] T-2.2: 補完の平均・端の処理・減点の上限を、受け入れ条件のタグ付きで単体テストにする。
- [ ] T-2.3: `computeScore` で全体を組み立て、冪等性と性能のテストを追加する。
- 検証: `npx vitest run tests/scoring/missing.test.ts tests/scoring/score.test.ts tests/scoring/perf.test.ts`
