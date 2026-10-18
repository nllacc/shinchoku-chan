# リマインド タスク一覧

## Phase 1: 文面と宛先

- 対応: D-3, D-5
- [ ] T-1.1: 起点の種類から投稿の宛先を求める関数を実装する。
- [ ] T-1.2: リマインドと評価依頼の文面を実装し、同じ計画で同じ文例になるテストを追加する。
- 検証: `npx vitest run tests/reminder/target.test.ts tests/reminder/messages.test.ts`

## Phase 2: 実行

- 対応: D-1, D-2, D-4
- [ ] T-2.1: 時刻が来た計画の取り出しと、状態の更新を実装する。
- [ ] T-2.2: 取りやめの規則を実装する。
- [ ] T-2.3: 評価依頼の投稿後に評価待ちを登録し、定期実行へ登録する。
- [ ] T-2.4: 受け入れ条件のタグ付きテストを、メモリの保存先と模擬の Bot で追加する。
- 検証: `npx vitest run tests/reminder/send.test.ts`
