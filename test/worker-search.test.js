import test from "node:test";
import assert from "node:assert/strict";

import worker from "../worker/index.js";

function requestFor(topic) {
  return new Request("https://studyshield.test/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://studyshield.test"
    },
    body: JSON.stringify({
      prompt: `テーマ「${topic}」を調査してください。`,
      addContextFromInternet: true,
      context: { task: "search", input: topic }
    })
  });
}

function workersEnv(response) {
  return {
    AI_PROVIDER: "workers-ai",
    AI: { run: async () => ({ response }) }
  };
}

test("the Worker returns one canonical search-result shape", async () => {
  const response = await worker.fetch(requestFor("地球温暖化の影響"), workersEnv({
    summaryText: "地球温暖化の影響には、気温上昇、海面上昇、生態系への変化があります。",
    reliabilityScore: 74,
    agreementRate: 69,
    citations: [
      {
        name: "気候変動に関する報告",
        organization: "環境省",
        link: "https://example.org/climate",
        confidenceLevel: "中程度"
      },
      {
        name: "世界の気候",
        publisher: "気象庁",
        url: "https://example.org/weather",
        confidence: 88
      }
    ],
    keyPoints: ["世界平均気温が上昇している"],
    cautions: ["地域ごとの影響には差がある"],
    keywords: ["気候変動", "海面上昇"]
  }));

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.data.reliability_score, 74);
  assert.equal(payload.data.consistency_rate, 69);
  assert.deepEqual(payload.data.sources.map((source) => source.reliability), ["中程度", "高い"]);
  assert.ok(payload.data.summary.includes("地球温暖化の影響"));
});

test("the Worker rejects incomplete provider data instead of returning a sample", async () => {
  const response = await worker.fetch(requestFor("量子コンピューター"), workersEnv({
    summary: "量子コンピューターについての説明です。",
    sources: [{ title: "資料", url: "https://example.org/quantum" }]
  }));

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { ok: false, error: "AI request failed." });
});

test("the Worker rejects malformed non-search AI responses", async () => {
  const request = new Request("https://studyshield.test/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "https://studyshield.test" },
    body: JSON.stringify({
      prompt: "文章を検証してください。",
      context: { task: "verify", input: "検証対象" }
    })
  });
  const response = await worker.fetch(request, workersEnv({ reliability: "高い" }));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { ok: false, error: "AI request failed." });
});
