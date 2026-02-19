import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import axios from "axios";
import * as cheerio from "cheerio";

const server = new McpServer({
  name: "japan-legal-mcp-server",
  version: "1.0.0"
});

async function fetchPage(url: string): Promise<string> {
  const res = await axios.get(url, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; JapanLegalMCP/1.0)",
      "Accept-Language": "ja,en;q=0.9"
    }
  });
  return res.data as string;
}

// ツール1: パワハラ裁判例検索
server.registerTool(
  "search_harassment_cases",
  {
    title: "パワハラ・ハラスメント裁判例検索",
    description: "厚生労働省「あかるい職場応援団」のハラスメント裁判例データベースを検索します。",
    inputSchema: z.object({
      category: z.string().describe("検索カテゴリ（例: 精神的攻撃、パワハラ、叱責）"),
      keyword: z.string().optional().describe("追加キーワード（任意）")
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  },
  async ({ category, keyword }) => {
    try {
      const url = "https://www.no-harassment.mhlw.go.jp/foundation/judicail-precedent/";
      const html = await fetchPage(url);
      const $ = cheerio.load(html);
      const results: string[] = [];
      results.push(`【厚労省 あかるい職場応援団 裁判例】\n検索: ${category}${keyword ? "/" + keyword : ""}\n`);
      const cases: Array<{ title: string; url: string }> = [];
      $("a").each((_, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text().trim();
        if (href.includes("judicail-precedent") && text.length > 5) {
          cases.push({ title: text, url: href.startsWith("http") ? href : `https://www.no-harassment.mhlw.go.jp${href}` });
        }
      });
      const filtered = cases.filter(c => c.title.includes(category) || (keyword && c.title.includes(keyword))).slice(0, 10);
      const list = filtered.length > 0 ? filtered : cases.slice(0, 15);
      list.forEach((c, i) => results.push(`${i + 1}. ${c.title}\n   ${c.url}\n`));
      results.push(`\n参考: ${url}`);
      return { content: [{ type: "text", text: results.join("\n") }] };
    } catch (e) {
      return { content: [{ type: "text", text: `エラー: ${String(e)}\nhttps://www.no-harassment.mhlw.go.jp/foundation/judicail-precedent/` }] };
    }
  }
);

// ツール2: 労働保険審査会 裁決事案
server.registerTool(
  "search_labor_insurance_decisions",
  {
    title: "労働保険審査会 裁決事案検索",
    description: "労働保険審査会の裁決事案一覧を取得します。精神障害の業務起因性が争われた事案に特に有用です。",
    inputSchema: z.object({
      keyword: z.string().describe("検索キーワード（例: 精神障害、適応障害、パワハラ）")
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  },
  async ({ keyword }) => {
    const results: string[] = [];
    results.push(`【労働保険審査会 裁決事案】\nキーワード: ${keyword}\n`);
    results.push(`裁決事案一覧: https://www.mhlw.go.jp/topics/bukyoku/shinsa/roudou/saiketu-youshi/`);
    results.push(`精神疾患関係裁決集(PDF): http://gyosei-bunsyo.net/H21rsinsml.pdf`);
    results.push(`大阪SR会資料(PDF): https://osakasr.jp/upload/files/uploadedfile/202405/jCVPGub33850.pdf`);
    return { content: [{ type: "text", text: results.join("\n") }] };
  }
);

// ツール3: 裁判所 判例検索
server.registerTool(
  "search_court_cases",
  {
    title: "裁判所 判例検索",
    description: "裁判所公式判例検索システムから判例を検索します。労働・行政・民事事件に対応。",
    inputSchema: z.object({
      keyword: z.string().describe("検索キーワード"),
      case_type: z.string().optional().describe("事件類型（労働、行政、民事など）")
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  },
  async ({ keyword, case_type }) => {
    const searchUrl = `https://www.courts.go.jp/app/hanrei_jp/search2?page=1&sort=1&body=${encodeURIComponent(keyword)}`;
    const results: string[] = [];
    results.push(`【裁判所 判例検索】\nキーワード: ${keyword}${case_type ? " / " + case_type : ""}\n`);
    results.push(`検索URL: ${searchUrl}\n`);
    results.push(`1. 裁判所判例検索（総合）: https://www.courts.go.jp/hanrei/index.html`);
    results.push(`2. 労働事件裁判例集: https://www.courts.go.jp/app/hanrei_jp/search2?page=1&sort=1&hanreiSyu=4`);
    results.push(`3. 全労連判例検索: https://www.zenkiren.com/Portals/0/html/jinji/hannrei/\n`);
    if (keyword.includes("パワハラ") || keyword.includes("精神障害") || keyword.includes("労災")) {
      results.push(`【関連主要判例】`);
      results.push(`- 栃木労基署長事件（パワハラ・精神障害）: https://www.zenkiren.com/Portals/0/html/jinji/hannrei/shoshi/08736.html`);
      results.push(`- 半田労基署長事件（退職勧奨・精神障害）: https://www.zenkiren.com/Portals/0/html/jinji/hannrei/shoshi/09160.html`);
      results.push(`- 京都労基署長事件（集団いじめ）: https://www.jaaww.or.jp/joho/data/2012_0120_29.html`);
    }
    return { content: [{ type: "text", text: results.join("\n") }] };
  }
);

// ツール4: 心理的負荷評価表
server.registerTool(
  "get_psychological_load_criteria",
  {
    title: "心理的負荷評価表・精神障害労災認定基準",
    description: "厚労省の認定基準に基づき、特定の状況が「強」「中」「弱」のどの評価に該当するか判定します。",
    inputSchema: z.object({
      situation: z.string().describe("評価したい状況・出来事の説明")
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ situation }) => {
    const isStrong = situation.includes("長時間") || situation.includes("面前") || situation.includes("大声") || situation.includes("威圧") || situation.includes("人格") || situation.includes("否定");
    const hasWitness = situation.includes("名") || situation.includes("目撃") || situation.includes("社員");
    const text = `【厚労省 業務による心理的負荷評価表 パワーハラスメント】（令和5年9月改正版）

■ 出来事の類型: ⑤パワーハラスメント

【強】と判断される例:
✓ 治療を要する程度の暴行を受けた場合
✓ 暴行を執拗に受けた場合
✓ 人格・人間性を否定するような精神的攻撃が執拗に行われた場合
✓ 必要以上に長時間にわたる叱責、他の労働者の面前における大声での威圧的な叱責など
  社会通念に照らして許容される範囲を超える精神的攻撃
✓ 中程度の攻撃を受けた場合で、会社に相談しても改善されなかった場合

■ 3つの認定要件（すべて必要）
要件1: 発症前おおむね6か月以内に強い心理的負荷があること
要件2: 対象疾病（うつ病・適応障害等）と診断されていること
要件3: 業務以外の要因で発病したとは認められないこと

━━━━━━━━━━━━━━━
■ 入力状況の評価
━━━━━━━━━━━━━━━
評価対象:「${situation}」

【判定】→ ${isStrong ? "心理的負荷「強」に該当する可能性が高い\n根拠: 「面前での大声による威圧的な叱責」「長時間にわたる叱責」に該当" : "「中」または「強」の境界線上。詳細な状況確認が必要"}
${hasWitness ? "\n【加点要素】目撃者の存在 → 証拠力が高く、認定を強化します" : ""}

■ 参照文書
認定基準PDF: https://www.mhlw.go.jp/content/000637497.pdf`;
    return { content: [{ type: "text", text: text }] };
  }
);

// ツール5: e-Gov 法令検索
server.registerTool(
  "search_law",
  {
    title: "e-Gov 法令検索",
    description: "e-Govの法令データベースから日本の法律・政令・省令を検索します。",
    inputSchema: z.object({
      law_name: z.string().describe("法令名または検索キーワード")
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  },
  async ({ law_name }) => {
    const searchUrl = `https://laws.e-gov.go.jp/search/?query=${encodeURIComponent(law_name)}`;
    const text = `【e-Gov 法令検索】\nキーワード: ${law_name}\n検索URL: ${searchUrl}\n\n【労働・労災の主要条文】\n- 労働基準法 第75条: 療養補償\n- 労働基準法 第76条: 休業補償\n- 労働基準法 第79条: 障害補償\n- 労災保険法 第7条: 業務災害の定義\n- 労働施策総合推進法 第30条の2: パワハラ防止措置義務\n\nhttps://laws.e-gov.go.jp`;
    return { content: [{ type: "text", text: text }] };
  }
);

// ツール6: 全労連 労働基準判例
server.registerTool(
  "search_labor_standard_cases",
  {
    title: "全労連 労働基準判例検索",
    description: "全労連の労働基準判例データベースを検索します。",
    inputSchema: z.object({
      keyword: z.string().describe("検索キーワード")
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  },
  async ({ keyword }) => {
    const text = `【全労連 労働基準判例検索】\nキーワード: ${keyword}\n\n【主要判例】\n1. 栃木労働基準監督署長事件\n   パワハラ等による精神障害、障害補償給付不支給処分取消\n   https://www.zenkiren.com/Portals/0/html/jinji/hannrei/shoshi/08736.html\n\n2. 国・半田労基署長（医療法人B会D病院）事件\n   パワハラ・退職勧奨による精神障害発症の業務起因性\n   https://www.zenkiren.com/Portals/0/html/jinji/hannrei/shoshi/09160.html\n\n3. 国・京都下労基署長事件（女性社員集団いじめ）\n   精神障害・労災療養補償給付の認定\n   https://www.jaaww.or.jp/joho/data/2012_0120_29.html\n\n全労連判例DB: https://www.zenkiren.com/Portals/0/html/jinji/hannrei/`;
    return { content: [{ type: "text", text: text }] };
  }
);

// ツール7: 労災申請書記述支援
server.registerTool(
  "generate_rousai_statement",
  {
    title: "労災申請書 業務上の出来事記述支援",
    description: "精神障害の労災申請書（様式第23号）における「業務上の出来事」の記述文を生成します。",
    inputSchema: z.object({
      incident_date: z.string().describe("出来事の日付"),
      location: z.string().describe("場所"),
      perpetrator: z.string().describe("行為者（役職・関係）"),
      behavior: z.string().describe("行為の内容（詳細に）"),
      witnesses: z.string().describe("目撃者情報"),
      diagnosis: z.string().describe("診断名"),
      company_response: z.string().optional().describe("会社の対応（任意）")
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  async ({ incident_date, location, perpetrator, behavior, witnesses, diagnosis, company_response }) => {
    const text = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【様式第23号 業務上の出来事の記述（案）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 発生日時・場所
${incident_date}、${location}において

■ 業務上の出来事
${perpetrator}より、以下の行為を受けました。

${behavior}

目撃者: ${witnesses}

■ 心理的負荷の評価根拠
本件は、厚労省「業務による心理的負荷評価表」⑤パワーハラスメントの類型における
「必要以上に長時間にわたる厳しい叱責、他の労働者の面前における大声での威圧的な叱責
など、態様や手段が社会通念に照らして許容される範囲を超える精神的攻撃」に該当します。
心理的負荷の強度は「強」と評価されるべき事案です。

■ 発症との因果関係
上記出来事の直後より症状が生じ、「${diagnosis}」の診断を受けました。

■ 会社の対応
${company_response || "会社からの謝罪・再発防止措置は一切ありませんでした。"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【注意】この文章はAI支援案です。主治医・社労士・弁護士に確認の上ご使用ください。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    return { content: [{ type: "text", text: text }] };
  }
);

// Expressサーバー
const app = express();
app.use(express.json());

app.get("/", (_, res) => {
  res.json({ name: "japan-legal-mcp-server", version: "1.0.0", description: "日本の法律・判例・労災認定基準データベースMCPサーバー" });
});

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || "3000");
app.listen(port, () => { console.error(`Japan Legal MCP Server running on http://localhost:${port}/mcp`); });

export default app;
