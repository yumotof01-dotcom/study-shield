import test from "node:test";
import assert from "node:assert/strict";

import { SearchResultError, normalizeSearchResult } from "../src/domain/searchResult.js";

const canonicalResult = {
  summary: "光合成の仕組みは、植物が光エネルギーを使って有機物を作る過程です。",
  reliability_score: 82,
  consistency_rate: 76,
  sources: [
    {
      title: "光合成の基礎",
      publisher: "国立科学博物館",
      date: "2025",
      url: "https://example.org/photosynthesis",
      reliability: "高い"
    },
    {
      title: "植物の光合成",
      publisher: "科学技術振興機構",
      date: "2024",
      url: "https://example.org/plant-science",
      reliability: "中程度"
    }
  ],
  key_points: ["光エネルギーを化学エネルギーへ変換する"],
  cautions: ["植物の種類や環境で速度は変化する"],
  related_keywords: ["葉緑体", "クロロフィル"]
};

test("canonical search result stays in the UI schema", () => {
  assert.deepEqual(normalizeSearchResult(canonicalResult, { topic: "光合成の仕組み" }), {
    ...canonicalResult,
    perspectives: [],
    updated_info: ""
  });
});

test("alternate provider fields are normalized before rendering", () => {
  const result = normalizeSearchResult({
    result: {
      summaryText: "江戸幕府の成立は、徳川家康が征夷大将軍となった1603年を基本の節目とします。",
      score: "79%",
      sourceAgreement: "68",
      citations: [
        {
          name: "江戸幕府の成立",
          organization: "国立公文書館",
          year: 2024,
          link: "https://example.org/edo",
          confidence: "high"
        },
        {
          name: "徳川家康と江戸幕府",
          organization: "国立国会図書館",
          year: 2023,
          link: "https://example.org/ieyasu",
          confidence: "medium"
        }
      ],
      importantPoints: ["1603年に徳川家康が征夷大将軍となった"],
      warnings: ["成立年の捉え方には複数の観点がある"],
      keywords: ["徳川家康", "征夷大将軍"]
    }
  }, { topic: "江戸幕府の成立" });

  assert.equal(result.reliability_score, 79);
  assert.equal(result.consistency_rate, 68);
  assert.deepEqual(result.sources[0], {
    title: "江戸幕府の成立",
    publisher: "国立公文書館",
    date: "2024",
    url: "https://example.org/edo",
    reliability: "高い"
  });
  assert.deepEqual(result.key_points, ["1603年に徳川家康が征夷大将軍となった"]);
});

test("missing scores are rejected instead of becoming zero percent", () => {
  const partial = { ...canonicalResult };
  delete partial.reliability_score;
  delete partial.consistency_rate;

  assert.throws(
    () => normalizeSearchResult(partial, { topic: "光合成" }),
    (error) => error instanceof SearchResultError
      && error.issues.includes("reliability_score")
      && error.issues.includes("consistency_rate")
  );
});

test("a source without a reliability label is rejected", () => {
  const partial = structuredClone(canonicalResult);
  delete partial.sources[0].reliability;

  assert.throws(
    () => normalizeSearchResult(partial, { topic: "光合成" }),
    (error) => error instanceof SearchResultError && error.issues.includes("sources[0].reliability")
  );
});

test("an unrelated sample summary is rejected", () => {
  assert.throws(
    () => normalizeSearchResult({ ...canonicalResult, summary: "調べ学習についての固定サンプル結果です。" }, { topic: "地球温暖化の影響" }),
    (error) => error instanceof SearchResultError && error.issues.includes("summary_topic_mismatch")
  );
});

test("a title-only summary is rejected even when it matches the topic", () => {
  assert.throws(
    () => normalizeSearchResult({ ...canonicalResult, summary: "光合成の仕組み" }, { topic: "光合成の仕組み" }),
    (error) => error instanceof SearchResultError && error.issues.includes("summary")
  );
});
