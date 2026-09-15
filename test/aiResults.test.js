import test from "node:test";
import assert from "node:assert/strict";

import {
  AIResultError,
  normalizeAuditResult,
  normalizeQuestionsResult,
  normalizeResearcherResult,
  normalizeRouteResult,
  normalizeSlidesResult,
  normalizeTextResult,
  normalizeVerificationResult,
  safeHttpUrl
} from "../src/domain/aiResults.js";

test("route steps get stable numbers and safe keyword arrays", () => {
  assert.deepEqual(normalizeRouteResult({ steps: [{ title: "基礎", description: "用語を確認する" }] }), {
    steps: [{ step: 1, title: "基礎", description: "用語を確認する", keywords: [] }]
  });
});

test("verification rejects a score outside 0 to 100", () => {
  assert.throws(() => normalizeVerificationResult({
    reliability: "高い",
    sources_present: true,
    multi_source_consistency: true,
    is_outdated: false,
    evidence_sufficient: true,
    has_bias: false,
    has_contradictions: false,
    confirmed_sources_count: 2,
    consistency_rate: 120,
    warnings: [],
    additional_check_recommended: false,
    perspectives: [],
    detail: "確認結果"
  }), (error) => error instanceof AIResultError && error.issues.includes("consistency_rate"));
});

test("provider reliability labels are normalized for the verification UI", () => {
  const result = normalizeVerificationResult({
    reliability: "high",
    sources_present: true,
    multi_source_consistency: true,
    is_outdated: false,
    evidence_sufficient: true,
    has_bias: false,
    has_contradictions: false,
    confirmed_sources_count: 2,
    consistency_rate: 75,
    warnings: [],
    additional_check_recommended: false,
    perspectives: [],
    detail: "複数の資料で確認しました。"
  });
  assert.equal(result.reliability, "高い");
});

test("researcher rejects a partial response before rendering", () => {
  assert.throws(
    () => normalizeResearcherResult({ answer: "回答だけ" }),
    (error) => error instanceof AIResultError && error.issues.includes("method")
  );
});

test("slides discard unsafe references and preserve valid content", () => {
  const result = normalizeSlidesResult({
    title: "発表",
    slides: [{ slide_number: 1, heading: "導入", content: "テーマを説明する", speaker_notes: "" }],
    references: [
      { title: "危険", url: "javascript:alert(1)" },
      { title: "安全", url: "https://example.org/source" }
    ],
    suggestions: { too_much: "説明を絞る", too_little: "根拠を足す" }
  });
  assert.deepEqual(result.references, [{ title: "安全", url: "https://example.org/source" }]);
});

test("questions, audit and plain text reject incomplete data", () => {
  assert.throws(() => normalizeQuestionsResult({ questions: [{}] }), AIResultError);
  assert.throws(() => normalizeAuditResult({ issues: [], overall_score: 80, summary: "確認済み" }), AIResultError);
  assert.throws(() => normalizeTextResult("   ", "script"), AIResultError);
});

test("only HTTP and HTTPS URLs are accepted", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), "");
  assert.equal(safeHttpUrl("data:text/html,test"), "");
  assert.equal(safeHttpUrl("https://example.org/path"), "https://example.org/path");
});
