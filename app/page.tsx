// 파일 위치: app/page.tsx
// 용도: 메인 홈 화면 - BizTask 다크 테마 3단 레이아웃
// 레이아웃: 순수 Tailwind 유틸리티 클래스만 사용 (커스텀 CSS 클래스 사용 금지)
// 브랜드: 형광 그린 #73e346 계열
// Suspense 래퍼 필수 (useSearchParams)
// 우측 사이드바: TrendingSidebar (🔥 실시간 인기글 랭킹보드)

"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import FeaturedSlider from "@/app/components/FeaturedSlider";
import PostCard from "@/app/components/PostCard";
import TrendingSidebar from "@/app/components/TrendingSidebar";
import {
  Flame,
  TrendingUp,
  Home as HomeIcon,
  BookOpen,
  Newspaper,
  Compass,
  Clock,
  Inbox,
  Loader2,
  Plus,
  X,
  Pencil,
  Trash2,
  Users,
  Hash,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

// ─── 타입 정의 ───
type ProfileInfo = {
  nickname: string;
  avatar_url: string | null;
};

// 커뮤니티 조인 정보
type CommunityInfo = {
  name: string;
  slug: string | null;
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
  image_urls: string[] | null;
  profiles: ProfileInfo | ProfileInfo[] | null;
  communities: CommunityInfo | CommunityInfo[] | null; // 조인된 커뮤니티 정보
};

// 트렌딩 게시글 타입 (upvotes + category 포함)
type TrendingPost = {
  id: string;
  title: string;
  upvotes: number;
  comment_count: number;
  category: string;
};

// ─── 헬퍼 함수 ───
function getAuthorNickname(profiles: PostWithAuthor["profiles"]): string {
  if (!profiles) return "익명";
  if (Array.isArray(profiles)) return profiles[0]?.nickname || "익명";
  return profiles.nickname || "익명";
}

// 작성자 아바타 URL 추출 헬퍼
function getAuthorAvatarUrl(profiles: PostWithAuthor["profiles"]): string | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0]?.avatar_url || null;
  return profiles.avatar_url || null;
}

// 소속 커뮤니티 이름 추출 헬퍼
function getCommunityName(communities: PostWithAuthor["communities"]): string | null {
  if (!communities) return null;
  if (Array.isArray(communities)) return communities[0]?.name || null;
  return communities.name || null;
}

// 소속 커뮤니티 slug 추출 헬퍼
function getCommunitySlug(communities: PostWithAuthor["communities"]): string | null {
  if (!communities) return null;
  if (Array.isArray(communities)) return communities[0]?.slug || null;
  return communities.slug || null;
}

// ─── 좌측 메뉴: 레딧 스타일 5대 메인 네비게이션 ───
const SIDEBAR_NAV = [
  { name: "홈", icon: HomeIcon, color: "text-primary-light", path: "/" },
  { name: "인기", icon: Flame, color: "text-red-400", path: "/popular" },
  { name: "칼럼", icon: BookOpen, color: "text-purple-400", path: "/columns" },
  { name: "뉴스", icon: Newspaper, color: "text-cyan-400", path: "/news" },
  { name: "둘러보기", icon: Compass, color: "text-amber-400", path: "/communities" },
];

// ─── 상단 정렬 탭 ───
const SORT_TABS = [
  { key: "popular", label: "인기", icon: Flame, iconColor: "text-red-400" },
  { key: "latest", label: "최신", icon: Clock, iconColor: "text-blue-400" },
  { key: "rising", label: "급상승", icon: TrendingUp, iconColor: "text-green-400" },
];

// ═══════════════════════════════════════════════════════
// Suspense 래퍼 (useSearchParams는 Suspense 바운더리 필요)
// ═══════════════════════════════════════════════════════
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <Home />
    </Suspense>
  );
}

// ═══════════════════════════════════════════════════════
// 메인 페이지 컴포넌트 (내부)
// ═══════════════════════════════════════════════════════
function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname(); // 현재 URL 경로 (사이드바 Active 판단용)

  const currentCategory = searchParams.get("category") || "";
  const currentSort = searchParams.get("sort") || "popular";

  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [trending, setTrending] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [isVip, setIsVip] = useState(false); // VIP 크리에이터 여부

  // ─── 카테고리 (글 주제 태그) 관련 상태 ───
  type Category = { id: string; name: string; color: string; sort_order: number };
  const [categories, setCategories] = useState<Category[]>([]);     // DB categories 테이블
  const [showCatModal, setShowCatModal] = useState(false);          // 카테고리 추가 모달
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#9ca3af");
  const [editingCat, setEditingCat] = useState<Category | null>(null); // 수정 중인 카테고리
  const [catCreating, setCatCreating] = useState(false);

  // ─── 커뮤니티 (레딧 서브레딧 스타일) 관련 상태 ───
  type Community = { id: string; name: string; slug: string | null; description: string; member_count: number; icon_url: string | null };
  const [communities, setCommunities] = useState<Community[]>([]);
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [newComName, setNewComName] = useState("");
  const [newComDesc, setNewComDesc] = useState("");
  const [newComSlug, setNewComSlug] = useState("");
  const [comCreating, setComCreating] = useState(false);
  // slug 중복 체크 관련 상태
  const [slugError, setSlugError] = useState("");
  const [slugChecking, setSlugChecking] = useState(false);

  // ─── 사이드바 더보기/접기 상태 ───
  // 카테고리와 커뮤니티 목록이 5개 초과 시 접어두기
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllCommunities, setShowAllCommunities] = useState(false);
  // 커뮤니티 생성 성공 토스트 표시 여부
  const [comSuccessToast, setComSuccessToast] = useState(false);

  // ─── 게시글 목록 불러오기 ───
  const fetchPosts = useCallback(
    async (category: string, sort: string) => {
      let query = supabase
        .from("posts")
        .select(
          `id, title, content, category, upvotes, comment_count, created_at, author_id, image_urls,
           profiles ( nickname, avatar_url ),
           communities ( name, slug )`
        );

      if (category) {
        query = query.eq("category", category);
      }

      if (sort === "popular") {
        query = query
          .order("upvotes", { ascending: false })
          .order("created_at", { ascending: false });
      } else if (sort === "rising") {
        const oneDayAgo = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString();
        query = query
          .gte("created_at", oneDayAgo)
          .order("upvotes", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data } = await query.limit(20);
      if (data) setPosts(data as PostWithAuthor[]);
    },
    []
  );

  // ─── 🔥 실시간 인기글 TOP 5 불러오기 (upvotes 기준 내림차순) ───
  const fetchTrending = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, title, upvotes, comment_count, category")
      .order("upvotes", { ascending: false })
      .limit(5);
    if (data) setTrending(data as TrendingPost[]);
  }, []);

  // ─── 내가 추천한 글 목록 ───
  const fetchMyLikes = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", userId);
    if (data) {
      setLikedPostIds(new Set(data.map((row) => row.post_id)));
    }
  }, []);

  // ─── 카테고리 목록 불러오기 (categories 테이블) ───
  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from("categories")
      .select("id, name, color, sort_order")
      .order("sort_order", { ascending: true });
    if (data) setCategories(data as Category[]);
  }, []);

  // ─── 커뮤니티 목록 불러오기 (communities 테이블) ───
  const fetchCommunities = useCallback(async () => {
    // is_active 컬럼이 아직 DB에 없을 수 있으므로 필터 없이 전체 조회
    // (is_active 컬럼 추가 후 .eq("is_active", true) 복구 가능)
    const { data, error } = await supabase
      .from("communities")
      .select("id, name, slug, description, member_count, icon_url")
      .order("member_count", { ascending: false });
    // 디버깅용 로그: 데이터와 에러를 콘솔에 바로 출력
    console.log("불러온 커뮤니티 데이터:", data, error);
    if (error) {
      console.error("[fetchCommunities] 조회 실패:", error);
    }
    if (data) setCommunities(data as Community[]);
  }, []);

  // ─── VIP 전용: 새 카테고리 추가/수정 ───
  const handleSaveCategory = async () => {
    if (!newCatName.trim() || !user) return;
    setCatCreating(true);

    if (editingCat) {
      // 수정 모드
      const { error } = await supabase
        .from("categories")
        .update({ name: newCatName.trim(), color: newCatColor })
        .eq("id", editingCat.id);
      if (error) {
        alert("카테고리 수정 실패: " + error.message);
      } else {
        await fetchCategories();
        closeAllModals();
      }
    } else {
      // 새로 만들기
      const nextOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 1;
      const { error } = await supabase.from("categories").insert({
        name: newCatName.trim(),
        color: newCatColor,
        sort_order: nextOrder,
        created_by: user.id,
      });
      if (error) {
        alert("카테고리 추가 실패: " + error.message);
      } else {
        await fetchCategories();
        closeAllModals();
      }
    }
    setCatCreating(false);
  };

  // ─── VIP 전용: 카테고리 삭제 ───
  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (!confirm(`'${catName}' 카테고리를 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", catId);
    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      await fetchCategories();
    }
  };

  // ─── slug 중복 확인 함수 (onBlur 시 호출) ───
  // 유저가 URL 주소 입력 칸에서 포커스를 벗어날 때 미리 중복 체크
  const checkSlugAvailability = async (slugToCheck: string) => {
    if (!slugToCheck.trim()) {
      setSlugError("");
      return;
    }
    setSlugChecking(true);
    const { data } = await supabase
      .from("communities")
      .select("id")
      .eq("slug", slugToCheck.trim())
      .limit(1);
    if (data && data.length > 0) {
      setSlugError("이미 사용 중인 URL 주소입니다. 다른 주소를 입력해 주세요.");
    } else {
      setSlugError("");
    }
    setSlugChecking(false);
  };

  // ─── VIP 전용: 새 커뮤니티 생성 ───
  // try-catch로 네트워크 에러까지 완전 커버
  // 성공 시 토스트 알림 + 사이드바 갱신 + 모달 닫기
  // 모든 에러 경로에 [코드 + 메시지]를 표시하여 디버깅 가능하게 함
  const handleCreateCommunity = async () => {
    if (!newComName.trim() || !user) return;
    // slug 중복 에러가 있으면 생성 차단
    if (slugError) return;
    setComCreating(true);

    try {
      // slug 자동 생성: 한글은 그대로, 공백은 하이픈으로
      const slug = newComSlug.trim() || newComName.trim().toLowerCase().replace(/\s+/g, "-");

      // 디버깅용: 콘솔에 요청 데이터 출력
      console.log("[커뮤니티 생성] 요청:", { name: newComName.trim(), slug, user: user.id });

      const { data, error } = await supabase.from("communities").insert({
        name: newComName.trim(),
        slug,
        description: newComDesc.trim() || null,
        created_by: user.id,
      }).select();

      // 디버깅용: 응답 전체 출력
      console.log("[커뮤니티 생성] 응답:", { data, error });

      // ⚠️ Supabase RLS 차단 시 error=null인데 data가 빈 배열인 경우가 있음
      // .select()를 호출했으므로 성공하면 data에 1개 이상의 row가 있어야 함
      if (!error && (!data || (Array.isArray(data) && data.length === 0))) {
        console.error("[커뮤니티 생성] RLS 차단 의심: error는 null인데 data가 비어있음", { data, error });
        alert("⛔ 커뮤니티 생성이 차단되었습니다.\n\n가능한 원인:\n1. VIP 권한이 없음 (profiles.is_vip = false)\n2. RLS INSERT 정책이 누락됨\n\nSupabase 대시보드에서 communities 테이블의\nRLS 정책을 확인해 주세요.");
        setComCreating(false);
        return;
      }

      if (error) {
        // 에러 유형 판별 (message 기반으로 정밀 분류)
        const errMsg = error.message || "";
        const errCode = error.code || "";
        const isSlugDuplicate = errMsg.includes("communities_slug_key");
        const isNameDuplicate = errMsg.includes("communities_name_key");
        const isUniqueViolation = errCode === "23505"; // 어떤 UNIQUE든 위반
        const isRlsError = errMsg.includes("row-level security") || errMsg.includes("policy") || errCode === "42501" || errCode === "42P01";
        // Supabase가 RLS 차단 시 빈 응답을 줄 수도 있음 (data=null, error=null이 아닌 경우)

        console.log("[커뮤니티 생성] 에러 분류:", { errMsg, errCode, isSlugDuplicate, isNameDuplicate, isUniqueViolation, isRlsError });

        if (isNameDuplicate) {
          // ── 이름 중복 에러 (communities.name UNIQUE 제약조건) ──
          alert("이미 같은 이름의 커뮤니티가 존재합니다.\n다른 이름을 입력해 주세요.");
        } else if (isSlugDuplicate || (isUniqueViolation && !isNameDuplicate)) {
          // ── slug 중복 에러 → 랜덤 숫자 4자리 붙여서 1회 재시도 ──
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const retrySlug = `${slug}-${randomSuffix}`;
          console.log("[커뮤니티 생성] slug 중복 → 재시도:", retrySlug);

          const { error: retryError } = await supabase.from("communities").insert({
            name: newComName.trim(),
            slug: retrySlug,
            description: newComDesc.trim() || null,
            created_by: user.id,
          });

          if (retryError) {
            console.error("[커뮤니티 생성] 재시도 실패:", retryError);
            alert(`커뮤니티 생성에 실패했습니다.\n\n[에러 코드] ${retryError.code || "없음"}\n[원인] ${retryError.message}`);
          } else {
            // 재시도 성공!
            await fetchCommunities();
            closeAllModals();
            setComSuccessToast(true);
            setTimeout(() => setComSuccessToast(false), 3000);
          }
        } else if (isRlsError) {
          // ── RLS 권한 에러 ──
          alert("⛔ 권한이 없습니다.\nVIP 회원만 커뮤니티를 생성할 수 있습니다.\n\n관리자에게 VIP 권한을 요청해 주세요.");
        } else {
          // ── 기타 에러: 코드 + 메시지 전부 표시 ──
          alert(`커뮤니티 생성에 실패했습니다.\n\n[에러 코드] ${errCode || "없음"}\n[원인] ${errMsg}\n\n이 메시지를 캡처해서 공유해 주세요.`);
        }
      } else {
        // ✅ 성공: 사이드바 갱신 → 모달 닫기 → 성공 토스트 표시
        await fetchCommunities();
        closeAllModals();
        setComSuccessToast(true);
        setTimeout(() => setComSuccessToast(false), 3000);
      }
    } catch (err) {
      // 네트워크 에러 등 예상치 못한 오류
      console.error("[커뮤니티 생성] 예외:", err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`네트워크 오류가 발생했습니다.\n인터넷 연결을 확인하고 다시 시도해 주세요.\n\n[상세] ${message}`);
    } finally {
      // 어떤 경우든 로딩 상태 해제
      setComCreating(false);
    }
  };

  // ─── 모달 닫기 + 입력 초기화 ───
  const closeAllModals = () => {
    setShowCatModal(false);
    setShowCommunityModal(false);
    setEditingCat(null);
    setNewCatName("");
    setNewCatColor("#9ca3af");
    setNewComName("");
    setNewComDesc("");
    setNewComSlug("");
    setSlugError("");
    setSlugChecking(false);
  };

  // ─── useEffect 1: 초기 1회만 실행 (인증 + 사이드바 데이터) ───
  // 카테고리/정렬 변경과 무관하게 딱 한 번만 로드
  useEffect(() => {
    const initOnce = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);

        // VIP 여부 + 좋아요 목록을 병렬 조회
        const [profileRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("is_vip")
            .eq("id", session.user.id)
            .maybeSingle(),
          fetchMyLikes(session.user.id),
        ]);

        if (profileRes.data?.is_vip) {
          setIsVip(true);
        }
      }

      // 사이드바 데이터: 카테고리 + 커뮤니티 + 트렌딩 (1회)
      await Promise.all([
        fetchCategories(),
        fetchCommunities(),
        fetchTrending(),
      ]);
    };

    initOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── useEffect 2: 카테고리/정렬 변경 시 게시글만 다시 로드 ───
  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      await fetchPosts(currentCategory, currentSort);
      setLoading(false);
    };

    loadPosts();
  }, [currentCategory, currentSort, fetchPosts]);

  // ─── URL 파라미터 조합 헬퍼 ───
  function buildCategoryUrl(category: string): string {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (currentSort && currentSort !== "popular")
      params.set("sort", currentSort);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  function buildSortUrl(sort: string): string {
    const params = new URLSearchParams();
    if (currentCategory) params.set("category", currentCategory);
    if (sort !== "popular") params.set("sort", sort);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  // ─── 추천 토글 핸들러 ───
  const handleToggleLike = async (e: React.MouseEvent, postId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    const isLiked = likedPostIds.has(postId);

    if (isLiked) {
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);

      await supabase.rpc("decrement_upvotes", { row_id: postId });

      setLikedPostIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, upvotes: Math.max(0, p.upvotes - 1) } : p
        )
      );
    } else {
      await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: user.id });

      await supabase.rpc("increment_upvotes", { row_id: postId });

      setLikedPostIds((prev) => new Set(prev).add(postId));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p
        )
      );
    }
  };

  // ─── 카테고리 클릭 핸들러 ───
  const handleCategoryClick = (e: React.MouseEvent, category: string) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(buildCategoryUrl(category));
  };

  // ─── 스켈레톤 카드 컴포넌트 (게시글 로딩 중 표시) ───
  const SkeletonCard = () => (
    <div className="animate-pulse rounded-xl border border-border-color bg-card-bg p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-5 rounded-full bg-hover-bg" />
        <div className="h-3 w-16 rounded bg-hover-bg" />
        <div className="h-3 w-24 rounded bg-hover-bg" />
      </div>
      <div className="h-4 w-3/4 rounded bg-hover-bg mb-2" />
      <div className="h-3 w-full rounded bg-hover-bg mb-1" />
      <div className="h-3 w-2/3 rounded bg-hover-bg mb-4" />
      <div className="flex items-center gap-3">
        <div className="h-7 w-20 rounded-full bg-hover-bg" />
        <div className="h-7 w-16 rounded-full bg-hover-bg" />
        <div className="h-7 w-14 rounded-full bg-hover-bg" />
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 md:px-8">
      {/* 3단 그리드: Tailwind 유틸리티만 사용 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_minmax(0,1fr)_280px] lg:gap-6 xl:grid-cols-[220px_minmax(0,1fr)_300px] xl:gap-7">

        {/* ═══════════════════════════════════════════ */}
        {/* 좌측 사이드바: 레딧 스타일 5대 메인 네비게이션   */}
        {/* ═══════════════════════════════════════════ */}
        <aside className="hidden lg:block">
          <div className="sticky top-16 space-y-1">
            {SIDEBAR_NAV.map((item) => {
              // ─── Active 판단 로직 (usePathname 기반) ───
              // "홈"만 루트 경로 + 카테고리/정렬 파라미터 없을 때 활성
              // 나머지는 pathname이 정확히 일치할 때만 활성
              let isActive = false;
              if (item.path === "/") {
                // 홈: 루트 경로이고, 카테고리 필터나 정렬 변경이 없는 기본 상태
                isActive = pathname === "/" && !currentCategory && currentSort === "popular";
              } else {
                // 인기, 칼럼, 뉴스, 둘러보기: URL 경로가 정확히 일치할 때
                isActive = pathname === item.path;
              }

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted hover:bg-hover-bg hover:text-foreground"
                  }`}
                >
                  <item.icon
                    className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : item.color}`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            <div className="my-3 border-t border-border-color" />

            {/* ─── 카테고리 섹션 (글 주제 태그) ─── */}
            <div className="flex items-center justify-between px-3 py-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                카테고리
              </h3>
              {isVip && (
                <button
                  onClick={() => { setEditingCat(null); setNewCatName(""); setNewCatColor("#9ca3af"); setShowCatModal(true); }}
                  className="flex h-5 w-5 items-center justify-center rounded-md text-muted transition-colors hover:bg-primary/20 hover:text-primary"
                  aria-label="카테고리 추가"
                  title="새 카테고리 추가 (VIP 전용)"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* DB에서 불러온 카테고리 목록 (기본 5개, 더보기 클릭 시 전체) */}
            {(showAllCategories ? categories : categories.slice(0, 5)).map((cat) => {
              const isActive = currentCategory === cat.name;
              return (
                <div key={cat.id} className="group flex items-center">
                  <Link
                    href={buildCategoryUrl(cat.name)}
                    className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted hover:bg-hover-bg hover:text-foreground"
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: isActive ? "#73e346" : cat.color }}
                    />
                    <span>{cat.name}</span>
                  </Link>
                  {/* VIP: 수정/삭제 버튼 (호버 시 표시) */}
                  {isVip && (
                    <div className="hidden group-hover:flex items-center gap-0.5 pr-1">
                      <button
                        onClick={() => { setEditingCat(cat); setNewCatName(cat.name); setNewCatColor(cat.color); setShowCatModal(true); }}
                        className="rounded p-1 text-muted hover:text-primary hover:bg-primary/10"
                        title="수정"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="rounded p-1 text-muted hover:text-red-400 hover:bg-red-400/10"
                        title="삭제"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 카테고리 6개 이상일 때 더보기/접기 토글 버튼 */}
            {categories.length > 5 && (
              <button
                onClick={() => setShowAllCategories(!showAllCategories)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover-bg hover:text-foreground"
              >
                {showAllCategories ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    접기
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    더보기 ({categories.length - 5}개)
                  </>
                )}
              </button>
            )}

            <div className="my-3 border-t border-border-color" />

            {/* ─── 커뮤니티 섹션 (레딧 서브레딧 스타일) ─── */}
            <div className="flex items-center justify-between px-3 py-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                커뮤니티
              </h3>
              {isVip && (
                <button
                  onClick={() => { setNewComName(""); setNewComDesc(""); setNewComSlug(""); setShowCommunityModal(true); }}
                  className="flex h-5 w-5 items-center justify-center rounded-md text-muted transition-colors hover:bg-primary/20 hover:text-primary"
                  aria-label="커뮤니티 생성"
                  title="새 커뮤니티 만들기 (VIP 전용)"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* 커뮤니티 목록 → 클릭 시 /community/[slug] 이동 (기본 5개) */}
            {communities.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted">아직 커뮤니티가 없습니다</p>
            ) : (
              (showAllCommunities ? communities : communities.slice(0, 5)).map((com) => {
                // slug가 비어있거나 null이면 id로 폴백
                // encodeURIComponent로 한글 slug도 안전하게 URL 변환
                const communityPath = com.slug && com.slug.trim() ? com.slug : com.id;
                return (
                  <Link
                    key={com.id}
                    href={`/community/${encodeURIComponent(communityPath)}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-hover-bg hover:text-foreground"
                  >
                    <Users className="h-4 w-4 shrink-0 text-primary/60" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">{com.name}</span>
                      <span className="text-[10px] text-muted">{com.member_count}명</span>
                    </div>
                  </Link>
                );
              })
            )}

            {/* 커뮤니티 6개 이상일 때 더보기/접기 토글 버튼 */}
            {communities.length > 5 && (
              <button
                onClick={() => setShowAllCommunities(!showAllCommunities)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover-bg hover:text-foreground"
              >
                {showAllCommunities ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    접기
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    더보기 ({communities.length - 5}개)
                  </>
                )}
              </button>
            )}

            {/* ─── VIP 크리에이터 라운지 (isVip일 때만) ─── */}
            {isVip && (
              <>
                <div className="my-3 border-t border-border-color" />
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <span>💎</span>
                    VIP 크리에이터 라운지
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    인증된 크리에이터 전용 공간입니다. 커뮤니티 생성, VIP 전용 콘텐츠를 이용하세요.
                  </p>
                  <Link
                    href="/?category=VIP 전용"
                    className="mt-2 flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-black hover:bg-primary-hover transition-colors"
                  >
                    💎 VIP 전용 글 보기
                  </Link>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* ═══════════════════════════════════════════ */}
        {/* 중앙 피드                                    */}
        {/* ═══════════════════════════════════════════ */}
        <section className="min-w-0 space-y-3">
          {/* Featured 슬라이더 */}
          <FeaturedSlider />

          {/* 정렬 탭 */}
          <div className="flex items-center gap-2 rounded-xl border border-border-color bg-card-bg p-2">
            {SORT_TABS.map((tab) => {
              const isActive = currentSort === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={buildSortUrl(tab.key)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-hover-bg text-foreground"
                      : "text-muted hover:bg-hover-bg hover:text-foreground"
                  }`}
                >
                  <tab.icon
                    className={`h-4 w-4 ${isActive ? tab.iconColor : ""}`}
                  />
                  {tab.label}
                </Link>
              );
            })}

            {currentCategory && (
              <div className="ml-auto flex items-center gap-1.5">
                <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {currentCategory}
                </span>
                <Link
                  href={buildCategoryUrl("")}
                  className="rounded-full p-0.5 text-muted hover:bg-hover-bg hover:text-foreground"
                  aria-label="필터 해제"
                >
                  ✕
                </Link>
              </div>
            )}

            {/* ─── 카테고리 콤보박스 (우측 끝) ─── */}
            <select
              value={currentCategory}
              onChange={(e) => router.push(buildCategoryUrl(e.target.value))}
              className="ml-auto shrink-0 rounded-lg border border-border-color bg-input-bg px-3 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">전체</option>
              {/* DB에서 불러온 카테고리 목록 */}
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
              {isVip && <option value="VIP 전용">💎 VIP 전용</option>}
            </select>
          </div>

          {/* 모바일 전용: 카테고리 가로 스크롤 */}
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            <Link
              href={buildCategoryUrl("")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                !currentCategory
                  ? "bg-primary text-black"
                  : "border border-border-color text-muted hover:border-primary hover:text-primary"
              }`}
            >
              전체
            </Link>
            {categories.map((cat) => {
              const isActive = cat.name === currentCategory;
              return (
                <Link
                  key={cat.id}
                  href={buildCategoryUrl(cat.name)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-black"
                      : "border border-border-color text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {cat.name}
                </Link>
              );
            })}
          </div>

          {/* 로딩 중 스켈레톤 UI */}
          {loading && (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {/* 게시글이 없을 때 (로딩 완료 후) */}
          {!loading && posts.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border-color bg-card-bg py-16 text-center">
              <Inbox className="mb-4 h-12 w-12 text-muted" />
              <h3 className="mb-1 text-lg font-semibold text-foreground">
                {currentCategory
                  ? `'${currentCategory}' 카테고리에 게시글이 없습니다`
                  : "아직 게시글이 없습니다"}
              </h3>
              <p className="mb-4 text-sm text-muted">
                {currentCategory
                  ? "다른 카테고리를 확인하거나 첫 글을 작성해보세요!"
                  : "첫 번째 글을 작성해 커뮤니티를 시작해보세요!"}
              </p>
              <div className="flex gap-2">
                {currentCategory && (
                  <Link
                    href="/"
                    className="rounded-full border border-border-color px-5 py-2 text-sm font-medium text-muted hover:bg-hover-bg"
                  >
                    전체 보기
                  </Link>
                )}
                <a
                  href="/submit"
                  className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-black hover:bg-primary-hover"
                >
                  글쓰기
                </a>
              </div>
            </div>
          )}

          {/* 게시글 카드 목록 (로딩 완료 후) */}
          {!loading && posts.map((post) => (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="block"
            >
              <PostCard
                id={post.id}
                title={post.title}
                content={post.content}
                category={post.category}
                upvotes={post.upvotes}
                commentCount={post.comment_count}
                createdAt={post.created_at}
                authorNickname={getAuthorNickname(post.profiles)}
                authorAvatarUrl={getAuthorAvatarUrl(post.profiles)}
                imageUrls={post.image_urls}
                communityName={getCommunityName(post.communities)}
                communitySlug={getCommunitySlug(post.communities)}
                isLiked={likedPostIds.has(post.id)}
                onToggleLike={handleToggleLike}
                onCategoryClick={handleCategoryClick}
              />
            </Link>
          ))}
        </section>

        {/* ═══════════════════════════════════════════ */}
        {/* 우측 사이드바: 🔥 실시간 인기글 + 커뮤니티 소개 */}
        {/* ═══════════════════════════════════════════ */}
        <aside className="hidden lg:block">
          <div className="sticky top-16 space-y-4">
            {/* 🔥 실시간 인기글 랭킹보드 (TrendingSidebar 컴포넌트) */}
            <TrendingSidebar items={trending} />

            {/* 커뮤니티 소개 */}
            <div className="rounded-xl border border-border-color bg-card-bg p-4">
              <h3 className="mb-2 text-sm font-bold text-foreground">
                BizTask 커뮤니티
              </h3>
              <p className="mb-3 text-xs leading-relaxed text-muted">
                스타트업, 마케팅, 커리어에 대해 자유롭게 이야기하는 익명
                비즈니스 커뮤니티입니다. 솔직한 경험과 인사이트를 나눠보세요.
              </p>
              <div className="mb-3 flex gap-6">
                <div>
                  <p className="text-lg font-bold text-foreground">1.2K</p>
                  <p className="text-xs text-muted">멤버</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-400">48</p>
                  <p className="text-xs text-muted">온라인</p>
                </div>
              </div>
              <a
                href="/submit"
                className="block w-full rounded-full bg-primary py-2 text-center text-sm font-bold text-black hover:bg-primary-hover"
              >
                글쓰기
              </a>
            </div>

            {/* 풋터 */}
            <div className="text-xs text-muted">
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <a href="#" className="hover:underline">이용약관</a>
                <a href="#" className="hover:underline">개인정보처리방침</a>
                <a href="#" className="hover:underline">문의하기</a>
              </div>
              <p className="mt-2">2026 BizTask. All rights reserved.</p>
            </div>
          </div>
        </aside>

      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* VIP 전용: 카테고리 추가/수정 모달              */}
      {/* ═══════════════════════════════════════════ */}
      {showCatModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeAllModals}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-border-color bg-card-bg p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeAllModals}
              className="absolute top-4 right-4 rounded-full p-1 text-muted hover:bg-hover-bg hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Hash className="h-5 w-5 text-primary" />
              {editingCat ? "카테고리 수정" : "새 카테고리 추가"}
            </h2>
            <p className="mt-1 text-xs text-muted">
              💎 VIP 전용 — 글 주제 분류용 카테고리를 {editingCat ? "수정" : "추가"}합니다.
            </p>

            {/* 카테고리 이름 */}
            <div className="mt-5">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                카테고리 이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="예: 스타트업, 투자, AI 등..."
                maxLength={20}
                className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-right text-[11px] text-muted">{newCatName.length}/20</p>
            </div>

            {/* 색상 선택 */}
            <div className="mt-3">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                태그 색상
              </label>
              <div className="flex gap-2 flex-wrap">
                {["#4ade80", "#c084fc", "#22d3ee", "#fbbf24", "#f87171", "#fb923c", "#a78bfa", "#9ca3af"].map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewCatColor(color)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      newCatColor === color ? "border-white scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="mt-5 flex gap-2">
              <button
                onClick={closeAllModals}
                className="flex-1 rounded-lg border border-border-color px-4 py-2.5 text-sm font-medium text-muted hover:bg-hover-bg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveCategory}
                disabled={!newCatName.trim() || catCreating}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-black hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {catCreating ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    처리 중...
                  </span>
                ) : editingCat ? "수정하기" : "추가하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* VIP 전용: 커뮤니티 생성 모달                    */}
      {/* ═══════════════════════════════════════════ */}
      {showCommunityModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeAllModals}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-border-color bg-card-bg p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeAllModals}
              className="absolute top-4 right-4 rounded-full p-1 text-muted hover:bg-hover-bg hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Users className="h-5 w-5 text-primary" />
              새 커뮤니티 만들기
            </h2>
            <p className="mt-1 text-xs text-muted">
              💎 VIP 전용 — 레딧처럼 주제별 커뮤니티를 만들어 운영하세요!
            </p>

            {/* 커뮤니티 이름 */}
            <div className="mt-5">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                커뮤니티 이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newComName}
                onChange={(e) => setNewComName(e.target.value)}
                placeholder="예: 마케팅 연구소, 스타트업 라운지..."
                maxLength={30}
                className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-right text-[11px] text-muted">{newComName.length}/30</p>
            </div>

            {/* URL 슬러그 */}
            <div className="mt-3">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                URL 주소 <span className="text-muted">(선택 — 비워두면 자동 생성)</span>
              </label>
              <div className={`flex items-center gap-1 rounded-lg border bg-input-bg px-3 py-2.5 ${slugError ? "border-red-500" : "border-border-color"}`}>
                <span className="text-xs text-muted">/community/</span>
                <input
                  type="text"
                  value={newComSlug}
                  onChange={(e) => {
                    setNewComSlug(e.target.value.replace(/[^a-zA-Z0-9가-힣-]/g, ""));
                    // 입력 중에는 에러 메시지 초기화
                    if (slugError) setSlugError("");
                  }}
                  onBlur={() => checkSlugAvailability(newComSlug)}
                  placeholder="marketing-lab"
                  maxLength={30}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder-muted focus:outline-none"
                />
                {/* 중복 체크 로딩 표시 */}
                {slugChecking && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
              </div>
              {/* 중복 에러 경고 문구 (빨간색) */}
              {slugError && (
                <p className="mt-1 text-xs text-red-400">{slugError}</p>
              )}
            </div>

            {/* 커뮤니티 설명 */}
            <div className="mt-3">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                설명 <span className="text-muted">(선택)</span>
              </label>
              <textarea
                value={newComDesc}
                onChange={(e) => setNewComDesc(e.target.value)}
                placeholder="이 커뮤니티의 주제와 목적을 알려주세요..."
                maxLength={200}
                rows={3}
                className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* 액션 버튼 */}
            <div className="mt-5 flex gap-2">
              <button
                onClick={closeAllModals}
                className="flex-1 rounded-lg border border-border-color px-4 py-2.5 text-sm font-medium text-muted hover:bg-hover-bg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCreateCommunity}
                disabled={!newComName.trim() || comCreating || !!slugError}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-black hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {comCreating ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    생성 중...
                  </span>
                ) : "커뮤니티 만들기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 커뮤니티 생성 성공 토스트 (화면 하단 중앙)     */}
      {/* ═══════════════════════════════════════════ */}
      {comSuccessToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-bounce">
          <div className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-black shadow-2xl">
            <Users className="h-4 w-4" />
            커뮤니티가 성공적으로 생성되었습니다! 🎉
          </div>
        </div>
      )}
    </div>
  );
}
