// 파일 위치: app/admin/scrapers/page.tsx
// 용도: 외부 콘텐츠 수집(스크래핑) 관리 페이지
// 기능: URL 입력 → 테스트 크롤링 → 제목/본문 미리보기 → 페르소나 연결
// VIP 가드: layout.tsx에서 통합 처리 (이 파일에서는 불필요)
// 브랜드: 다크 테마 + 형광 그린 #73e346

"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import {
  Loader2,
  Globe,
  Search,
  ExternalLink,
  FileText,
  Bot,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Copy,
  RotateCcw,
  Upload,
  PenLine,
  Drama,
} from "lucide-react";
import { useImpersonation } from "@/app/context/ImpersonationContext";

// ─── 페르소나 타입 (선택용 간소화 버전) ───
type PersonaSummary = {
  id: string;
  nickname: string;
  industry: string;
  personality: string;
  avatar_url: string | null;
  target_site_url: string | null; // 전담 사이트 URL
};

// ─── 스크래핑 결과 타입 ───
type ScrapeResult = {
  title: string;           // 긁어온 제목
  body: string;            // 긁어온 본문
  source_url: string;      // 원본 URL
  scraped_at: string;      // 수집 시각
};

// ─── 리라이팅 결과 타입 (AI 변환 후) ───
type RewriteResult = {
  rewritten_title: string;
  rewritten_body: string;
  persona_nickname: string;
  original_title: string;
};

export default function ScrapersPage() {
  // ─── 빙의(Impersonation) 전역 상태 ───
  const { impersonating, isImpersonating } = useImpersonation();

  // ─── 상태 관리 ───
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // URL 입력 & 스크래핑 관련
  const [targetUrl, setTargetUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // 페르소나 선택 & 리라이팅 관련
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [rewriting, setRewriting] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);

  // ─── 페르소나 목록 가져오기 ───
  const fetchPersonas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("personas")
      .select("id, nickname, industry, personality, avatar_url, target_site_url")
      .eq("is_active", true)
      .order("nickname");

    if (!error && data) {
      setPersonas(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  // ─── 테스트 스크래핑 실행 ───
  // TODO: 실제 구현 시 서버 API (/api/scrape) 를 호출해야 함
  // 현재는 UI 뼈대만 — 더미 데이터로 동작 확인
  const handleTestScrape = async () => {
    // URL 유효성 검사
    if (!targetUrl.trim()) {
      setScrapeError("URL을 입력해 주세요.");
      return;
    }

    // URL 형식 간단 체크
    try {
      new URL(targetUrl);
    } catch {
      setScrapeError("올바른 URL 형식이 아닙니다. (예: https://gall.dcinside.com/...)");
      return;
    }

    setScraping(true);
    setScrapeError(null);
    setScrapeResult(null);
    setRewriteResult(null);

    try {
      // ──────────────────────────────────────────────
      // TODO: 실제 API 호출로 교체
      // const res = await fetch("/api/scrape", {
      //   method: "POST",
      //   body: JSON.stringify({ url: targetUrl }),
      // });
      // const data = await res.json();
      // ──────────────────────────────────────────────

      // 더미 응답 (UI 테스트용)
      await new Promise((r) => setTimeout(r, 1500)); // 로딩 시뮬레이션
      setScrapeResult({
        title: "[테스트] 외부 게시글 제목 — 스크래핑 테스트",
        body: "이것은 외부 커뮤니티에서 가져온 게시글 본문입니다.\n\n실제 구현 시 서버 사이드 API를 통해 HTML을 파싱하고 제목/본문을 추출합니다.\n\n현재는 UI 뼈대 테스트를 위한 더미 데이터입니다.",
        source_url: targetUrl,
        scraped_at: new Date().toISOString(),
      });
    } catch (err) {
      setScrapeError("스크래핑에 실패했습니다. URL을 확인하거나 나중에 다시 시도해 주세요.");
    } finally {
      setScraping(false);
    }
  };

  // ─── AI 리라이팅 시뮬레이션 ───
  // TODO: 실제 구현 시 서버 API (/api/rewrite) 를 호출
  const handleRewrite = async () => {
    if (!scrapeResult || !selectedPersonaId) return;

    const persona = personas.find((p) => p.id === selectedPersonaId);
    if (!persona) return;

    setRewriting(true);
    setRewriteResult(null);

    try {
      // ──────────────────────────────────────────────
      // TODO: 실제 API 호출로 교체
      // const res = await fetch("/api/rewrite", {
      //   method: "POST",
      //   body: JSON.stringify({
      //     original_title: scrapeResult.title,
      //     original_body: scrapeResult.body,
      //     persona_id: selectedPersonaId,
      //   }),
      // });
      // ──────────────────────────────────────────────

      // 더미 응답 (UI 테스트용)
      await new Promise((r) => setTimeout(r, 2000));
      setRewriteResult({
        rewritten_title: `[${persona.nickname} 스타일] ${scrapeResult.title}`,
        rewritten_body: `[${persona.personality} 톤으로 리라이팅된 본문]\n\n"${scrapeResult.body.substring(0, 50)}..."\n\n위 원문을 ${persona.nickname}(${persona.industry}) 캐릭터가 자기 말투로 재작성한 결과입니다.\n\n실제 구현 시 OpenAI/Claude API를 통해 페르소나 prompt + 원문을 결합하여 자연스러운 리라이팅이 수행됩니다.`,
        persona_nickname: persona.nickname,
        original_title: scrapeResult.title,
      });
    } catch {
      // 에러 처리
    } finally {
      setRewriting(false);
    }
  };

  // ─── 전체 초기화 ───
  const handleReset = () => {
    setTargetUrl("");
    setScrapeResult(null);
    setScrapeError(null);
    setRewriteResult(null);
    setSelectedPersonaId("");
  };

  // ─── 로딩 상태 ───
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════ */}
      {/* 페이지 헤더                                 */}
      {/* ═══════════════════════════════════════════ */}
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Globe className="h-5 w-5 text-primary" />
          외부 콘텐츠 수집
        </h2>
        <p className="mt-1 text-sm text-muted">
          외부 커뮤니티(개드립, 뽐뿌, 디시 등)의 글을 가져와서 NPC 페르소나가 리라이팅합니다.
        </p>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* STEP 1: URL 입력 & 테스트 스크래핑           */}
      {/* ═══════════════════════════════════════════ */}
      <section className="rounded-lg border border-border-color bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            1
          </span>
          URL 입력 — 테스트 크롤링
        </h3>

        {/* URL 입력 필드 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://gall.dcinside.com/board/view/?id=..."
              className="w-full rounded-lg border border-border-color bg-surface pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => e.key === "Enter" && handleTestScrape()}
            />
          </div>

          <button
            onClick={handleTestScrape}
            disabled={scraping}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {scraping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {scraping ? "수집 중..." : "테스트 수집"}
          </button>

          {/* 초기화 버튼 */}
          {(scrapeResult || scrapeError) && (
            <button
              onClick={handleReset}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border-color px-3 py-2.5 text-sm text-muted transition-colors hover:text-foreground"
              title="전체 초기화"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 에러 메시지 */}
        {scrapeError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {scrapeError}
          </div>
        )}

        {/* 빠른 URL 프리셋 */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-muted">빠른 선택:</span>
          {[
            { label: "개드립 자유", url: "https://www.dogdrip.net/free" },
            { label: "뽐뿌 자유", url: "https://www.ppomppu.co.kr/zboard/zboard.php?id=freeboard" },
            { label: "보배드림 자유", url: "https://www.bobaedream.co.kr/list?code=freeb" },
          ].map((preset) => (
            <button
              key={preset.url}
              onClick={() => setTargetUrl(preset.url)}
              className="rounded-md border border-border-color px-2.5 py-1 text-xs text-muted transition-colors hover:border-primary hover:text-primary"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════ */}
      {/* STEP 2: 스크래핑 결과 미리보기               */}
      {/* ═══════════════════════════════════════════ */}
      {scrapeResult && (
        <section className="rounded-lg border border-border-color bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
              2
            </span>
            수집 결과 미리보기
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          </h3>

          {/* 원문 정보 */}
          <div className="space-y-3">
            {/* 원본 URL */}
            <div className="flex items-center gap-2 text-xs text-muted">
              <ExternalLink className="h-3.5 w-3.5" />
              <a
                href={scrapeResult.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:text-primary"
              >
                {scrapeResult.source_url}
              </a>
              <span className="shrink-0">
                · {new Date(scrapeResult.scraped_at).toLocaleTimeString("ko-KR")}
              </span>
            </div>

            {/* 제목 */}
            <div className="rounded-md bg-surface p-3">
              <div className="mb-1 text-xs font-medium text-muted">📌 제목</div>
              <div className="text-sm font-semibold text-foreground">
                {scrapeResult.title}
              </div>
            </div>

            {/* 본문 */}
            <div className="rounded-md bg-surface p-3">
              <div className="mb-1 text-xs font-medium text-muted">📝 본문</div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                {scrapeResult.body}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* STEP 3: 페르소나 선택 & AI 리라이팅          */}
      {/* ═══════════════════════════════════════════ */}
      {scrapeResult && (
        <section className="rounded-lg border border-border-color bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
              3
            </span>
            페르소나 선택 → AI 리라이팅
          </h3>

          <div className="flex gap-3">
            {/* 페르소나 선택 드롭다운 */}
            <select
              value={selectedPersonaId}
              onChange={(e) => setSelectedPersonaId(e.target.value)}
              className="flex-1 rounded-lg border border-border-color bg-surface px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">페르소나를 선택하세요...</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname} — {p.industry} · {p.personality}
                </option>
              ))}
            </select>

            {/* 리라이팅 버튼 */}
            <button
              onClick={handleRewrite}
              disabled={!selectedPersonaId || rewriting}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {rewriting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {rewriting ? "리라이팅 중..." : "AI 리라이팅"}
            </button>
          </div>

          {/* 선택된 페르소나 미니 카드 */}
          {selectedPersonaId && (
            <div className="mt-3 flex items-center gap-3 rounded-md bg-surface p-3">
              <Bot className="h-5 w-5 text-primary" />
              <div className="text-sm">
                <span className="font-medium text-foreground">
                  {personas.find((p) => p.id === selectedPersonaId)?.nickname}
                </span>
                <span className="ml-2 text-muted">
                  {personas.find((p) => p.id === selectedPersonaId)?.industry} ·{" "}
                  {personas.find((p) => p.id === selectedPersonaId)?.personality}
                </span>
                {personas.find((p) => p.id === selectedPersonaId)?.target_site_url && (
                  <span className="ml-2 text-xs text-primary/70">
                    🔗 전담: {personas.find((p) => p.id === selectedPersonaId)?.target_site_url}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* STEP 4: 리라이팅 결과                       */}
      {/* ═══════════════════════════════════════════ */}
      {rewriteResult && (
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
              4
            </span>
            리라이팅 결과
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="ml-auto text-xs text-muted">
              by {rewriteResult.persona_nickname}
            </span>
          </h3>

          <div className="space-y-3">
            {/* 리라이팅된 제목 */}
            <div className="rounded-md bg-card p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-primary">✨ 새 제목</span>
                <button
                  onClick={() => navigator.clipboard.writeText(rewriteResult.rewritten_title)}
                  className="text-muted hover:text-foreground"
                  title="복사"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-sm font-semibold text-foreground">
                {rewriteResult.rewritten_title}
              </div>
            </div>

            {/* 리라이팅된 본문 */}
            <div className="rounded-md bg-card p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-primary">✨ 새 본문</span>
                <button
                  onClick={() => navigator.clipboard.writeText(rewriteResult.rewritten_body)}
                  className="text-muted hover:text-foreground"
                  title="복사"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                {rewriteResult.rewritten_body}
              </div>
            </div>

            {/* 원문 비교 (접힌 상태) */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
                📋 원문과 비교하기
              </summary>
              <div className="mt-2 rounded-md bg-surface p-3 text-xs text-muted">
                <div className="mb-1 font-medium">원래 제목:</div>
                <div className="mb-2">{rewriteResult.original_title}</div>
              </div>
            </details>

            {/* ═══════════════════════════════════════════ */}
            {/* 콘텐츠 팩토리: 3가지 액션 버튼               */}
            {/* 빙의 중일 때만 활성화 (NPC 명의 게시 가능)     */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-t border-border-color pt-4 mt-2">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  🏭 콘텐츠 팩토리
                </h4>
                {isImpersonating && impersonating ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-300">
                    <Drama className="h-3 w-3" />
                    {impersonating.nickname} 명의로 게시
                  </span>
                ) : (
                  <span className="text-[10px] text-muted">
                    ⚠️ NPC 페르소나 탭에서 먼저 빙의하세요
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* 원본 포스팅: 스크래핑한 원문을 그대로 게시 */}
                <button
                  disabled={!isImpersonating}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-3 text-xs font-medium text-blue-400 transition-all hover:bg-blue-500/10 hover:border-blue-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={isImpersonating ? "원문을 그대로 NPC 명의로 게시" : "빙의 후 사용 가능"}
                >
                  <Upload className="h-5 w-5" />
                  <span>원본 포스팅</span>
                </button>

                {/* AI 리라이팅 게시: 리라이팅된 글을 게시 */}
                <button
                  disabled={!isImpersonating}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-3 text-xs font-medium text-purple-400 transition-all hover:bg-purple-500/10 hover:border-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={isImpersonating ? "AI 리라이팅 결과를 NPC 명의로 게시" : "빙의 후 사용 가능"}
                >
                  <Sparkles className="h-5 w-5" />
                  <span>AI 리라이팅</span>
                </button>

                {/* 자체 글 생성: 빈 에디터에서 직접 작성 */}
                <button
                  disabled={!isImpersonating}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-3 text-xs font-medium text-emerald-400 transition-all hover:bg-emerald-500/10 hover:border-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={isImpersonating ? "NPC 명의로 자체 글 작성" : "빙의 후 사용 가능"}
                >
                  <PenLine className="h-5 w-5" />
                  <span>자체 글 생성</span>
                </button>
              </div>

              {/* 간단 안내 */}
              <p className="mt-2 text-[10px] text-muted text-center">
                {isImpersonating
                  ? `위 버튼 클릭 시 '${impersonating?.nickname}' 명의로 글이 게시됩니다. (추후 API 연동)`
                  : "NPC 페르소나 탭 → [빙의하기] 클릭 후 이용 가능합니다."}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 페르소나별 전담 사이트 현황                    */}
      {/* ═══════════════════════════════════════════ */}
      <section className="rounded-lg border border-border-color bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bot className="h-4 w-4 text-primary" />
          페르소나별 전담 사이트 현황
        </h3>

        {personas.length === 0 ? (
          <p className="text-sm text-muted">등록된 활성 페르소나가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {personas.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md bg-surface px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {p.nickname}
                  </span>
                  <span className="text-xs text-muted">
                    {p.industry} · {p.personality}
                  </span>
                </div>
                <div className="text-xs">
                  {p.target_site_url ? (
                    <a
                      href={p.target_site_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Globe className="h-3 w-3" />
                      {new URL(p.target_site_url).hostname}
                    </a>
                  ) : (
                    <span className="text-muted/50">미지정</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
