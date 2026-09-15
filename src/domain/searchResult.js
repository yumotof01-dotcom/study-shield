const RELIABILITY_LEVELS = new Set(["高い", "中程度", "低い"]);

export class SearchResultError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = "SearchResultError";
    this.issues = issues;
  }
}

export function normalizeSearchResult(rawResult, { topic = "", requireTopicMatch = true } = {}) {
  const raw = unwrapResult(rawResult);
  if (!isObject(raw)) throw new SearchResultError("Search result must be an object.", ["result"]);

  const summary = asText(pick(raw, ["summary", "summaryText", "summary_text", "overview", "answer"]));
  const reliabilityScore = asScore(pick(raw, ["reliability_score", "reliabilityScore", "score", "confidence_score", "confidenceScore"]));
  const consistencyRate = asScore(pick(raw, ["consistency_rate", "consistencyRate", "agreement_rate", "agreementRate", "sourceAgreement", "source_agreement"]));
  const sourceItems = pick(raw, ["sources", "citations", "references"]);
  const sources = Array.isArray(sourceItems) ? sourceItems.map(normalizeSource) : [];
  const keyPoints = asTextArray(pick(raw, ["key_points", "keyPoints", "important_points", "importantPoints"]));
  const cautions = asTextArray(pick(raw, ["cautions", "warnings", "notes"]));
  const relatedKeywords = asTextArray(pick(raw, ["related_keywords", "relatedKeywords", "keywords"]));
  const perspectives = normalizePerspectives(pick(raw, ["perspectives", "viewpoints"]));
  const updatedInfo = asText(pick(raw, ["updated_info", "updatedInfo", "last_updated", "lastUpdated"]));

  const issues = [];
  if (!summary || normalizeForMatch(summary).length < 24) issues.push("summary");
  if (summary && requireTopicMatch && topic && !summaryMatchesTopic(summary, topic)) issues.push("summary_topic_mismatch");
  if (reliabilityScore === null) issues.push("reliability_score");
  if (consistencyRate === null) issues.push("consistency_rate");
  if (sources.length < 2) issues.push("sources");
  sources.forEach((source, index) => {
    if (!source.title) issues.push(`sources[${index}].title`);
    if (!source.url) issues.push(`sources[${index}].url`);
    if (!RELIABILITY_LEVELS.has(source.reliability)) issues.push(`sources[${index}].reliability`);
  });
  if (!keyPoints.length) issues.push("key_points");
  if (!cautions.length) issues.push("cautions");
  if (!relatedKeywords.length) issues.push("related_keywords");

  if (issues.length) {
    throw new SearchResultError(`Search result is incomplete: ${issues.join(", ")}`, issues);
  }

  return {
    summary,
    sources,
    reliability_score: reliabilityScore,
    consistency_rate: consistencyRate,
    cautions,
    related_keywords: relatedKeywords,
    perspectives,
    key_points: keyPoints,
    updated_info: updatedInfo
  };
}

function unwrapResult(value) {
  let current = value;
  for (let depth = 0; depth < 3 && isObject(current); depth += 1) {
    if (hasSearchFields(current)) return current;
    const nested = pick(current, ["data", "result", "searchResult", "search_result"]);
    if (!isObject(nested)) return current;
    current = nested;
  }
  return current;
}

function hasSearchFields(value) {
  return ["summary", "summaryText", "summary_text", "sources", "citations", "reliability_score", "reliabilityScore"].some((key) => key in value);
}

function normalizeSource(source) {
  if (!isObject(source)) return { title: "", url: "", publisher: "", date: "", reliability: "" };
  const url = asHttpUrl(pick(source, ["url", "link", "href"]));
  return {
    title: asText(pick(source, ["title", "name", "source_title", "sourceTitle"])),
    url,
    publisher: asText(pick(source, ["publisher", "organization", "organisation", "source", "site_name", "siteName"])),
    date: asText(pick(source, ["date", "year", "published_at", "publishedAt"])),
    reliability: asReliability(pick(source, ["reliability", "confidenceLevel", "confidence_level", "confidence", "reliabilityLevel", "reliability_level"]))
  };
}

function normalizePerspectives(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    view: asText(pick(item, ["view", "title", "name"])),
    summary: asText(pick(item, ["summary", "description", "content"]))
  })).filter((item) => item.view && item.summary);
}

function asScore(value) {
  if (typeof value === "string") value = value.trim().replace(/%$/, "");
  if (value === "" || value === null || value === undefined) return null;
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  return Math.round(score * 10) / 10;
}

function asReliability(value) {
  if (typeof value === "number") return value >= 75 ? "高い" : value >= 45 ? "中程度" : "低い";
  const normalized = asText(value).toLowerCase().replace(/[\s_-]/g, "");
  if (["高い", "高", "high", "reliable", "strong"].includes(normalized)) return "高い";
  if (["中程度", "中", "medium", "moderate", "average"].includes(normalized)) return "中程度";
  if (["低い", "低", "low", "unreliable", "weak"].includes(normalized)) return "低い";
  const numeric = asScore(value);
  return numeric === null ? "" : numeric >= 75 ? "高い" : numeric >= 45 ? "中程度" : "低い";
}

function asTextArray(value) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split(/\r?\n|[、;；]/).map((item) => item.replace(/^[-*・\d.)\s]+/, "").trim()).filter(Boolean);
}

function asHttpUrl(value) {
  const text = asText(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function summaryMatchesTopic(summary, topic) {
  const normalizedSummary = normalizeForMatch(summary);
  const normalizedTopic = normalizeForMatch(topic);
  if (!normalizedTopic) return true;
  if (normalizedSummary.includes(normalizedTopic)) return true;

  const coreTopic = normalizedTopic.replace(/(?:について|とは|の(?:仕組み|影響|原因|歴史|特徴|課題|対策))$/u, "");
  if (coreTopic.length >= 2 && normalizedSummary.includes(coreTopic)) return true;

  const words = String(topic).toLowerCase().split(/[\s、。・,./／]+/).map(normalizeForMatch).filter((word) => word.length >= 3);
  return words.some((word) => normalizedSummary.includes(word));
}

function normalizeForMatch(value) {
  return asText(value).toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

function pick(value, keys) {
  if (!isObject(value)) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key) && value[key] !== undefined && value[key] !== null) return value[key];
  }
  return undefined;
}

function asText(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
