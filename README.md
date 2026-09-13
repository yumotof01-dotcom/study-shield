# StudyShield Rebuild

旧StudyShieldの配信済み `index-yVGniqCY.js` と `index-CdMi2KiE.css` を基準に、React + Viteで再構築したローカル実行版です。

- 旧CSSは `src/styles/original-studyshield.css` としてそのまま取り込み
- 画面構成、ナビ、右下「拠点」ボタン、チュートリアル、設定、ノート、出典、調査、検証、AI研究員、発表資料作成、発表前チェックを実装
- Base44固有APIは `src/adapters/base44Adapter.js` に分離
- ノートと出典、設定は `localStorage` に保存
- AI呼び出しは `/api/ai` のCloudflare Workerへ送信し、未設定時はローカルのモック応答へフォールバック

## Run

```bash
pnpm install
pnpm build
pnpm dev
```

## AI

AIはGroq優先、Cloudflare Workers AIフォールバックです。

```bash
cp .dev.vars.example .dev.vars
# .dev.vars に GROQ_API_KEY を入れる
pnpm build
pnpm dev:worker
```

フロントをViteで別起動する場合:

```bash
VITE_AI_ENDPOINT=http://127.0.0.1:8787/api/ai pnpm dev
```

デプロイ:

```bash
wrangler secret put GROQ_API_KEY
pnpm deploy
```

Groqを使わずWorkers AIだけで動かす場合は、`wrangler.jsonc` の `AI_PROVIDER` を `workers-ai` にしてください。
