import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import { Link, NavLink, Outlet, Route, BrowserRouter as Router, Routes, useLocation } from "react-router-dom";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  BookOpen,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Edit3,
  FileText,
  GraduationCap,
  Home,
  Library,
  Lightbulb,
  Link as LinkIcon,
  ListChecks,
  Menu,
  MessageSquare,
  Plus,
  Presentation,
  RefreshCw,
  Route as RouteIcon,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import {
  AUDIT_SCHEMA,
  AI_SCHEMA,
  QUESTIONS_SCHEMA,
  ROUTE_SCHEMA,
  SEARCH_SCHEMA,
  SLIDE_SCHEMA,
  VERIFY_SCHEMA,
  base44,
  callAI,
  clearTutorial,
  getSettings,
  saveSettings
} from "./adapters/base44Adapter.js";
import { normalizeSearchResult } from "./domain/searchResult.js";
import {
  normalizeAuditResult,
  normalizeQuestionsResult,
  normalizeResearcherResult,
  normalizeRouteResult,
  normalizeSlidesResult,
  normalizeTextResult,
  normalizeVerificationResult,
  safeHttpUrl
} from "./domain/aiResults.js";
import "./styles/original-studyshield.css";
import "./styles/app.css";

const categories = ["全て", "歴史", "理科", "社会", "国語", "その他"];
const reliabilityFilters = ["全て", "高い", "中程度", "低い"];

const navItems = [
  { to: "/", label: "知識の図書館", icon: Home, end: true },
  { to: "/search", label: "調査を開始", icon: Search },
  { to: "/verification", label: "検証結果", icon: ShieldCheck },
  { to: "/ai-researcher", label: "AI研究員", icon: Bot },
  { to: "/notes", label: "知識保管庫", icon: Library },
  { to: "/slides", label: "発表資料作成", icon: Presentation },
  { to: "/audit", label: "発表前チェック", icon: ClipboardCheck },
  { to: "/references", label: "出典一覧", icon: BookOpen },
  { to: "/settings", label: "設定", icon: Settings }
];

const featureCards = [
  { to: "/search", icon: Search, title: "調査を開始", desc: "テーマを入力して信頼できる情報源を探索・要約", color: "text-primary" },
  { to: "/verification", icon: ShieldCheck, title: "検証結果", desc: "文章の信頼性を6つの基準でチェック", color: "text-accent" },
  { to: "/ai-researcher", icon: Bot, title: "AI研究員", desc: "理解を深める質問応答。解き方と理由も提示", color: "text-primary" },
  { to: "/slides", icon: Presentation, title: "発表資料作成", desc: "スライド構成を自動提案。過不足も指摘", color: "text-accent" },
  { to: "/audit", icon: ClipboardCheck, title: "発表前チェック", desc: "スライド文章を提出前に監査", color: "text-primary" },
  { to: "/notes", icon: Library, title: "知識保管庫", desc: "調べた内容を保存・整理", color: "text-accent" },
  { to: "/references", icon: BookOpen, title: "出典一覧", desc: "使った情報源を自動で整理・管理", color: "text-primary" },
  { to: "/verification", icon: AlertTriangle, title: "偏りチェック", desc: "複数の視点を並べて情報の偏りを確認", color: "text-accent" }
];

const tutorialSteps = [
  { icon: GraduationCap, title: "ようこそ、StudyShieldへ", desc: "このアプリは調べ学習の情報を確認するためのものです。ネットやAIの情報が正しいか見極め、安心して調べ・まとめ・発表できます。" },
  { icon: Search, title: "調査を開始", desc: "テーマを入力すると、複数の情報源から要約と信頼度を表示します。調べ学習はここから始まります。" },
  { icon: ShieldCheck, title: "信頼度と出典の見方", desc: "信頼度スコアと出典一覧で情報の確かさを確認できます。注意点も必ず読んで、誤情報を見極めましょう。" },
  { icon: Library, title: "ノート保存", desc: "調べた内容は「知識保管庫」に保存できます。自分専用の知識庫として活用しましょう。" },
  { icon: Presentation, title: "スライド作成と提出前チェック", desc: "「発表資料作成」で構成を提案し、「発表前チェック」で問題を指摘します。この順番で使うと発表の質が上がります。" },
  { icon: Home, title: "ホームに戻る", desc: "どの画面からでも右下の「拠点」ボタンでホームに戻れます。迷ったら押してください。" }
];

function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashLeaving, setSplashLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setSplashLeaving(true), 1400);
    const hideTimer = window.setTimeout(() => setSplashVisible(false), 1900);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <>
      {splashVisible && <StartupSplash leaving={splashLeaving} />}
      <Router>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/verification" element={<VerificationPage />} />
            <Route path="/ai-researcher" element={<AIResearcherPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/slides" element={<SlidesPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/references" element={<ReferencesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}

function StartupSplash({ leaving }) {
  return (
    <div className={`startup-splash ${leaving ? "startup-splash-leaving" : ""}`} aria-label="StudyShieldを起動中">
      <img src="/studyshield-logo.png" alt="StudyShield" className="startup-logo" />
      <div className="startup-progress" aria-hidden="true"><span /></div>
    </div>
  );
}

function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => localStorage.getItem("studyshield_tutorial_done") !== "true");
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="scanlines crt-vignette min-h-screen app-frame">
      <button className="pixel-btn mobile-menu bg-card" onClick={() => setMenuOpen(true)} aria-label="メニュー">
        <Menu size={18} />
      </button>
      <aside className={`sidebar pixel-panel-flat ${menuOpen ? "sidebar-open" : ""}`}>
        <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="閉じる">
          <X size={18} />
        </button>
        <div className="sidebar-brand">
          <Link to="/" aria-label="StudyShield ホーム">
            <img src="/studyshield-logo.png" alt="StudyShield" className="sidebar-logo" />
          </Link>
          <p className="font-heading text-xs text-muted-foreground mt-2">情報信頼性チェック</p>
          <p className="font-heading text-xs text-muted-foreground">学習支援システム</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}>
              <item.icon size={17} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer font-display text-[0.6rem] text-muted-foreground">v1.0 // KNOWLEDGE OS</div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
      {location.pathname !== "/" && (
        <Link to="/" className="pixel-btn home-button bg-primary text-primary-foreground" title="知識の図書館へ戻る">
          <Home size={15} />
          拠点
        </Link>
      )}
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
    </div>
  );
}

function Tutorial({ onClose }) {
  const [step, setStep] = useState(0);
  const item = tutorialSteps[step];
  const Icon = item.icon;
  const finish = () => {
    localStorage.setItem("studyshield_tutorial_done", "true");
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
      <div className="pixel-panel tutorial-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-primary" />
          <span className="font-display text-[0.6rem] text-muted-foreground">// TUTORIAL</span>
        </div>
        <div className="flex items-start gap-4">
          <div className="pixel-panel-inset tutorial-icon">
            <Icon size={34} className="text-primary" />
          </div>
          <div className="flex-1">
            <span className="font-display text-[0.6rem] text-accent">STEP {step + 1}/{tutorialSteps.length}</span>
            <h2 className="font-heading text-xl text-primary mt-2">{item.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mt-3">{item.desc}</p>
          </div>
        </div>
        <div className="tutorial-progress mt-6">
          {tutorialSteps.map((_, index) => (
            <span key={index} className={index <= step ? "active" : ""} />
          ))}
        </div>
        <div className="flex justify-between gap-3 mt-6">
          <button className="pixel-btn px-4 py-2 bg-card text-xs" onClick={finish}>
            あとで見る
          </button>
          <button className="pixel-btn px-4 py-2 bg-primary text-primary-foreground text-xs" onClick={() => (step === tutorialSteps.length - 1 ? finish() : setStep(step + 1))}>
            {step === tutorialSteps.length - 1 ? "▶ 始める" : "次へ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HomePage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <section className="pixel-panel p-6 md:p-10 hero-panel">
        <div className="font-display text-[0.6rem] text-muted-foreground mb-3">// KNOWLEDGE LIBRARY</div>
        <img src="/studyshield-logo.png" alt="StudyShield" className="hero-logo" />
        <p className="font-heading text-sm md:text-base text-muted-foreground mt-4 max-w-3xl">
          調べ学習の相棒。情報の信頼性を見極め、誤情報を減らし、 安心して調べ・まとめ・発表するための学習支援システム。
        </p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link to="/search" className="pixel-btn px-5 py-3 bg-primary text-primary-foreground text-xs inline-flex items-center gap-2">
            <Search size={14} /> ▶ 調査を開始
          </Link>
          <Link to="/ai-researcher" className="pixel-btn px-5 py-3 bg-card text-xs inline-flex items-center gap-2">
            <Bot size={14} /> AI研究員に質問
          </Link>
        </div>
      </section>
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {featureCards.map((card) => (
          <Link to={card.to} key={card.title} className="pixel-panel p-4 feature-card animate-slide-in">
            <card.icon size={22} className={card.color} />
            <h3 className="font-heading text-sm text-foreground mt-3">{card.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mt-2">{card.desc}</p>
          </Link>
        ))}
      </section>
      <Panel title="使うヒント" icon={Lightbulb}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {["調べたら、信頼度と出典を必ず確認する", "重要ポイントは知識保管庫へ保存する", "発表前に文章を監査して根拠不足を探す", "偏りが出やすいテーマは複数の視点を見る"].map((tip, index) => (
            <div key={tip} className="pixel-panel-inset p-3 flex gap-3">
              <span className="font-display text-accent text-xs">0{index + 1}</span>
              <p className="text-sm text-muted-foreground">{tip}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SearchPage() {
  const [settings] = useState(getSettings);
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState("");
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  const runSearch = async () => {
    if (!theme.trim()) return;
    setLoading(true);
    setResult(null);
    setSummary("");
    setRoute(null);
    setError("");
    try {
      const prompt = `テーマ「${theme}」について、学年レベル「${settings.gradeLevel}」、検索モード「${settings.searchMode}」に合わせて調査してください。summaryはテーマ名「${theme}」を冒頭に明記したうえで、調査で分かった具体的な内容を3文以上で説明してください。題名だけのsummaryは禁止です。独立した出典を2件以上示し、各出典の信頼度を「高い」「中程度」「低い」のいずれかで必ず設定してください。reliability_scoreとconsistency_rateは0から100の百分率で採点し、0から1の小数尺度は使わないでください。信頼度スコアは厳格に採点し、安易に80以上をつけないでください。`;
      const data = await callAI(prompt, SEARCH_SCHEMA, true, { task: "search", input: theme, settings });
      setResult(normalizeSearchResult(data, { topic: theme }));
    } catch (searchError) {
      console.error("Search failed", searchError);
      setError(searchError?.message || "調査結果を取得できませんでした。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  const makeSummary = async (style) => {
    setError("");
    try {
      const text = await callAI(`次の調査結果を${style}で要約してください: ${JSON.stringify(result)}`, null, false, { task: "summary", input: style, result });
      setSummary(normalizeTextResult(text, "summary"));
    } catch (summaryError) {
      setError(summaryError?.message || "要約を作成できませんでした。");
    }
  };

  const saveNote = async () => {
    if (!result) return;
    setError("");
    try {
      await base44.entities.Note.create({
        title: theme,
        theme,
        summary: result.summary,
        key_points: result.key_points || [],
        keywords: result.related_keywords || [],
        reference_urls: (result.sources || []).map((source) => source.url).filter(Boolean),
        memo: "",
        category: settings.searchMode === "一般" ? "その他" : settings.searchMode
      });
      flash(setSaved, "★ 知識保管庫に保存しました");
    } catch (saveError) {
      setError(saveError?.message || "ノートを保存できませんでした。");
    }
  };

  const saveReferences = async () => {
    if (!result?.sources) return;
    setError("");
    try {
      await base44.entities.Reference.bulkCreate(result.sources.map((source) => ({
        title: source.title,
        url: source.url,
        source: source.publisher,
        reliability: source.reliability,
        theme,
        notes: source.date
      })));
      flash(setSaved, "★ 出典一覧に保存しました");
    } catch (saveError) {
      setError(saveError?.message || "出典を保存できませんでした。");
    }
  };

  const generateRoute = async () => {
    setRouteLoading(true);
    setError("");
    try {
      const data = await callAI(`テーマ「${theme}」の調べ学習ルートを6-8ステップで作ってください。`, ROUTE_SCHEMA, true, { task: "route", input: theme });
      setRoute(normalizeRouteResult(data));
    } catch (routeError) {
      setError(routeError?.message || "調べ学習ルートを作成できませんでした。");
    } finally {
      setRouteLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader icon={Search} eyebrow="// SEARCH MODE" title="調査を開始" desc="テーマを入力すると、複数の信頼できる情報源を探索し要約します" />
      <Panel title="調査テーマ入力" icon={Search}>
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="info">{settings.gradeLevel}</Badge>
          <Badge variant="accent">{settings.searchMode}</Badge>
          <Badge variant="info">{settings.summaryStyle}</Badge>
        </div>
        <textarea
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") runSearch();
          }}
          placeholder="調べたいテーマを入力...（例: 江戸幕府の成立, 光合成の仕組み, 地球温暖化の影響）"
          rows={3}
          className="pixel-input px-3 py-2.5 w-full resize-none text-sm"
        />
        <div className="flex justify-end mt-3">
          <button onClick={runSearch} disabled={!theme.trim() || loading} className="pixel-btn px-6 py-2.5 bg-primary text-primary-foreground text-xs">
            {loading ? "調査中..." : "▶ 調査を開始"}
          </button>
        </div>
      </Panel>
      {loading && <Panel variant="flat"><Loader text="情報源を探索中..." /></Panel>}
      {error && (
        <div className="pixel-panel-flat border-destructive bg-destructive/10 p-4 animate-slide-in" role="alert">
          <div className="flex items-center gap-2 text-destructive"><AlertTriangle size={16} /><span className="font-heading text-sm">{error}</span></div>
        </div>
      )}
      {saved && <div className="pixel-panel-flat bg-primary/10 border-primary p-3 text-center font-heading text-sm text-primary">{saved}</div>}
      {result && (
        <div className="space-y-4 animate-fade-in">
          <Panel title="調査結果: 要約" icon={FileText} action={<div className="flex items-center gap-2"><CopyButton text={result.summary} /><Badge variant={scoreVariant(result.reliability_score)}>{scoreText(result.reliability_score)}</Badge></div>}>
            <MarkdownText>{result.summary}</MarkdownText>
            {result.updated_info && <p className="text-xs text-muted-foreground mt-3">更新情報: {result.updated_info}</p>}
            <div className="pixel-panel-inset p-3 mt-4">
              <div className="font-heading text-xs text-accent mb-2">自動要約</div>
              <div className="flex flex-wrap gap-2">
                {["3行", "箇条書き", "発表用"].map((style) => (
                  <button key={style} className="pixel-btn px-3 py-1.5 bg-card text-xs" onClick={() => makeSummary(style)}>{style}</button>
                ))}
              </div>
              {summary && <div className="mt-3"><MarkdownText>{summary}</MarkdownText></div>}
            </div>
          </Panel>
          <Panel title="信頼性スコア" icon={ShieldCheck}>
            <ScoreBar label="信頼度スコア" score={result.reliability_score} />
            <ScoreBar label="資料間一致率" score={result.consistency_rate} />
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={saveNote} className="pixel-btn px-4 py-2 bg-primary text-primary-foreground text-xs inline-flex items-center gap-1.5"><Save size={13} /> 知識保管庫へ保存</button>
              <button onClick={saveReferences} className="pixel-btn px-4 py-2 bg-card text-accent text-xs inline-flex items-center gap-1.5"><BookOpen size={13} /> 出典として保存</button>
            </div>
          </Panel>
          <SourcesPanel sources={result.sources || []} />
          <ListPanel title="重要ポイント" icon={ListChecks} items={result.key_points || []} numbered />
          <ListPanel title="注意点" icon={AlertTriangle} items={result.cautions || []} warning />
          <PerspectivesPanel perspectives={result.perspectives || []} intro="このテーマには複数の見方があります。それぞれを比較して確認してください。" />
          <Panel title="関連キーワード" icon={LinkIcon}>
            <div className="flex flex-wrap gap-2">
              {(result.related_keywords || []).map((keyword) => (
                <button key={keyword} className="pixel-btn px-3 py-1.5 bg-card text-accent text-xs" onClick={() => { setTheme(keyword); window.scrollTo({ top: 0, behavior: "smooth" }); }}>#{keyword}</button>
              ))}
            </div>
          </Panel>
          <Panel title="調べ学習ルート提案" icon={RouteIcon} action={<button onClick={generateRoute} disabled={routeLoading} className="pixel-btn px-3 py-1.5 bg-card text-accent text-xs">{route ? "再生成" : "ルートを生成"}</button>}>
            {routeLoading && <Loader text="ルートを生成中..." />}
            {!routeLoading && !route && <p className="text-sm text-muted-foreground">このテーマを調べるための推奨順序を生成できます。</p>}
            {route && <div className="space-y-3">{route.steps.map((step) => <RouteStep key={step.step} step={step} />)}</div>}
          </Panel>
        </div>
      )}
    </div>
  );
}

function VerificationPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const run = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const data = await callAI(`以下の文章を信頼性・出典・偏り・矛盾の観点で検証してください。\n${text}`, VERIFY_SCHEMA, true, { task: "verify", input: text });
      setResult(normalizeVerificationResult(data));
    } catch (verifyError) {
      setError(verifyError?.message || "文章を検証できませんでした。");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader icon={ShieldCheck} eyebrow="// VERIFICATION MODE" title="検証結果" desc="文章を貼り付けて、信頼性を6つの基準でチェックします" />
      <Panel title="検証する文章" icon={FileText}>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="調べた文章や、気になる情報を貼り付けてください..." rows={6} className="pixel-input px-3 py-2.5 w-full resize-none text-sm" />
        <div className="flex justify-end mt-3">
          <button onClick={run} disabled={!text.trim() || loading} className="pixel-btn px-6 py-2.5 bg-primary text-primary-foreground text-xs">
            {loading ? "検証中..." : "▶ 検証する"}
          </button>
        </div>
      </Panel>
      {loading && <Panel variant="flat"><Loader text="照合中..." /></Panel>}
      <ErrorNotice message={error} />
      {result && (
        <div className="space-y-4 animate-fade-in">
          <Panel title="信頼性評価" icon={ShieldCheck} action={<Badge variant={result.reliability === "高い" ? "high" : result.reliability === "中程度" ? "medium" : "low"}>{result.reliability}</Badge>}>
            <div className="check-grid">
              <CheckRow label="出典がある" ok={result.sources_present} />
              <CheckRow label="複数資料で一致" ok={result.multi_source_consistency} />
              <CheckRow label="根拠が十分" ok={result.evidence_sufficient} />
              <CheckRow label="情報が古くない" ok={!result.is_outdated} />
              <CheckRow label="偏りが少ない" ok={!result.has_bias} />
              <CheckRow label="矛盾が少ない" ok={!result.has_contradictions} />
            </div>
            <ScoreBar label="一致率" score={result.consistency_rate} />
            <p className="font-heading text-xs text-muted-foreground mt-2">確認資料数: {result.confirmed_sources_count}</p>
          </Panel>
          <Panel title="評価の詳細" icon={FileText}><p className="text-sm leading-relaxed">{result.detail}</p></Panel>
          <ListPanel title="警告メッセージ" icon={AlertTriangle} items={result.warnings || []} warning />
          {result.additional_check_recommended && (
            <div className="pixel-panel-flat border-accent bg-accent/10 p-4">
              <div className="font-heading text-sm text-accent">⚠ 追加確認を推奨します</div>
              <p className="text-sm text-muted-foreground mt-1">より確実な情報にするため、追加の情報源で確認することをおすすめします。</p>
            </div>
          )}
          <PerspectivesPanel perspectives={result.perspectives || []} intro="この文章には偏りがある可能性があります。別の視点も確認してください。" />
        </div>
      )}
    </div>
  );
}

function AIResearcherPage() {
  const suggestions = ["この言葉の意味を教えて", "解き方が分からない問題がある", "歴史の出来事について質問したい", "理科の実験の原理を知りたい"];
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);
  const send = async (value = input) => {
    const question = value.trim();
    if (!question || loading) return;
    setInput("");
    setMessages((items) => [...items, { role: "user", content: question }]);
    setLoading(true);
    setError("");
    try {
      const answer = await callAI(`あなたは学生の理解を助けるAI研究員です。以下の質問に答えてください。\n${question}`, AI_SCHEMA, false, { task: "ai", input: question });
      setMessages((items) => [...items, { role: "assistant", content: normalizeResearcherResult(answer) }]);
    } catch (aiError) {
      setError(aiError?.message || "AI研究員から回答を取得できませんでした。");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="max-w-4xl mx-auto space-y-6 ai-page">
      <PageHeader icon={Bot} eyebrow="// AI RESEARCHER" title="AI研究員" desc="質問に答えるだけでなく、理解を深めるサポートをします" />
      <Panel title="何について調べますか？" icon={MessageSquare}>
        <div className="chat-window pixel-panel-inset" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="suggestions">
              {suggestions.map((item) => <button key={item} className="pixel-btn p-3 bg-card text-xs" onClick={() => send(item)}>{item}</button>)}
            </div>
          )}
          {messages.map((message, index) => message.role === "user" ? <UserMessage key={index} text={message.content} /> : <AssistantMessage key={index} data={message.content} />)}
          {loading && <Loader text="AI研究員が考えています..." />}
        </div>
        <div className="flex gap-2 mt-3">
          <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && send()} placeholder="質問を入力..." className="pixel-input px-3 py-2.5 w-full text-sm" />
          <button onClick={() => send()} disabled={!input.trim() || loading} className="pixel-btn px-4 py-2.5 bg-primary text-primary-foreground"><Send size={16} /></button>
        </div>
      </Panel>
      <ErrorNotice message={error} />
    </div>
  );
}

function SlidesPage() {
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [slides, setSlides] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [script, setScript] = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (!theme.trim()) return;
    setLoading(true);
    setSlides(null);
    setError("");
    try {
      const data = await callAI(`テーマ「${theme}」の発表用スライド構成を提案してください。`, SLIDE_SCHEMA, false, { task: "slides", input: theme });
      setSlides(normalizeSlidesResult(data));
      setQuestions(null);
      setScript("");
    } catch (slidesError) {
      setError(slidesError?.message || "スライド構成を作成できませんでした。");
    } finally {
      setLoading(false);
    }
  };
  const makeQuestions = async () => {
    setQuestionLoading(true);
    setError("");
    try {
      const data = await callAI(`スライド構成から想定質問を5つ作ってください。${JSON.stringify(slides)}`, QUESTIONS_SCHEMA, false, { task: "questions", input: theme });
      setQuestions(normalizeQuestionsResult(data));
    } catch (questionsError) {
      setError(questionsError?.message || "想定質問を作成できませんでした。");
    } finally {
      setQuestionLoading(false);
    }
  };
  const makeScript = async () => {
    setScriptLoading(true);
    setError("");
    try {
      const data = await callAI(`次のスライド構成をもとに5分想定の発表原稿を話し言葉で書いてください。${JSON.stringify(slides)}`, null, false, { task: "script", input: theme, result: slides });
      setScript(normalizeTextResult(data, "script"));
    } catch (scriptError) {
      setError(scriptError?.message || "発表原稿を作成できませんでした。");
    } finally {
      setScriptLoading(false);
    }
  };
  const saveRefs = async () => {
    setError("");
    try {
      if (!slides.references?.length) throw new Error("保存できる参考文献がありません。");
      await base44.entities.Reference.bulkCreate(slides.references.map((ref) => ({ title: ref.title, url: ref.url, source: "", reliability: "中程度", theme, notes: "" })));
      flash(setSaved, true);
    } catch (saveError) {
      setError(saveError?.message || "参考文献を保存できませんでした。");
    }
  };
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader icon={Presentation} eyebrow="// SLIDE BUILDER" title="発表資料作成" desc="テーマを入力すると、スライド構成を自動提案します" />
      <Panel title="テーマ入力" icon={Presentation}>
        <input value={theme} onChange={(event) => setTheme(event.target.value)} onKeyDown={(event) => event.key === "Enter" && generate()} placeholder="発表テーマを入力...（例: 江戸時代の身分制度, 地球温暖化と私たちの生活）" className="pixel-input px-3 py-2.5 w-full text-sm" />
        <div className="flex justify-end mt-3">
          <button onClick={generate} disabled={!theme.trim() || loading} className="pixel-btn px-6 py-2.5 bg-primary text-primary-foreground text-xs">{loading ? "生成中..." : "▶ スライド構成を生成"}</button>
        </div>
      </Panel>
      {loading && <Panel variant="flat"><Loader text="スライド構成を構築中..." /></Panel>}
      <ErrorNotice message={error} />
      {slides && (
        <div className="space-y-4 animate-fade-in">
          <Panel title={slides.title || "スライド構成"} icon={Presentation}>
            <p className="font-heading text-base text-primary mb-1">{slides.title}</p>
            <p className="text-xs text-muted-foreground">{slides.slides.length}枚のスライド</p>
          </Panel>
          {slides.slides.map((slide, index) => (
            <Panel key={index} title={`スライド ${slide.slide_number || index + 1}: ${slide.heading}`} icon={FileText}>
              <span className="font-heading text-xs text-accent">内容:</span>
              <p className="text-sm leading-relaxed mt-1 whitespace-pre-wrap">{slide.content}</p>
              {slide.speaker_notes && (
                <div className="pixel-panel-inset p-2.5 mt-3">
                  <span className="font-heading text-xs text-primary">発表メモ:</span>
                  <p className="text-xs leading-relaxed mt-1 text-foreground/80 whitespace-pre-wrap">{slide.speaker_notes}</p>
                </div>
              )}
            </Panel>
          ))}
          <Panel title="内容量の調整提案" icon={RefreshCw}>
            <div className="space-y-3">
              <div className="pixel-panel-inset p-3"><span className="font-heading text-xs text-destructive block mb-1">▼ 削る提案</span><p className="text-sm">{slides.suggestions.too_much}</p></div>
              <div className="pixel-panel-inset p-3"><span className="font-heading text-xs text-accent block mb-1">▲ 補う提案</span><p className="text-sm">{slides.suggestions.too_little}</p></div>
            </div>
          </Panel>
          <Panel title="参考文献" icon={BookOpen} action={<button onClick={saveRefs} className="pixel-btn px-3 py-1.5 bg-card text-accent text-xs inline-flex items-center gap-1"><Save size={12} /> 出典に保存</button>}>
            <div className="space-y-2">{slides.references.map((ref, index) => <ReferenceLine key={index} refItem={ref} />)}</div>
            {saved && <p className="text-xs text-primary mt-2 animate-fade-in">★ 出典一覧に保存しました</p>}
          </Panel>
          <Panel title="想定質問" icon={MessageSquare} action={<button onClick={makeQuestions} disabled={questionLoading} className="pixel-btn px-3 py-1.5 bg-card text-accent text-xs">{questions ? "再生成" : "質問を生成"}</button>}>
            {questionLoading && <Loader text="質問を予測中..." />}
            {!questionLoading && !questions && <p className="text-sm text-muted-foreground">発表で聞かれそうな質問を予測できます。</p>}
            {questions && <div className="space-y-2">{questions.questions.map((q, index) => <QuestionItem key={index} q={q} index={index} />)}</div>}
          </Panel>
          <Panel title="発表原稿" icon={FileText} action={<button onClick={makeScript} disabled={scriptLoading} className="pixel-btn px-3 py-1.5 bg-card text-accent text-xs">{script ? "再生成" : "原稿を生成"}</button>}>
            {scriptLoading && <Loader text="原稿を執筆中..." />}
            {!scriptLoading && !script && <p className="text-sm text-muted-foreground">スライドに基づく発表原稿を自動生成できます。</p>}
            {script && <div className="pixel-panel-inset p-3"><p className="text-sm leading-relaxed whitespace-pre-wrap">{script}</p></div>}
          </Panel>
        </div>
      )}
    </div>
  );
}

function AuditPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const run = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const data = await callAI(`以下のスライド文章を提出前にチェックしてください。\n${text}`, AUDIT_SCHEMA, true, { task: "audit", input: text });
      setResult(normalizeAuditResult(data));
    } catch (auditError) {
      setError(auditError?.message || "発表内容をチェックできませんでした。");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader icon={ClipboardCheck} eyebrow="// PRE-SUBMISSION AUDIT" title="発表前チェック" desc="スライドの文章を提出前に監査し、問題を指摘します" />
      <Panel title="チェックする文章" icon={ClipboardCheck}>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="スライドの文章を貼り付けてください..." rows={8} className="pixel-input px-3 py-2.5 w-full resize-none text-sm" />
        <div className="flex justify-end mt-3">
          <button onClick={run} disabled={!text.trim() || loading} className="pixel-btn px-6 py-2.5 bg-primary text-primary-foreground text-xs">{loading ? "監査中..." : "▶ チェックを実行"}</button>
        </div>
      </Panel>
      {loading && <Panel variant="flat"><Loader text="監査を実行中..." /></Panel>}
      <ErrorNotice message={error} />
      {result && (
        <div className="space-y-4 animate-fade-in">
          <Panel title="監査結果" icon={ClipboardCheck} action={<Badge variant={result.presentation_ready ? "high" : "low"}>{result.presentation_ready ? "発表OK" : "要修正"}</Badge>}>
            <ScoreBar label="総合スコア" score={result.overall_score} />
            <div className={`pixel-panel-inset p-3 mt-4 ${result.presentation_ready ? "border-primary/50" : "border-destructive/50"}`}>
              <div className={`font-heading text-sm ${result.presentation_ready ? "text-primary" : "text-destructive"}`}>{result.presentation_ready ? "発表可能です" : "修正が必要です"}</div>
              <p className="text-sm text-foreground/90 leading-relaxed mt-1">{result.summary}</p>
            </div>
          </Panel>
          {result.issues.length > 0 ? (
            <Panel title={`指摘事項 (${result.issues.length}件)`} icon={AlertTriangle}>
              <div className="space-y-2">{result.issues.map((issue, index) => <IssueItem key={index} issue={issue} />)}</div>
            </Panel>
          ) : (
            <Panel variant="flat"><div className="flex items-center gap-2 justify-center py-4"><CheckCircle2 size={20} className="text-primary" /><span className="font-heading text-sm text-primary">問題は見つかりませんでした</span></div></Panel>
          )}
        </div>
      )}
    </div>
  );
}

function NotesPage() {
  const emptyNote = { title: "", theme: "", summary: "", key_points: "", keywords: "", reference_urls: "", memo: "", category: "その他" };
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("全て");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyNote);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setNotes(await base44.entities.Note.list("-updated_date", 200));
    } catch (loadError) {
      setError(loadError?.message || "ノートを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  const openNew = () => { setForm(emptyNote); setEditing("new"); };
  const openEdit = (note) => {
    setForm({
      title: note.title || "",
      theme: note.theme || "",
      summary: note.summary || "",
      key_points: (note.key_points || []).join("\n"),
      keywords: (note.keywords || []).join("\n"),
      reference_urls: (note.reference_urls || []).join("\n"),
      memo: note.memo || "",
      category: note.category || "その他"
    });
    setEditing(note.id);
  };
  const save = async () => {
    const payload = { ...form, key_points: lines(form.key_points), keywords: lines(form.keywords), reference_urls: lines(form.reference_urls) };
    setError("");
    try {
      if (editing === "new") await base44.entities.Note.create(payload);
      else await base44.entities.Note.update(editing, payload);
      setEditing(null);
      await load();
    } catch (saveError) {
      setError(saveError?.message || "ノートを保存できませんでした。");
    }
  };
  const remove = async (id) => {
    if (!confirm("このノートを削除しますか？")) return;
    setError("");
    try {
      await base44.entities.Note.delete(id);
      await load();
    } catch (deleteError) {
      setError(deleteError?.message || "ノートを削除できませんでした。");
    }
  };
  const shown = filter === "全て" ? notes : notes.filter((note) => note.category === filter);
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader icon={Library} eyebrow="// KNOWLEDGE VAULT" title="知識保管庫" desc="調べた内容を保存し、自分専用の知識庫として使えます" action={<button onClick={openNew} className="pixel-btn px-4 py-2.5 bg-primary text-primary-foreground text-xs inline-flex items-center gap-1.5"><Plus size={14} /> 新規ノート</button>} />
      <FilterBar items={categories} value={filter} onChange={setFilter} />
      <ErrorNotice message={error} />
      {loading && <Loader text="ノートを読み込み中..." />}
      {!loading && shown.length === 0 && <Panel variant="flat"><p className="text-center text-sm text-muted-foreground py-8">ノートがありません。「新規ノート」から作成できます。</p></Panel>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shown.map((note) => (
          <div key={note.id} className="pixel-panel p-4 animate-slide-in flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-heading text-sm text-foreground flex-1">{note.title}</h3>
              <Badge variant={note.category === "その他" ? "info" : "accent"}>{note.category}</Badge>
            </div>
            {note.summary && <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-3">{note.summary}</p>}
            <div className="flex flex-wrap gap-1 mb-3">{(note.keywords || []).slice(0, 4).map((kw) => <span key={kw} className="text-xs text-accent">#{kw}</span>)}</div>
            <div className="flex gap-2 mt-auto pt-2 border-t-2 border-border">
              <button onClick={() => openEdit(note)} className="pixel-btn px-3 py-1.5 bg-card text-xs inline-flex items-center gap-1"><Edit3 size={12} /> 編集</button>
              <button onClick={() => remove(note.id)} className="pixel-btn px-3 py-1.5 bg-card text-xs text-destructive inline-flex items-center gap-1"><Trash2 size={12} /> 削除</button>
            </div>
          </div>
        ))}
      </div>
      {editing && <NoteModal form={form} setForm={setForm} onClose={() => setEditing(null)} onSave={save} isNew={editing === "new"} error={error} />}
    </div>
  );
}

function ReferencesPage() {
  const emptyRef = { title: "", url: "", source: "", reliability: "中程度", theme: "", notes: "" };
  const [refs, setRefs] = useState([]);
  const [filter, setFilter] = useState("全て");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyRef);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    try {
      setRefs(await base44.entities.Reference.list("-updated_date", 200));
    } catch (loadError) {
      setError(loadError?.message || "出典を読み込めませんでした。");
    }
  };
  useEffect(() => { load(); }, []);
  const openNew = () => { setForm(emptyRef); setEditing("new"); };
  const openEdit = (ref) => { setForm({ ...emptyRef, ...ref }); setEditing(ref.id); };
  const save = async () => {
    setError("");
    const normalizedUrl = form.url.trim() ? safeHttpUrl(form.url) : "";
    if (form.url.trim() && !normalizedUrl) {
      setError("URLは http:// または https:// で始まる正しい形式で入力してください。");
      return;
    }
    try {
      const payload = { ...form, url: normalizedUrl };
      if (editing === "new") await base44.entities.Reference.create(payload);
      else await base44.entities.Reference.update(editing, payload);
      setEditing(null);
      await load();
    } catch (saveError) {
      setError(saveError?.message || "出典を保存できませんでした。");
    }
  };
  const remove = async (id) => {
    if (!confirm("この出典を削除しますか？")) return;
    setError("");
    try {
      await base44.entities.Reference.delete(id);
      await load();
    } catch (deleteError) {
      setError(deleteError?.message || "出典を削除できませんでした。");
    }
  };
  const copyList = async () => {
    const text = refs.map((ref) => [ref.title, ref.source, ref.url].filter(Boolean).join(" / ") + (ref.reliability ? ` [信頼度: ${ref.reliability}]` : "")).join("\n");
    setError("");
    try {
      await navigator.clipboard.writeText(text);
      flash(setCopied, true);
    } catch {
      setError("クリップボードへコピーできませんでした。ブラウザの権限を確認してください。");
    }
  };
  const shown = filter === "全て" ? refs : refs.filter((ref) => ref.reliability === filter);
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader icon={BookOpen} eyebrow="// SOURCE MANAGER" title="出典一覧" desc="使った情報源を整理し、参考文献の作成を助けます" action={<div className="flex flex-wrap gap-2"><button onClick={copyList} className="pixel-btn px-4 py-2.5 bg-card text-accent text-xs inline-flex items-center gap-1"><Copy size={14} /> リストをコピー</button><button onClick={openNew} className="pixel-btn px-4 py-2.5 bg-primary text-primary-foreground text-xs inline-flex items-center gap-1"><Plus size={14} /> 出典を追加</button></div>} />
      {copied && <div className="pixel-panel-flat bg-primary/10 border-primary p-3 text-center font-heading text-sm text-primary">★ リストをコピーしました</div>}
      <ErrorNotice message={error} />
      <FilterBar items={reliabilityFilters} value={filter} onChange={setFilter} />
      {shown.length === 0 && <Panel variant="flat"><p className="text-center text-sm text-muted-foreground py-8">出典がありません。「出典を追加」から登録できます。</p></Panel>}
      <div className="space-y-3">
        {shown.map((ref) => (
          <div key={ref.id} className="pixel-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant={ref.reliability === "高い" ? "high" : ref.reliability === "中程度" ? "medium" : "low"}>{ref.reliability}</Badge>
                {ref.theme && <span className="text-xs text-muted-foreground ml-2">{ref.theme}</span>}
                <h3 className="font-heading text-sm text-foreground mt-2">{ref.title}</h3>
                {ref.source && <p className="text-xs text-muted-foreground mt-1">出典元: {ref.source}</p>}
                <ExternalLink url={ref.url} />
                {ref.notes && <p className="text-xs text-muted-foreground mt-2">{ref.notes}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(ref)} className="pixel-btn p-2 bg-card text-muted-foreground" aria-label="編集"><Edit3 size={13} /></button>
                <button onClick={() => remove(ref.id)} className="pixel-btn p-2 bg-card text-destructive" aria-label="削除"><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && <ReferenceModal form={form} setForm={setForm} onClose={() => setEditing(null)} onSave={save} isNew={editing === "new"} error={error} />}
    </div>
  );
}

function SettingsPage() {
  const [settings, setSettings] = useState(getSettings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const update = (key, value) => {
    const next = { ...settings, [key]: value };
    setError("");
    try {
      saveSettings(next);
      setSettings(next);
      flash(setSaved, true);
    } catch (saveError) {
      setError(saveError?.message || "設定を保存できませんでした。");
    }
  };
  const resetTutorial = () => {
    clearTutorial();
    setTimeout(() => window.location.reload(), 500);
  };
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title="設 定" desc="学習環境をカスタマイズ" />
      <SettingGroup title="学年レベル" icon={GraduationCap} desc="説明の深さを学年に合わせて調整します" options={["小学", "中学", "高校"]} value={settings.gradeLevel} onChange={(value) => update("gradeLevel", value)} />
      <SettingGroup title="検索モード" icon={Search} desc="科目に応じた検索の最適化" options={["一般", "歴史", "理科", "社会", "国語"]} value={settings.searchMode} onChange={(value) => update("searchMode", value)} />
      <SettingGroup title="要約スタイル" icon={FileText} desc="自動要約のデフォルト形式" options={["3行", "箇条書き", "発表用"]} value={settings.summaryStyle} onChange={(value) => update("summaryStyle", value)} />
      <ErrorNotice message={error} />
      {saved && <div className="pixel-panel-flat bg-primary/10 border-primary p-3 text-center animate-fade-in"><span className="font-heading text-sm text-primary">★ 設定を保存しました</span></div>}
      <Panel title="チュートリアル" icon={Sparkles}>
        <p className="text-sm text-muted-foreground mb-4">アプリの使い方をもう一度見たい場合は、チュートリアルを再表示できます。</p>
        <button onClick={resetTutorial} className="pixel-btn px-4 py-2 bg-accent text-accent-foreground text-xs inline-flex items-center gap-1.5"><Sparkles size={13} /> チュートリアルを再表示</button>
      </Panel>
      <Panel title="このアプリについて" icon={ShieldCheck}>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><span className="text-primary font-heading">StudyShield</span> は、調べ学習の品質を上げるための学習支援アプリです。</p>
          <p>情報の信頼性を見極め、誤情報を減らし、安心して調べ・まとめ・発表できることを目指します。</p>
          <p>ローカル復元版では、ノートや出典がブラウザのlocalStorageに保存されます。</p>
          <p className="text-xs text-muted-foreground/70 pt-2 border-t-2 border-border mt-3">※ AIが生成する情報も完全ではありません。常に複数の信頼できる情報源で確認してください。</p>
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, icon: Icon, action, variant, children }) {
  return (
    <section className={`${variant === "flat" ? "pixel-panel-flat" : "pixel-panel"} p-4`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title && <div className="flex items-center gap-2">{Icon && <Icon size={16} className="text-primary" />}<h2 className="font-heading text-sm text-primary">{title}</h2></div>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function PageHeader({ icon: Icon, eyebrow, title, desc, action }) {
  return (
    <header className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        {eyebrow && <div className="flex items-center gap-2 mb-1">{Icon && <Icon size={18} className="text-primary" />}<span className="font-display text-[0.6rem] text-muted-foreground">{eyebrow}</span></div>}
        <h1 className="font-heading text-2xl text-primary text-glow-sm">{title}</h1>
        {desc && <p className="font-heading text-sm text-muted-foreground mt-1">{desc}</p>}
      </div>
      {action}
    </header>
  );
}

function Badge({ variant = "info", children }) {
  return <span className={`pixel-badge badge-${variant}`}>{children}</span>;
}

function ScoreBar({ label, score }) {
  const validScore = typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100;
  return (
    <div className="scorebar">
      <div className="flex justify-between font-heading text-xs mb-1"><span>{label}</span><span>{validScore ? `${Math.round(score)}%` : "未取得"}</span></div>
      <div className="scorebar-track"><span className={`scorebar-fill ${validScore ? scoreVariant(score) : "missing"}`} style={{ width: validScore ? `${score}%` : "0%" }} /></div>
    </div>
  );
}

function Loader({ text }) {
  return <div className="flex items-center gap-2 text-muted-foreground text-sm"><RefreshCw size={15} className="animate-spin text-primary" /><span>{text}</span></div>;
}

function ErrorNotice({ message }) {
  if (!message) return null;
  return (
    <div className="pixel-panel-flat border-destructive bg-destructive/10 p-4 animate-slide-in" role="alert">
      <div className="flex items-center gap-2 text-destructive"><AlertTriangle size={16} /><span className="font-heading text-sm">{message}</span></div>
    </div>
  );
}

function ExternalLink({ url, className = "text-xs text-primary hover:underline break-words" }) {
  const safeUrl = safeHttpUrl(url);
  if (!safeUrl) return null;
  return <a className={className} href={safeUrl} target="_blank" rel="noreferrer">↗ {safeUrl}</a>;
}

function SourcesPanel({ sources }) {
  return (
    <Panel title="出典一覧" icon={BookOpen}>
      <div className="space-y-2">
        {sources.map((source, index) => (
          <div key={index} className="pixel-panel-inset p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-heading text-sm text-foreground">{source.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{source.publisher} / {source.date}</p>
                <ExternalLink url={source.url} />
              </div>
              <Badge variant={source.reliability === "高い" ? "high" : source.reliability === "中程度" ? "medium" : "low"}>{source.reliability}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ListPanel({ title, icon, items, numbered, warning }) {
  if (!items?.length) return null;
  return (
    <Panel title={title} icon={icon}>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className={`pixel-panel-inset p-3 ${warning ? "border-accent/50" : ""}`}>
            <div className="flex gap-3">{numbered && <span className="font-display text-xs text-accent">{String(index + 1).padStart(2, "0")}</span>}<p className="text-sm leading-relaxed">{item}</p></div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PerspectivesPanel({ perspectives, intro }) {
  if (!perspectives?.length) return null;
  return (
    <Panel title="情報の偏りチェック: 複数の視点" icon={AlertTriangle}>
      <p className="text-sm text-muted-foreground mb-3">{intro}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {perspectives.map((perspective, index) => (
          <div key={index} className="pixel-panel-inset p-3">
            <div className="font-heading text-xs text-accent mb-1">視点{index + 1}: {perspective.view}</div>
            <p className="text-sm text-foreground/90 leading-relaxed">{perspective.summary}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RouteStep({ step }) {
  return (
    <div className="pixel-panel-inset p-3">
      <div className="flex gap-3">
        <span className="font-display text-xs text-primary">{step.step}</span>
        <div>
          <h3 className="font-heading text-sm text-foreground">{step.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
          <div className="flex flex-wrap gap-1 mt-2">{step.keywords.map((kw) => <span key={kw} className="text-xs text-accent">#{kw}</span>)}</div>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ label, ok }) {
  return <div className="pixel-panel-inset p-2.5 flex items-center gap-2">{ok ? <CheckCircle2 size={15} className="text-primary" /> : <X size={15} className="text-destructive" />}<span className="font-heading text-xs">{label}</span></div>;
}

function AssistantMessage({ data }) {
  const rows = [
    ["答え", data.answer, "text-primary", CheckCircle2],
    ["解き方・考え方", data.method, "text-accent", Lightbulb],
    ["なぜそうなるか", data.reasoning, "text-primary", BookOpen],
    ["よくある間違い", data.common_mistakes, "text-destructive", AlertTriangle],
    ["似た問題・応用", data.similar_problems, "text-accent", Sparkles]
  ];
  const copyText = rows.filter(([, body]) => body).map(([title, body]) => `${title}\n${body}`).join("\n\n");
  return (
    <div className="message assistant">
      <Bot size={18} className="text-primary shrink-0" />
      <div className="space-y-2 flex-1">
        <div className="flex justify-end"><CopyButton text={copyText} /></div>
        {rows.map(([title, body, color, Icon]) => body && (
          <div key={title} className="pixel-panel-inset p-3">
            <div className={`flex items-center gap-1.5 mb-1.5 ${color}`}><Icon size={13} /><span className="font-heading text-xs">{title}</span></div>
            <MarkdownText>{body}</MarkdownText>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserMessage({ text }) {
  return <div className="message user"><div className="pixel-panel-flat p-3 bg-primary/10"><p className="text-sm whitespace-pre-wrap">{text}</p></div></div>;
}

function MarkdownText({ children }) {
  return (
    <div className="markdown-content text-sm text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          input: ({ node, ...props }) => <input {...props} disabled />
        }}
      >
        {String(children || "")}
      </ReactMarkdown>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      setFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      setFailed(true);
      window.setTimeout(() => setFailed(false), 2000);
    }
  };
  return (
    <button type="button" onClick={copy} className="pixel-btn copy-button bg-card text-accent" title="回答をコピー" aria-label="回答をコピー">
      {copied ? <CheckCircle2 size={14} /> : failed ? <AlertTriangle size={14} /> : <Copy size={14} />}
      <span>{copied ? "コピー済み" : failed ? "コピー失敗" : "コピー"}</span>
    </button>
  );
}

function ReferenceLine({ refItem }) {
  return <div className="pixel-panel-inset p-2.5"><p className="text-sm">{refItem.title}</p><ExternalLink url={refItem.url} className="text-xs text-primary hover:underline" /></div>;
}

function QuestionItem({ q, index }) {
  return <div className="pixel-panel-inset p-3"><div className="flex gap-2"><span className="font-display text-xs text-accent shrink-0">Q{index + 1}</span><div><p className="font-heading text-sm text-foreground">{q.question}</p><p className="text-xs text-muted-foreground mt-1 leading-relaxed">→ {q.answer_point}</p></div></div></div>;
}

function IssueItem({ issue }) {
  const variant = issue.severity === "高" ? "low" : issue.severity === "中" ? "medium" : "high";
  return (
    <div className="pixel-panel-inset p-3">
      <div className="flex items-start justify-between gap-2 mb-1.5"><span className="font-heading text-sm text-foreground">{issue.type}</span><Badge variant={variant}>{issue.severity}</Badge></div>
      <p className="text-sm text-foreground/90 mb-1.5">{issue.description}</p>
      {issue.suggestion && <div className="flex gap-1.5 mt-2 pt-2 border-t-2 border-border"><span className="text-xs text-accent shrink-0">改善案:</span><span className="text-xs text-muted-foreground">{issue.suggestion}</span></div>}
    </div>
  );
}

function FilterBar({ items, value, onChange }) {
  return <div className="flex gap-2 flex-wrap">{items.map((item) => <button key={item} onClick={() => onChange(item)} className={`pixel-btn px-3 py-1.5 text-xs ${value === item ? "bg-primary text-primary-foreground" : "bg-card"}`}>{item}</button>)}</div>;
}

function SettingGroup({ title, icon, desc, options, value, onChange }) {
  return (
    <Panel title={title} icon={icon}>
      <p className="text-sm text-muted-foreground mb-4">{desc}</p>
      <div className="flex flex-wrap gap-2">{options.map((option) => <button key={option} onClick={() => onChange(option)} className={`pixel-btn px-4 py-2 text-xs ${value === option ? "bg-primary text-primary-foreground" : "bg-card"}`}>{option}</button>)}</div>
    </Panel>
  );
}

function NoteModal({ form, setForm, onClose, onSave, isNew, error }) {
  return (
    <Modal title={isNew ? "新規ノート作成" : "ノート編集"} onClose={onClose} onSave={onSave} disabled={!form.title.trim()}>
      <ErrorNotice message={error} />
      <Field label="タイトル *" value={form.title} onChange={(title) => setForm({ ...form, title })} placeholder="ノートのタイトル" />
      <div className="form-grid">
        <Field label="テーマ" value={form.theme} onChange={(theme) => setForm({ ...form, theme })} placeholder="調べたテーマ" />
        <label><span className="font-heading text-xs text-muted-foreground block mb-1">カテゴリ</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="pixel-input px-3 py-2 w-full text-sm">{categories.slice(1).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
      <Field textarea rows={4} label="要約" value={form.summary} onChange={(summary) => setForm({ ...form, summary })} placeholder="内容の要約" />
      <Field textarea rows={4} label="重要ポイント（1行1項目）" value={form.key_points} onChange={(key_points) => setForm({ ...form, key_points })} placeholder="重要なポイントを入力" />
      <Field textarea rows={3} label="キーワード（1行1語）" value={form.keywords} onChange={(keywords) => setForm({ ...form, keywords })} placeholder="キーワードを入力" />
      <Field textarea rows={3} label="参考URL（1行1URL）" value={form.reference_urls} onChange={(reference_urls) => setForm({ ...form, reference_urls })} placeholder="https://..." />
      <Field textarea rows={3} label="メモ" value={form.memo} onChange={(memo) => setForm({ ...form, memo })} placeholder="自由なメモ" />
    </Modal>
  );
}

function ReferenceModal({ form, setForm, onClose, onSave, isNew, error }) {
  const invalidUrl = Boolean(form.url.trim() && !safeHttpUrl(form.url));
  return (
    <Modal title={isNew ? "出典を追加" : "出典を編集"} onClose={onClose} onSave={onSave} disabled={!form.title.trim() || invalidUrl}>
      <ErrorNotice message={error} />
      <Field label="資料名 *" value={form.title} onChange={(title) => setForm({ ...form, title })} placeholder="資料のタイトル" />
      <Field label="URL" value={form.url} onChange={(url) => setForm({ ...form, url })} placeholder="https://..." />
      {invalidUrl && <p className="text-xs text-destructive">URLは http:// または https:// で始まる正しい形式で入力してください。</p>}
      <Field label="出典元" value={form.source} onChange={(source) => setForm({ ...form, source })} placeholder="出版社、サイト名など" />
      <label><span className="font-heading text-xs text-muted-foreground block mb-1">信頼度</span><select value={form.reliability} onChange={(event) => setForm({ ...form, reliability: event.target.value })} className="pixel-input px-3 py-2 w-full text-sm">{["高い", "中程度", "低い"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <Field label="関連テーマ" value={form.theme} onChange={(theme) => setForm({ ...form, theme })} placeholder="関連するテーマ" />
      <Field textarea rows={2} label="メモ" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} placeholder="自由なメモ" />
    </Modal>
  );
}

function Modal({ title, children, onClose, onSave, disabled }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="pixel-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-border sticky top-0 bg-card z-10">
          <h3 className="font-heading text-sm text-primary">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t-2 border-border sticky bottom-0 bg-card">
          <button onClick={onClose} className="pixel-btn px-4 py-2 bg-card text-xs">キャンセル</button>
          <button onClick={onSave} disabled={disabled} className="pixel-btn px-4 py-2 bg-primary text-primary-foreground text-xs">保存</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, textarea, rows = 1 }) {
  const Tag = textarea ? "textarea" : "input";
  return <label><span className="font-heading text-xs text-muted-foreground block mb-1">{label}</span><Tag value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className="pixel-input px-3 py-2 w-full text-sm resize-none" placeholder={placeholder} /></label>;
}

function NotFound() {
  return <div className="scanlines crt-vignette min-h-screen flex items-center justify-center"><div className="pixel-panel p-6 text-center"><div className="font-display text-primary text-glow">404</div><p className="font-heading text-sm text-muted-foreground mt-3">Page Not Found</p><Link to="/" className="pixel-btn inline-flex px-4 py-2 bg-primary text-primary-foreground text-xs mt-4">拠点</Link></div></div>;
}

function scoreVariant(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "info";
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function scoreText(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "未取得";
  if (score >= 75) return "高い";
  if (score >= 45) return "中程度";
  return "低い";
}

function lines(value) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function flash(setter, value) {
  setter(value);
  setTimeout(() => setter(typeof value === "boolean" ? false : ""), 1800);
}

createRoot(document.getElementById("root")).render(<App />);
