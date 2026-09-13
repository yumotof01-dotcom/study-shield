const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_REQUEST_BYTES = 200_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, provider: env.AI_PROVIDER || "auto" });
    }

    if (url.pathname === "/api/ai" && request.method === "POST") {
      try {
        const contentLength = Number(request.headers.get("content-length") || 0);
        if (contentLength > MAX_REQUEST_BYTES) {
          return json({ ok: false, error: "AI request is too large." }, 413);
        }
        const payload = await request.json();
        if (!payload || typeof payload.prompt !== "string" || !payload.prompt.trim()) {
          return json({ ok: false, error: "prompt is required." }, 400);
        }
        const result = await invokeStudyShieldAI(payload, env);
        return json({ ok: true, ...result });
      } catch (error) {
        console.error(JSON.stringify({ event: "ai_request_failed", message: error.message }));
        return json({ ok: false, error: error.message || "AI request failed" }, 502);
      }
    }

    return env.ASSETS.fetch(request);
  }
};

async function invokeStudyShieldAI(payload, env) {
  const provider = env.AI_PROVIDER || "auto";
  const attempts = [];

  if ((provider === "auto" || provider === "groq") && env.GROQ_API_KEY) {
    attempts.push({ provider: "groq", run: () => callGroq(payload, env) });
  }

  if (provider === "auto" || provider === "workers-ai" || provider === "cloudflare") {
    attempts.push({ provider: "workers-ai", run: () => callWorkersAI(payload, env) });
  }

  if (attempts.length === 0) {
    throw new Error("No AI provider configured. Set GROQ_API_KEY or use the Workers AI binding.");
  }

  let lastError;
  for (const attempt of attempts) {
    try {
      return await attempt.run();
    } catch (error) {
      lastError = error;
      console.warn(JSON.stringify({ event: "ai_provider_failed", provider: attempt.provider, message: error.message }));
    }
  }
  throw lastError;
}

async function callGroq(payload, env) {
  const model = env.GROQ_MODEL || "openai/gpt-oss-120b";
  let messages = buildMessages(payload);

  if (payload.addContextFromInternet) {
    const research = await researchWithGroq(payload, env);
    const researchText = research?.choices?.[0]?.message?.content || "";
    messages = [
      ...messages,
      {
        role: "user",
        content: [
          "以下はWeb検索を行った調査メモです。URL、発行元、日付を保ちながら回答に反映してください。",
          "不確かな内容は断定せず、検索メモにない事実を作らないでください。",
          researchText
        ].join("\n\n")
      }
    ];
  }

  const body = {
    model,
    messages,
    temperature: 0.2,
    max_completion_tokens: 2200
  };

  if (payload.schema) {
    const schema = makeStrictSchema(payload.schema);
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: schemaName(payload.context?.task),
        strict: true,
        schema
      }
    };
  }

  const data = await requestGroq({ apiKey: env.GROQ_API_KEY, body });

  return {
    provider: "groq",
    model,
    data: normalizeGroqContent(data, Boolean(payload.schema))
  };
}

async function researchWithGroq(payload, env) {
  const searchModel = env.GROQ_SEARCH_MODEL || "groq/compound";
  const messages = buildMessages({ ...payload, schema: null });

  try {
    return await requestGroq({
      apiKey: env.GROQ_API_KEY,
      body: {
        model: searchModel,
        messages,
        max_completion_tokens: 3000
      }
    });
  } catch (error) {
    console.warn(JSON.stringify({ event: "groq_compound_failed", model: searchModel, message: error.message }));
    return requestGroq({
      apiKey: env.GROQ_API_KEY,
      body: {
        model: env.GROQ_MODEL || "openai/gpt-oss-120b",
        messages,
        tools: [{ type: "browser_search" }],
        max_completion_tokens: 3000
      }
    });
  }
}

async function requestGroq({ apiKey, body }) {
  const response = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Groq request failed with ${response.status}`);
  }
  return data;
}

async function callWorkersAI(payload, env) {
  if (!env.AI) throw new Error("Cloudflare Workers AI binding is not available.");
  const model = env.WORKERS_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct-fast";
  const input = {
    messages: buildMessages(payload),
    temperature: 0.2,
    max_tokens: 2200
  };

  if (payload.schema) {
    input.response_format = {
      type: "json_schema",
      json_schema: payload.schema
    };
  }

  const response = await env.AI.run(model, input);
  return {
    provider: "workers-ai",
    model,
    data: normalizeWorkersAIContent(response, Boolean(payload.schema))
  };
}

function buildMessages(payload) {
  const task = payload.context?.task || "general";
  const schemaLine = payload.schema ? "必ず指定されたJSON Schemaに合うJSONだけで返してください。" : "自然な日本語テキストで返してください。";
  const webLine = payload.addContextFromInternet ? "可能な場合は現在の情報や公的・教育機関・研究機関の情報源を重視してください。" : "与えられた情報をもとに回答してください。";

  return [
    {
      role: "system",
      content: [
        "あなたはStudyShieldの学習支援AIです。",
        "小中高生の調べ学習を支援し、根拠、出典、偏り、注意点を分かりやすく扱います。",
        "信頼度スコアは厳格に付け、安易に80以上を付けないでください。",
        "不確かな場合は断定せず、追加確認が必要だと明記してください。",
        schemaLine,
        webLine,
        `task=${task}`
      ].join("\n")
    },
    { role: "user", content: payload.prompt || "" }
  ];
}

function normalizeGroqContent(data, wantsJson) {
  const content = data?.choices?.[0]?.message?.content;
  if (!wantsJson) return content || "";
  return parseJsonLike(content);
}

function normalizeWorkersAIContent(response, wantsJson) {
  if (!wantsJson) return response?.response || response?.result?.response || "";
  if (response?.response && typeof response.response === "object") return response.response;
  if (response?.result?.response && typeof response.result.response === "object") return response.result.response;
  return parseJsonLike(response?.response || response?.result?.response || response);
}

function parseJsonLike(value) {
  if (typeof value === "object" && value !== null) return value;
  const text = String(value || "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("AI response was not valid JSON.");
  }
}

function makeStrictSchema(schema) {
  if (Array.isArray(schema)) return schema.map(makeStrictSchema);
  if (!schema || typeof schema !== "object") return schema;

  const normalized = {};
  for (const [key, value] of Object.entries(schema)) {
    normalized[key] = makeStrictSchema(value);
  }
  if (normalized.type === "object" && normalized.properties) {
    normalized.required = Object.keys(normalized.properties);
    normalized.additionalProperties = false;
  }
  return normalized;
}

function schemaName(task) {
  const safeTask = String(task || "result").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return `studyshield_${safeTask || "result"}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
