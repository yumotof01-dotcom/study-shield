import { normalizeSearchResult } from "../src/domain/searchResult.js";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_REQUEST_BYTES = 200_000;
const MAX_PROMPT_LENGTH = 20_000;
const MAX_CONTEXT_BYTES = 60_000;
const MAX_SCHEMA_BYTES = 60_000;
const ALLOWED_TASKS = new Set(["general", "search", "route", "verify", "ai", "slides", "questions", "script", "audit", "summary"]);

const corsHeaders = (request) => ({
  "Access-Control-Allow-Origin": new URL(request.url).origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname === "/api/ai") {
      if (!isSameOrigin(request)) return json({ ok: false, error: "Origin is not allowed." }, 403);
      return new Response(null, { headers: corsHeaders(request) });
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, provider: env.AI_PROVIDER || "auto" });
    }

    if (url.pathname === "/api/ai" && request.method === "POST") {
      if (!isSameOrigin(request)) {
        return json({ ok: false, error: "Origin is not allowed." }, 403);
      }

      try {
        const parsed = await readAndValidatePayload(request);
        if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
        const payload = parsed.payload;
        const result = await invokeStudyShieldAI(payload, env);
        return json({ ok: true, ...result }, 200, request);
      } catch (error) {
        console.error(JSON.stringify({ event: "ai_request_failed", message: error.message }));
        return json({ ok: false, error: "AI request failed." }, 502, request);
      }
    }

    return env.ASSETS.fetch(request);
  }
};

function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return Boolean(origin) && origin === new URL(request.url).origin;
}

async function readAndValidatePayload(request) {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return { error: "Content-Type must be application/json.", status: 415 };
  }

  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_REQUEST_BYTES) {
    return { error: "AI request is too large.", status: 413 };
  }

  const body = await readBodyWithLimit(request, MAX_REQUEST_BYTES);
  if (!body) {
    return { error: "AI request is too large.", status: 413 };
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return { error: "Request body must be valid JSON.", status: 400 };
  }

  if (!isPlainObject(payload)) return { error: "Request body must be a JSON object.", status: 400 };
  const allowedKeys = new Set(["prompt", "schema", "addContextFromInternet", "context"]);
  if (Object.keys(payload).some((key) => !allowedKeys.has(key))) {
    return { error: "Request contains unsupported fields.", status: 400 };
  }
  if (typeof payload.prompt !== "string" || !payload.prompt.trim()) {
    return { error: "prompt is required.", status: 400 };
  }
  if (payload.prompt.length > MAX_PROMPT_LENGTH) {
    return { error: "prompt is too long.", status: 413 };
  }
  if (payload.addContextFromInternet !== undefined && typeof payload.addContextFromInternet !== "boolean") {
    return { error: "addContextFromInternet must be a boolean.", status: 400 };
  }
  if (payload.context !== undefined && !isPlainObject(payload.context)) {
    return { error: "context must be an object.", status: 400 };
  }
  if (jsonByteLength(payload.context || {}) > MAX_CONTEXT_BYTES) {
    return { error: "context is too large.", status: 413 };
  }

  const task = payload.context?.task || "general";
  if (typeof task !== "string" || !ALLOWED_TASKS.has(task)) {
    return { error: "task is not supported.", status: 400 };
  }
  if (payload.schema !== undefined && payload.schema !== null) {
    if (!isPlainObject(payload.schema) || jsonByteLength(payload.schema) > MAX_SCHEMA_BYTES || !isSafeTree(payload.schema)) {
      return { error: "schema is not valid.", status: 400 };
    }
  }

  return {
    payload: {
      prompt: payload.prompt.trim(),
      schema: payload.schema || null,
      addContextFromInternet: payload.addContextFromInternet === true,
      context: payload.context || { task }
    }
  };
}

async function readBodyWithLimit(request, limit) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonByteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function isSafeTree(value, depth = 0, state = { nodes: 0 }) {
  if (depth > 12 || ++state.nodes > 600) return false;
  if (Array.isArray(value)) return value.every((item) => isSafeTree(item, depth + 1, state));
  if (!value || typeof value !== "object") return true;
  return Object.entries(value).every(([key, item]) => !["__proto__", "prototype", "constructor"].includes(key) && isSafeTree(item, depth + 1, state));
}

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
      const result = await attempt.run();
      if (payload.context?.task === "search") {
        result.data = normalizeSearchResult(result.data, { topic: payload.context?.input || "" });
      }
      return result;
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
      json_schema: makeStrictSchema(payload.schema)
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
  const searchLine = task === "search" && payload.context?.input
    ? `調査テーマは「${payload.context.input}」です。summaryの冒頭にこのテーマ名をそのまま含め、題名だけではなく具体的な調査結果を3文以上で説明してください。独立した出典を2件以上示し、各出典のreliabilityは「高い」「中程度」「低い」のいずれかにしてください。reliability_scoreとconsistency_rateは0から100の百分率で採点し、0から1の小数尺度は使わないでください。テーマに直接対応する内容だけを返してください。`
    : "";

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
        searchLine,
        `task=${task}`
      ].filter(Boolean).join("\n")
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

function json(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...(request ? corsHeaders(request) : {}),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
