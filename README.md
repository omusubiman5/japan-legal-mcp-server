# Japan Legal MCP Server

日本の法律・判例・労災認定基準データベースへのアクセスを提供するMCPサーバーです。

## 提供ツール

| ツール名 | 説明 |
|----------|------|
| `search_harassment_cases` | 厚労省「あかるい職場応援団」パワハラ裁判例検索 |
| `search_labor_insurance_decisions` | 労働保険審査会 裁決事案検索 |
| `search_court_cases` | 裁判所公式 判例検索 |
| `get_psychological_load_criteria` | 心理的負荷評価表・精神障害労災認定基準 |
| `search_law` | e-Gov 法令検索 |
| `search_labor_standard_cases` | 全労連 労働基準判例検索 |
| `generate_rousai_statement` | 労災申請書 業務上の出来事記述支援 |

## デプロイ

```bash
npm install
npm run build
vercel --prod
```

## Claude Desktop設定

```json
{
  "mcpServers": {
    "japan-legal": {
      "url": "https://your-vercel-url.vercel.app/mcp"
    }
  }
}
```
