const RELIABILITY_LEVELS = new Set(["高い", "中程度", "低い"]);

export class AIResultError extends Error {
  constructor(task, issues = []) {
    super(`AI応答の形式が不完全です。もう一度お試しください。 (${task}: ${issues.join(", ")})`);
    this.name = "AIResultError";
    this.task = task;
    this.issues = issues;
  }
}

export function normalizeRouteResult(raw) {
  const result = requireObject(raw, "route");
  const steps = Array.isArray(result.steps) ? result.steps.map((item, index) => {
    const step = isObject(item) ? item : {};
    return {
      step: validNumber(step.step) ? step.step : index + 1,
      title: text(step.title),
      description: text(step.description),
      keywords: textArray(step.keywords)
    };
  }) : [];
  const issues = [];
  if (!steps.length) issues.push("steps");
  steps.forEach((step, index) => {
    if (!step.title) issues.push(`steps[${index}].title`);
    if (!step.description) issues.push(`steps[${index}].description`);
  });
  if (issues.length) throw new AIResultError("route", issues);
  return { steps };
}

export function normalizeVerificationResult(raw) {
  const result = requireObject(raw, "verify");
  const normalized = {
    reliability: normalizeReliability(result.reliability),
    sources_present: result.sources_present,
    multi_source_consistency: result.multi_source_consistency,
    is_outdated: result.is_outdated,
    evidence_sufficient: result.evidence_sufficient,
    has_bias: result.has_bias,
    has_contradictions: result.has_contradictions,
    confirmed_sources_count: asNonNegativeNumber(result.confirmed_sources_count),
    consistency_rate: asScore(result.consistency_rate),
    warnings: textArray(result.warnings),
    additional_check_recommended: result.additional_check_recommended,
    perspectives: normalizePerspectives(result.perspectives),
    detail: text(result.detail)
  };
  const issues = [];
  if (!RELIABILITY_LEVELS.has(normalized.reliability)) issues.push("reliability");
  for (const key of ["sources_present", "multi_source_consistency", "is_outdated", "evidence_sufficient", "has_bias", "has_contradictions", "additional_check_recommended"]) {
    if (typeof normalized[key] !== "boolean") issues.push(key);
  }
  if (normalized.confirmed_sources_count === null) issues.push("confirmed_sources_count");
  if (normalized.consistency_rate === null) issues.push("consistency_rate");
  if (!normalized.detail) issues.push("detail");
  if (issues.length) throw new AIResultError("verify", issues);
  return normalized;
}

export function normalizeResearcherResult(raw) {
  const result = requireObject(raw, "ai");
  const normalized = {
    answer: text(result.answer),
    method: text(result.method),
    reasoning: text(result.reasoning),
    common_mistakes: text(result.common_mistakes),
    similar_problems: text(result.similar_problems)
  };
  const issues = Object.entries(normalized).filter(([, value]) => !value).map(([key]) => key);
  if (issues.length) throw new AIResultError("ai", issues);
  return normalized;
}

export function normalizeSlidesResult(raw) {
  const result = requireObject(raw, "slides");
  const slides = Array.isArray(result.slides) ? result.slides.map((item, index) => {
    const slide = isObject(item) ? item : {};
    return {
      slide_number: validNumber(slide.slide_number) ? slide.slide_number : index + 1,
      heading: text(slide.heading),
      content: text(slide.content),
      speaker_notes: text(slide.speaker_notes)
    };
  }) : [];
  const references = Array.isArray(result.references) ? result.references.map((item) => ({
    title: text(item?.title),
    url: safeHttpUrl(item?.url)
  })).filter((item) => item.title && item.url) : [];
  const suggestions = isObject(result.suggestions) ? {
    too_much: text(result.suggestions.too_much),
    too_little: text(result.suggestions.too_little)
  } : { too_much: "", too_little: "" };
  const normalized = { title: text(result.title), slides, references, suggestions };
  const issues = [];
  if (!normalized.title) issues.push("title");
  if (!slides.length) issues.push("slides");
  slides.forEach((slide, index) => {
    if (!slide.heading) issues.push(`slides[${index}].heading`);
    if (!slide.content) issues.push(`slides[${index}].content`);
  });
  if (!suggestions.too_much) issues.push("suggestions.too_much");
  if (!suggestions.too_little) issues.push("suggestions.too_little");
  if (issues.length) throw new AIResultError("slides", issues);
  return normalized;
}

export function normalizeQuestionsResult(raw) {
  const result = requireObject(raw, "questions");
  const questions = Array.isArray(result.questions) ? result.questions.map((item) => ({
    question: text(item?.question),
    answer_point: text(item?.answer_point)
  })) : [];
  const issues = [];
  if (!questions.length) issues.push("questions");
  questions.forEach((question, index) => {
    if (!question.question) issues.push(`questions[${index}].question`);
    if (!question.answer_point) issues.push(`questions[${index}].answer_point`);
  });
  if (issues.length) throw new AIResultError("questions", issues);
  return { questions };
}

export function normalizeAuditResult(raw) {
  const result = requireObject(raw, "audit");
  const issuesList = Array.isArray(result.issues) ? result.issues.map((item) => ({
    type: text(item?.type),
    severity: normalizeSeverity(item?.severity),
    description: text(item?.description),
    suggestion: text(item?.suggestion)
  })) : [];
  const normalized = {
    issues: issuesList,
    overall_score: asScore(result.overall_score),
    summary: text(result.summary),
    presentation_ready: result.presentation_ready
  };
  const issues = [];
  if (!Array.isArray(result.issues)) issues.push("issues");
  issuesList.forEach((item, index) => {
    if (!item.type || !item.severity || !item.description) issues.push(`issues[${index}]`);
  });
  if (normalized.overall_score === null) issues.push("overall_score");
  if (!normalized.summary) issues.push("summary");
  if (typeof normalized.presentation_ready !== "boolean") issues.push("presentation_ready");
  if (issues.length) throw new AIResultError("audit", issues);
  return normalized;
}

export function normalizeTextResult(raw, task = "text") {
  const value = text(raw);
  if (!value) throw new AIResultError(task, ["text"]);
  return value;
}

export function safeHttpUrl(value) {
  const raw = text(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function requireObject(value, task) {
  if (!isObject(value)) throw new AIResultError(task, ["result"]);
  return value;
}

function normalizePerspectives(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({ view: text(item?.view), summary: text(item?.summary) })).filter((item) => item.view && item.summary);
}

function textArray(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function asScore(value) {
  const number = Number(value);
  return validNumber(number) && number >= 0 && number <= 100 ? number : null;
}

function asNonNegativeNumber(value) {
  const number = Number(value);
  return validNumber(number) && number >= 0 ? number : null;
}

function normalizeReliability(value) {
  const normalized = text(value).toLowerCase().replace(/[\s_-]/g, "");
  if (["高い", "高", "high", "reliable", "strong"].includes(normalized)) return "高い";
  if (["中程度", "中", "medium", "moderate", "average"].includes(normalized)) return "中程度";
  if (["低い", "低", "low", "unreliable", "weak"].includes(normalized)) return "低い";
  return "";
}

function normalizeSeverity(value) {
  const normalized = text(value).toLowerCase().replace(/[\s_-]/g, "");
  if (["高", "高い", "high", "critical", "severe"].includes(normalized)) return "高";
  if (["中", "中程度", "medium", "moderate"].includes(normalized)) return "中";
  if (["低", "低い", "low", "minor"].includes(normalized)) return "低";
  return text(value);
}

function validNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function text(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
