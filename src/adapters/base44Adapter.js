const SETTINGS_KEY = "studyshield_settings";
const TUTORIAL_KEY = "studyshield_tutorial_done";

const defaultSettings = {
  gradeLevel: "中学",
  searchMode: "一般",
  summaryStyle: "3行"
};

export const SEARCH_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    sources: { type: "array", items: { type: "object", properties: { title: { type: "string" }, url: { type: "string" }, publisher: { type: "string" }, date: { type: "string" }, reliability: { type: "string" } } } },
    reliability_score: { type: "number" },
    consistency_rate: { type: "number" },
    cautions: { type: "array", items: { type: "string" } },
    related_keywords: { type: "array", items: { type: "string" } },
    perspectives: { type: "array", items: { type: "object", properties: { view: { type: "string" }, summary: { type: "string" } } } },
    key_points: { type: "array", items: { type: "string" } },
    updated_info: { type: "string" }
  }
};

export const ROUTE_SCHEMA = {
  type: "object",
  properties: {
    steps: { type: "array", items: { type: "object", properties: { step: { type: "number" }, title: { type: "string" }, description: { type: "string" }, keywords: { type: "array", items: { type: "string" } } } } }
  }
};

export const VERIFY_SCHEMA = {
  type: "object",
  properties: {
    reliability: { type: "string" },
    sources_present: { type: "boolean" },
    multi_source_consistency: { type: "boolean" },
    is_outdated: { type: "boolean" },
    evidence_sufficient: { type: "boolean" },
    has_bias: { type: "boolean" },
    has_contradictions: { type: "boolean" },
    confirmed_sources_count: { type: "number" },
    consistency_rate: { type: "number" },
    warnings: { type: "array", items: { type: "string" } },
    additional_check_recommended: { type: "boolean" },
    perspectives: { type: "array", items: { type: "object", properties: { view: { type: "string" }, summary: { type: "string" } } } },
    detail: { type: "string" }
  }
};

export const AI_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    method: { type: "string" },
    reasoning: { type: "string" },
    common_mistakes: { type: "string" },
    similar_problems: { type: "string" }
  }
};

export const SLIDE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    slides: { type: "array", items: { type: "object", properties: { slide_number: { type: "number" }, heading: { type: "string" }, content: { type: "string" }, speaker_notes: { type: "string" } } } },
    references: { type: "array", items: { type: "object", properties: { title: { type: "string" }, url: { type: "string" } } } },
    suggestions: { type: "object", properties: { too_much: { type: "string" }, too_little: { type: "string" } } }
  }
};

export const QUESTIONS_SCHEMA = {
  type: "object",
  properties: {
    questions: { type: "array", items: { type: "object", properties: { question: { type: "string" }, answer_point: { type: "string" } } } }
  }
};

export const AUDIT_SCHEMA = {
  type: "object",
  properties: {
    issues: { type: "array", items: { type: "object", properties: { type: { type: "string" }, severity: { type: "string" }, description: { type: "string" }, suggestion: { type: "string" } } } },
    overall_score: { type: "number" },
    summary: { type: "string" },
    presentation_ready: { type: "boolean" }
  }
};

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function makeEntity(name) {
  const key = `studyshield_${name}`;
  return {
    async list(order = "-updated_date", limit = 200) {
      const items = read(key, []);
      const sorted = [...items].sort((a, b) => (b.updated_date || "").localeCompare(a.updated_date || ""));
      return sorted.slice(0, limit);
    },
    async create(payload) {
      const now = new Date().toISOString();
      const item = { id: crypto.randomUUID(), created_date: now, updated_date: now, ...payload };
      write(key, [item, ...read(key, [])]);
      return item;
    },
    async bulkCreate(payloads) {
      const created = [];
      for (const payload of payloads) created.push(await this.create(payload));
      return created;
    },
    async update(id, payload) {
      const next = read(key, []).map((item) => item.id === id ? { ...item, ...payload, updated_date: new Date().toISOString() } : item);
      write(key, next);
      return next.find((item) => item.id === id);
    },
    async delete(id) {
      write(key, read(key, []).filter((item) => item.id !== id));
      return true;
    }
  };
}

export const base44 = {
  entities: {
    Note: makeEntity("notes"),
    Reference: makeEntity("references")
  },
  auth: {
    async me() {
      return { full_name: "ゲスト" };
    },
    isAuthenticated() {
      return true;
    }
  },
  integrations: {
    Core: {
      async InvokeLLM({ prompt, response_json_schema, add_context_from_internet }) {
        return mockLLM({ prompt, schema: response_json_schema, addContext: add_context_from_internet });
      }
    }
  }
};

export function getSettings() {
  return { ...defaultSettings, ...read(SETTINGS_KEY, {}) };
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

export function clearTutorial() {
  localStorage.removeItem(TUTORIAL_KEY);
}

export async function callAI(prompt, schema, addContextFromInternet = false, context = {}) {
  const endpoint = import.meta.env.VITE_AI_ENDPOINT || "/api/ai";
  const shouldUseRemote = import.meta.env.VITE_USE_MOCK_AI !== "true";

  if (shouldUseRemote) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          schema,
          addContextFromInternet,
          context
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `AI endpoint failed with ${response.status}`);
      }
      return payload.data;
    } catch (error) {
      console.warn("StudyShield AI endpoint unavailable; using local mock.", error);
    }
  }

  await delay(450);
  return mockLLM({ prompt, schema, addContext: addContextFromInternet, context });
}

function mockLLM({ context }) {
  const topic = cleanTopic(context?.input || "調べ学習");
  switch (context?.task) {
    case "search":
      return searchResult(topic, context.settings);
    case "route":
      return routeResult(topic);
    case "verify":
      return verifyResult(context.input || "");
    case "ai":
      return aiResult(topic);
    case "slides":
      return slidesResult(topic);
    case "questions":
      return questionsResult(topic);
    case "script":
      return scriptResult(topic, context.result);
    case "audit":
      return auditResult(context.input || "");
    case "summary":
      return summaryResult(context.input, context.result);
    default:
      return "ローカル復元版のAIアダプタが生成したサンプル応答です。Base44へ接続する場合は、このアダプタのInvokeLLM部分を差し替えてください。";
  }
}

function searchResult(topic, settings = defaultSettings) {
  return {
    summary: `${topic}について、複数の情報源を比較しながら調査した結果です。${settings.gradeLevel || "中学"}向けには、まず基本用語を押さえ、次に背景・現在の状況・影響を分けて確認すると理解しやすくなります。`,
    sources: [
      { title: `${topic}に関する公的資料`, url: "https://www.mext.go.jp/", publisher: "文部科学省", date: "2026", reliability: "高い" },
      { title: `${topic}の基礎解説`, url: "https://www.nhk.or.jp/kokokoza/", publisher: "NHK高校講座", date: "2026", reliability: "高い" },
      { title: `${topic}を考える参考記事`, url: "https://www.jst.go.jp/", publisher: "科学技術振興機構", date: "2026", reliability: "中程度" }
    ],
    reliability_score: 78,
    consistency_rate: 72,
    cautions: ["統計や制度は年度によって変わるため、最新年度を確認してください。", "解説記事だけでなく一次情報や公的資料も見ると安全です。"],
    related_keywords: [`${topic} 原因`, `${topic} 影響`, `${topic} 対策`, "一次情報", "統計"],
    perspectives: [
      { view: "制度・社会の視点", summary: "社会の仕組みや制度がどのように関係するかを確認します。" },
      { view: "個人・生活の視点", summary: "自分たちの生活や地域にどんな影響があるかを考えます。" }
    ],
    key_points: ["用語の意味を最初に定義する", "複数資料で共通している説明を中心にまとめる", "数字や日付は出典と一緒に記録する"],
    updated_info: "この復元版ではWeb検索の代わりにローカルAIアダプタがサンプル結果を生成しています。"
  };
}

function routeResult(topic) {
  return {
    steps: [
      { step: 1, title: "問いを決める", description: `${topic}について何を明らかにしたいかを1文で書く。`, keywords: ["問い", "目的"] },
      { step: 2, title: "基本用語を確認", description: "教科書や公的な解説で重要語を調べる。", keywords: ["用語", "基礎"] },
      { step: 3, title: "公的資料を見る", description: "政府・教育機関・研究機関の資料を探す。", keywords: ["一次情報", "公的資料"] },
      { step: 4, title: "複数資料を比較", description: "共通点と違いを表にして整理する。", keywords: ["比較", "一致率"] },
      { step: 5, title: "注意点を確認", description: "古い情報、偏り、根拠不足がないか見直す。", keywords: ["偏り", "根拠"] },
      { step: 6, title: "発表用にまとめる", description: "結論、根拠、出典をセットでスライドにする。", keywords: ["発表", "出典"] }
    ]
  };
}

function verifyResult(text) {
  const hasUrl = /https?:\/\//.test(text);
  const hasNumber = /\d/.test(text);
  return {
    reliability: hasUrl && hasNumber ? "高い" : hasUrl ? "中程度" : "低い",
    sources_present: hasUrl,
    multi_source_consistency: hasUrl && text.length > 80,
    is_outdated: /昔|以前|古い/.test(text),
    evidence_sufficient: hasUrl || hasNumber,
    has_bias: /絶対|必ず|全員|完全/.test(text),
    has_contradictions: /しかし|一方で/.test(text) && text.length < 120,
    confirmed_sources_count: hasUrl ? 2 : 0,
    consistency_rate: hasUrl ? 68 : 34,
    warnings: hasUrl ? ["出典の発行元と日付を確認してください。"] : ["出典URLが見つかりません。", "主張の根拠を追加すると信頼性が上がります。"],
    additional_check_recommended: !hasUrl,
    perspectives: [
      { view: "支持する見方", summary: "文章の主張を支える根拠がどこにあるか確認します。" },
      { view: "慎重な見方", summary: "例外や反対意見、古い情報が混じっていないか確認します。" }
    ],
    detail: "出典、複数資料の一致、根拠の量、情報の新しさ、偏り、矛盾の6基準で確認しました。"
  };
}

function aiResult(question) {
  return {
    answer: `${question}については、まず「何が起きているか」と「なぜそうなるか」に分けると理解しやすいです。`,
    method: "用語を確認し、原因、結果、具体例の順で整理します。分からない言葉が出たら、その言葉だけをもう一度調べます。",
    reasoning: "複雑なテーマも、小さな部品に分けると根拠を確認しやすくなり、暗記ではなく説明できる理解になります。",
    common_mistakes: "答えだけを覚えること、出典を確認しないこと、似た言葉を同じ意味として扱うことに注意してください。",
    similar_problems: "同じ方法で、歴史の出来事の原因、理科の実験結果、社会問題の背景も整理できます。"
  };
}

function slidesResult(topic) {
  return {
    title: `${topic}についての発表`,
    slides: [
      { slide_number: 1, heading: "テーマと問い", content: `${topic}について、何が重要なのかを示す。`, speaker_notes: "発表の目的を短く説明します。" },
      { slide_number: 2, heading: "基本情報", content: "用語の意味、背景、関連する出来事を整理する。", speaker_notes: "聞き手が前提を共有できるように話します。" },
      { slide_number: 3, heading: "調査結果", content: "複数の資料で共通していた情報を中心にまとめる。", speaker_notes: "出典を示しながら説明します。" },
      { slide_number: 4, heading: "考察", content: "調査から分かったこと、自分の考え、残った疑問を示す。", speaker_notes: "根拠と意見を分けて話します。" },
      { slide_number: 5, heading: "まとめ", content: "結論と今後さらに調べたいことをまとめる。", speaker_notes: "最後に一番伝えたいことを繰り返します。" }
    ],
    references: [
      { title: "文部科学省 資料", url: "https://www.mext.go.jp/" },
      { title: "NHK高校講座", url: "https://www.nhk.or.jp/kokokoza/" }
    ],
    suggestions: {
      too_much: "細かい説明や例が多すぎる場合は、発表時間に合わせて1枚1メッセージに絞りましょう。",
      too_little: "根拠となる数字、出典、具体例を1つずつ追加すると説得力が上がります。"
    }
  };
}

function questionsResult(topic) {
  return {
    questions: [
      { question: `なぜ${topic}を選んだのですか？`, answer_point: "身近さ、社会的な重要性、疑問を持った理由を答える。" },
      { question: "どの資料が一番信頼できると思いましたか？", answer_point: "公的機関や教育機関の資料を選び、理由を説明する。" },
      { question: "反対の意見はありましたか？", answer_point: "別の視点を紹介し、自分の結論との関係を話す。" },
      { question: "調査で一番難しかった点は？", answer_point: "情報の新しさや出典確認の難しさを説明する。" },
      { question: "今後さらに調べたいことは？", answer_point: "残った疑問や次の調査テーマを示す。" }
    ]
  };
}

function scriptResult(topic, slides) {
  const headings = slides?.slides?.map((slide) => slide.heading).join("、") || "問い、調査結果、まとめ";
  return `これから「${topic}」について発表します。\n\nまず、この発表では${headings}の順に説明します。最初に基本情報を確認し、次に複数の資料から分かったことを比べます。最後に、調査を通して分かったことと、今後さらに調べたいことをまとめます。\n\n今回大切だと思ったのは、情報を一つだけで判断せず、出典や根拠を確認することです。`;
}

function auditResult(text) {
  const issues = [];
  if (!/https?:\/\/|出典|参考/.test(text)) issues.push({ type: "出典不足", severity: "高", description: "根拠となる出典が本文から確認できません。", suggestion: "参考にした資料名やURLを追加してください。" });
  if (text.length < 120) issues.push({ type: "説明不足", severity: "中", description: "発表内容が短く、背景や具体例が不足している可能性があります。", suggestion: "理由、例、まとめを1つずつ追加してください。" });
  if (/絶対|必ず|完全/.test(text)) issues.push({ type: "表現の偏り", severity: "中", description: "強すぎる表現があり、偏った印象を与える可能性があります。", suggestion: "資料に基づく範囲で、より慎重な表現にしてください。" });
  const score = Math.max(35, 92 - issues.length * 18);
  return {
    issues,
    overall_score: score,
    summary: issues.length ? "発表の骨組みはありますが、出典や説明量を補うとより提出しやすくなります。" : "出典、説明量、表現のバランスが取れており、発表可能な状態です。",
    presentation_ready: issues.length === 0
  };
}

function summaryResult(style, result) {
  if (style === "箇条書き") return `・${result.summary}\n・重要ポイント: ${(result.key_points || []).join(" / ")}\n・注意点: ${(result.cautions || []).join(" / ")}`;
  if (style === "発表用") return `今回調べた${cleanTopic(result.summary)}について、複数の資料から共通して分かったことを中心に説明します。特に信頼度と出典を確認しながらまとめました。`;
  return `${result.summary}\n重要ポイントは「${(result.key_points || [])[0] || "根拠確認"}」です。\n出典と日付を確認してから使いましょう。`;
}

function cleanTopic(value) {
  return String(value || "調べ学習").replace(/^テーマ「|」.*$/g, "").slice(0, 80);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

