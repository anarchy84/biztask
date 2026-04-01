// ================================================================
// 파일 위치: app/news/page.tsx
// 용도: 뉴스 클리핑 카드 UI 페이지
// DB: news_clips (클러스터링된 뉴스 클립) + news_articles (개별 기사)
// 디자인: 다크 테마, 카드형 레이아웃, 카테고리 필터
// ================================================================

"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import {
  Newspaper,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TrendingUp,
  Briefcase,
  Cpu,
  Store,
  Megaphone,
} from "lucide-react";

// ─── 타입 정의 ───
// 뉴스 클립: AI가 클러스터링 + 요약한 "오늘의 이슈" 카드
type NewsClip = {
  id: string;
  headline: string;        // AI 생성 헤드라인
  summary: string;         // 3줄 요약 (What / Why / So What)
  category: string;        // marketing_biz | tech_ai | smallbiz | ad_trend
  thumbnail_url: string | null;
  article_count: number;   // 소속 기사 수
  importance_score: number;
  clip_date: string;
  status: string;
  created_at: string;
};

// 개별 기사: 클립에 소속된 원본 기사
type NewsArticle = {
  id: string;
  title: string;
  link: string;
  source_name: string;
  published_at: string | null;
};

// ─── 카테고리 설정 ───
// 4대 카테고리 정의 (아이콘, 라벨, 색상)
const CATEGORIES = [
  { key: "all", label: "전체", icon: TrendingUp, color: "text-primary-light", bg: "bg-primary/20", badge: "bg-primary" },
  { key: "marketing_biz", label: "마케팅/사업", icon: Briefcase, color: "text-purple-400", bg: "bg-purple-500/20", badge: "bg-purple-500" },
  { key: "tech_ai", label: "기술/AI", icon: Cpu, color: "text-blue-400", bg: "bg-blue-500/20", badge: "bg-blue-500" },
  { key: "smallbiz", label: "소상공인/중소기업", icon: Store, color: "text-amber-400", bg: "bg-amber-500/20", badge: "bg-amber-500" },
  { key: "ad_trend", label: "광고/트렌드", icon: Megaphone, color: "text-rose-400", bg: "bg-rose-500/20", badge: "bg-rose-500" },
];

// ─── 시간 포맷 헬퍼 ───
// "2시간 전", "어제" 같은 상대 시간 표시
function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

// ─── 카테고리 정보 가져오기 헬퍼 ───
function getCategoryInfo(key: string) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[0];
}

// ================================================================
// 메인 뉴스 페이지 컴포넌트
// ================================================================
export default function NewsPage() {
  // ─── 상태 관리 ───
  const [clips, setClips] = useState<NewsClip[]>([]);          // 뉴스 클립 목록
  const [loading, setLoading] = useState(true);                 // 로딩 상태
  const [activeCategory, setActiveCategory] = useState("all");  // 선택된 카테고리
  const [expandedClip, setExpandedClip] = useState<string | null>(null); // 펼쳐진 클립 ID
  const [clipArticles, setClipArticles] = useState<Record<string, NewsArticle[]>>({}); // 클립별 기사 목록

  // ─── 뉴스 클립 가져오기 ───
  // Supabase에서 published 상태인 클립을 중요도 순으로 조회
  const fetchClips = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("news_clips")
      .select("*")
      .eq("status", "published")
      .order("importance_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    // 카테고리 필터 적용 (전체가 아닐 때만)
    if (activeCategory !== "all") {
      query = query.eq("category", activeCategory);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[뉴스] 클립 조회 실패:", error.message);
    }
    setClips(data || []);
    setLoading(false);
  }, [activeCategory]);

  // ─── 클립 소속 기사 가져오기 ───
  // 카드를 펼쳤을 때 해당 클립에 소속된 원본 기사들 조회
  const fetchArticlesForClip = useCallback(async (clipId: string) => {
    // 이미 불러온 기사가 있으면 스킵
    if (clipArticles[clipId]) return;

    const { data } = await supabase
      .from("news_articles")
      .select("id, title, link, source_name, published_at")
      .eq("clip_id", clipId)
      .order("published_at", { ascending: false });

    if (data) {
      setClipArticles((prev) => ({ ...prev, [clipId]: data }));
    }
  }, [clipArticles]);

  // ─── 카드 펼치기/접기 토글 ───
  const toggleExpand = (clipId: string) => {
    if (expandedClip === clipId) {
      setExpandedClip(null);
    } else {
      setExpandedClip(clipId);
      fetchArticlesForClip(clipId);
    }
  };

  // ─── 초기 로드 ───
  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  // ================================================================
  // 렌더링
  // ================================================================
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* ── 페이지 헤더 ── */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10">
          <Newspaper className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">뉴스 브리핑</h1>
          <p className="text-xs text-muted">
            AI가 요약한 오늘의 비즈니스 뉴스
          </p>
        </div>
      </div>

      {/* ── 카테고리 필터 탭 ── */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? `${cat.bg} ${cat.color} ring-1 ring-current`
                  : "bg-hover-bg text-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ── 로딩 상태 ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* ── 빈 상태 ── */}
      {!loading && clips.length === 0 && (
        <div className="py-20 text-center">
          <Newspaper className="mx-auto mb-3 h-12 w-12 text-muted/40" />
          <p className="text-sm text-muted">아직 뉴스가 없습니다</p>
          <p className="mt-1 text-xs text-muted/60">
            곧 AI가 뉴스를 수집하고 요약할 예정이에요
          </p>
        </div>
      )}

      {/* ── 뉴스 클립 카드 목록 ── */}
      {!loading && clips.length > 0 && (
        <div className="space-y-3">
          {clips.map((clip) => {
            const catInfo = getCategoryInfo(clip.category);
            const isExpanded = expandedClip === clip.id;
            const articles = clipArticles[clip.id] || [];
            // 3줄 요약을 줄별로 분리
            const summaryLines = clip.summary.split("\n").filter((l) => l.trim());

            return (
              <div
                key={clip.id}
                className="overflow-hidden rounded-xl border border-border-color bg-card-bg transition-all hover:border-border-color/80"
              >
                {/* ── 카드 상단: 카테고리 뱃지 + 메타 ── */}
                <div className="px-4 pt-3 pb-0">
                  <div className="mb-2 flex items-center gap-2">
                    {/* 카테고리 뱃지 */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${catInfo.bg} ${catInfo.color}`}
                    >
                      <catInfo.icon className="h-2.5 w-2.5" />
                      {catInfo.label}
                    </span>
                    {/* 기사 수 */}
                    <span className="text-[10px] text-muted">
                      기사 {clip.article_count}개
                    </span>
                    {/* 시간 */}
                    <span className="text-[10px] text-muted">
                      {timeAgo(clip.created_at)}
                    </span>
                  </div>

                  {/* ── 헤드라인 ── */}
                  <h2 className="mb-2 text-[15px] font-bold leading-snug text-foreground">
                    {clip.headline}
                  </h2>

                  {/* ── 3줄 요약 ── */}
                  <div className="mb-3 space-y-1">
                    {summaryLines.map((line, i) => (
                      <p key={i} className="text-xs leading-relaxed text-muted">
                        {/* 아이콘 붙여서 What/Why/So What 구분 */}
                        <span className={`mr-1 font-semibold ${catInfo.color}`}>
                          {i === 0 ? "▸" : i === 1 ? "▹" : "▪"}
                        </span>
                        {line.trim()}
                      </p>
                    ))}
                  </div>
                </div>

                {/* ── 하단: 원본 기사 펼치기 버튼 ── */}
                <button
                  onClick={() => toggleExpand(clip.id)}
                  className="flex w-full items-center justify-center gap-1 border-t border-border-color px-4 py-2 text-xs text-muted transition-colors hover:bg-hover-bg hover:text-foreground"
                >
                  {isExpanded ? (
                    <>
                      접기 <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      원본 기사 보기 ({clip.article_count}건)
                      <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>

                {/* ── 펼쳐진 원본 기사 목록 ── */}
                {isExpanded && (
                  <div className="border-t border-border-color bg-background px-4 py-3">
                    {articles.length === 0 ? (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted" />
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {articles.map((article) => (
                          <li key={article.id}>
                            <a
                              href={article.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-hover-bg"
                            >
                              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted group-hover:text-primary" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium leading-snug text-foreground group-hover:text-primary">
                                  {article.title}
                                </p>
                                <p className="mt-0.5 text-[10px] text-muted">
                                  {article.source_name}
                                  {article.published_at &&
                                    ` · ${timeAgo(article.published_at)}`}
                                </p>
                              </div>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 하단 안내 ── */}
      {!loading && clips.length > 0 && (
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-muted/50">
          <RefreshCw className="h-3 w-3" />
          매일 오전 6시 · 오후 2시 자동 업데이트
        </div>
      )}
    </div>
  );
}
