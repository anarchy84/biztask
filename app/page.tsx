// 파일 위치: app/page.tsx
// 용도: 메인 홈 화면 - 레딧/블라인드 스타일 3단 레이아웃
// 변경: 하드코딩 더미 데이터 → Supabase에서 실시간 데이터 fetch
// 이 파일은 서버 컴포넌트(Server Component)로, 빌드/요청 시 서버에서 DB를 조회합니다.

import {
  ArrowBigUp,
  ArrowBigDown,
  MessageCircle,
  Share2,
  Bookmark,
  Flame,
  TrendingUp,
  Briefcase,
  Megaphone,
  GraduationCap,
  Coffee,
  Award,
  Clock,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { createServerSupabaseClient } from "@/utils/supabase/server";

// ─── 타입 정의: Supabase에서 가져올 게시글 + 작성자 정보 ───
// Supabase의 JOIN 결과는 배열로 올 수 있으므로 배열 | 단일객체 둘 다 허용
type ProfileInfo = {
  nickname: string;
  avatar_url: string | null;
};

type PostWithAuthor = {
  id: string;
  title: string;
  content: string;
  category: string;
  upvotes: number;
  comment_count: number;
  created_at: string;
  author_id: string;
  profiles: ProfileInfo | ProfileInfo[] | null;
};

// profiles 필드에서 닉네임을 안전하게 추출하는 헬퍼 함수
function getAuthorNickname(profiles: PostWithAuthor["profiles"]): string {
  if (!profiles) return "익명";
  if (Array.isArray(profiles)) return profiles[0]?.nickname || "익명";
  return profiles.nickname || "익명";
}

// ─── 좌측 메뉴 카테고리 목록 ───
const CATEGORIES = [
  { name: "인기글", icon: Flame, color: "text-red-500" },
  { name: "최신글", icon: Clock, color: "text-blue-500" },
  { name: "사업", icon: Briefcase, color: "text-orange-500" },
  { name: "마케팅", icon: Megaphone, color: "text-purple-500" },
  { name: "커리어", icon: GraduationCap, color: "text-green-500" },
  { name: "자유", icon: Coffee, color: "text-amber-500" },
];

// ─── 카테고리별 색상 매핑 ───
function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    사업: "bg-orange-100 text-orange-700",
    마케팅: "bg-purple-100 text-purple-700",
    커리어: "bg-green-100 text-green-700",
    자유: "bg-amber-100 text-amber-700",
  };
  return colorMap[category] || "bg-gray-100 text-gray-700";
}

// ─── 날짜를 "n시간 전", "n일 전" 형태로 변환하는 함수 ───
function timeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime(); // 밀리초 차이
  const diffMin = Math.floor(diffMs / 60000); // 분 차이
  const diffHour = Math.floor(diffMs / 3600000); // 시간 차이
  const diffDay = Math.floor(diffMs / 86400000); // 일 차이

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 30) return `${diffDay}일 전`;
  return `${Math.floor(diffDay / 30)}개월 전`;
}

// ─── 메인 페이지 컴포넌트 (서버 컴포넌트 - async 함수) ───
export default async function Home() {
  // Supabase에서 게시글 + 작성자 정보를 최신순으로 조회
  const supabase = createServerSupabaseClient();

  const { data: posts, error } = await supabase
    .from("posts")
    .select(
      `
      id,
      title,
      content,
      category,
      upvotes,
      comment_count,
      created_at,
      author_id,
      profiles (
        nickname,
        avatar_url
      )
    `
    )
    .order("created_at", { ascending: false }) // 최신글이 위로
    .limit(20); // 최대 20개

  // 트렌딩: 추천수 상위 5개 (별도 쿼리)
  const { data: trending } = await supabase
    .from("posts")
    .select("id, title, comment_count")
    .order("upvotes", { ascending: false })
    .limit(5);

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      {/* 3단 레이아웃 그리드: 좌측(220px) + 중앙(유동) + 우측(300px) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_300px]">
        {/* ═══════════════════════════════════════════ */}
        {/* 좌측 사이드바: 카테고리 메뉴 (데스크탑에서만 표시) */}
        {/* ═══════════════════════════════════════════ */}
        <aside className="hidden lg:block">
          <div className="sticky top-16 space-y-1">
            <h2 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
              카테고리
            </h2>

            {CATEGORIES.map((cat) => (
              <a
                key={cat.name}
                href="#"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-gray-100"
              >
                <cat.icon className={`h-5 w-5 ${cat.color}`} />
                <span>{cat.name}</span>
              </a>
            ))}

            <div className="my-3 border-t border-border-color" />

            <a
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-gray-100"
            >
              <Award className="h-5 w-5 text-yellow-500" />
              <span>명예의 전당</span>
            </a>
          </div>
        </aside>

        {/* ═══════════════════════════════════════════ */}
        {/* 중앙 피드: 게시글 카드 목록 */}
        {/* ═══════════════════════════════════════════ */}
        <section className="space-y-3">
          {/* 피드 상단: 정렬 탭 */}
          <div className="flex items-center gap-2 rounded-lg border border-border-color bg-card-bg p-2">
            <button className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-foreground">
              <Flame className="h-4 w-4 text-red-500" />
              인기
            </button>
            <button className="flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-muted hover:bg-gray-100">
              <Clock className="h-4 w-4" />
              최신
            </button>
            <button className="flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-muted hover:bg-gray-100">
              <TrendingUp className="h-4 w-4" />
              급상승
            </button>
          </div>

          {/* DB 조회 에러 시 */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              데이터를 불러오는 데 실패했습니다: {error.message}
            </div>
          )}

          {/* 게시글이 없을 때 */}
          {!error && (!posts || posts.length === 0) && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border-color bg-card-bg py-16 text-center">
              <Inbox className="mb-4 h-12 w-12 text-muted" />
              <h3 className="mb-1 text-lg font-semibold text-foreground">
                아직 게시글이 없습니다
              </h3>
              <p className="mb-4 text-sm text-muted">
                첫 번째 글을 작성해 커뮤니티를 시작해보세요!
              </p>
              <a
                href="/submit"
                className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary-hover"
              >
                글쓰기
              </a>
            </div>
          )}

          {/* 게시글 카드 목록 (Supabase에서 가져온 실제 데이터) */}
          {posts &&
            (posts as PostWithAuthor[]).map((post) => (
              <article
                key={post.id}
                className="post-card flex rounded-lg border border-border-color bg-card-bg overflow-hidden cursor-pointer"
              >
                {/* 좌측: 추천/비추천 투표 영역 */}
                <div className="flex w-10 shrink-0 flex-col items-center gap-1 bg-gray-50 py-2">
                  <button
                    className="text-muted hover:text-upvote"
                    aria-label="추천"
                  >
                    <ArrowBigUp className="h-5 w-5" />
                  </button>
                  <span className="text-xs font-bold text-foreground">
                    {post.upvotes}
                  </span>
                  <button
                    className="text-muted hover:text-blue-500"
                    aria-label="비추천"
                  >
                    <ArrowBigDown className="h-5 w-5" />
                  </button>
                </div>

                {/* 우측: 게시글 내용 영역 */}
                <div className="flex-1 p-3">
                  {/* 상단 메타 정보: 카테고리 + 작성자 + 시간 */}
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${getCategoryColor(post.category)}`}
                    >
                      {post.category}
                    </span>
                    <span className="text-muted">
                      {getAuthorNickname(post.profiles)} ·{" "}
                      {timeAgo(post.created_at)}
                    </span>
                  </div>

                  {/* 게시글 제목 */}
                  <h3 className="mb-1 text-base font-semibold leading-snug text-foreground">
                    {post.title}
                  </h3>

                  {/* 게시글 본문 미리보기 (2줄까지) */}
                  <p className="mb-2 line-clamp-2 text-sm leading-relaxed text-muted">
                    {post.content}
                  </p>

                  {/* 하단: 댓글, 공유, 저장 버튼 */}
                  <div className="flex items-center gap-3">
                    <button className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted hover:bg-gray-100">
                      <MessageCircle className="h-4 w-4" />
                      {post.comment_count}개 댓글
                    </button>
                    <button className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted hover:bg-gray-100">
                      <Share2 className="h-4 w-4" />
                      공유
                    </button>
                    <button className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted hover:bg-gray-100">
                      <Bookmark className="h-4 w-4" />
                      저장
                    </button>
                  </div>
                </div>
              </article>
            ))}
        </section>

        {/* ═══════════════════════════════════════════ */}
        {/* 우측 사이드바: 트렌딩 + 커뮤니티 정보 (데스크탑에서만 표시) */}
        {/* ═══════════════════════════════════════════ */}
        <aside className="hidden lg:block">
          <div className="sticky top-16 space-y-4">
            {/* 트렌딩 게시글 위젯 */}
            <div className="rounded-lg border border-border-color bg-card-bg overflow-hidden">
              <div className="bg-primary px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                  <TrendingUp className="h-4 w-4" />
                  오늘의 트렌딩
                </h2>
              </div>

              <div className="divide-y divide-border-color">
                {trending && trending.length > 0 ? (
                  trending.map((item, index) => (
                    <a
                      key={item.id}
                      href="#"
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50"
                    >
                      <span className="text-lg font-bold text-primary">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted">
                          댓글 {item.comment_count}개
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                    </a>
                  ))
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-muted">
                    트렌딩 게시글이 없습니다
                  </p>
                )}
              </div>
            </div>

            {/* 커뮤니티 소개 위젯 */}
            <div className="rounded-lg border border-border-color bg-card-bg p-4">
              <h3 className="mb-2 text-sm font-bold text-foreground">
                BizTask 커뮤니티
              </h3>
              <p className="mb-3 text-xs leading-relaxed text-muted">
                스타트업, 마케팅, 커리어에 대해 자유롭게 이야기하는 익명
                비즈니스 커뮤니티입니다. 솔직한 경험과 인사이트를 나눠보세요.
              </p>
              <div className="mb-3 flex gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-foreground">1.2K</p>
                  <p className="text-xs text-muted">멤버</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-500">48</p>
                  <p className="text-xs text-muted">온라인</p>
                </div>
              </div>
              <a
                href="/submit"
                className="block w-full rounded-full bg-primary py-2 text-center text-sm font-medium text-white hover:bg-primary-hover"
              >
                글쓰기
              </a>
            </div>

            {/* 풋터 링크 */}
            <div className="px-2 text-xs text-muted">
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <a href="#" className="hover:underline">
                  이용약관
                </a>
                <a href="#" className="hover:underline">
                  개인정보처리방침
                </a>
                <a href="#" className="hover:underline">
                  문의하기
                </a>
              </div>
              <p className="mt-2">2026 BizTask. All rights reserved.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
