// 파일 위치: app/mypage/page.tsx
// 용도: 마이페이지 - 레딧 다크 테마 적용
// 구성: 프로필 헤더 / 정보 수정 폼 / 내가 쓴 글·댓글 탭

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import {
  User,
  BadgeCheck,
  Pencil,
  X,
  Save,
  Loader2,
  FileText,
  MessageCircle,
  Phone,
  Mail,
  Building2,
  Briefcase,
  Heart,
  ArrowBigUp,
  Clock,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// ─── 프로필 타입 정의 ───
type Profile = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  bio: string;
  status_message: string;
  industry: string;
  company: string;
  phone: string;
  interests: string[];
  is_company_verified: boolean;
  is_business_verified: boolean;
  created_at: string;
};

// ─── 내가 쓴 글 타입 ───
type MyPost = {
  id: string;
  title: string;
  content: string;
  category: string;
  upvotes: number;
  comment_count: number;
  created_at: string;
};

// ─── 카테고리 색상 매핑 (다크 테마) ───
function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    사업: "bg-orange-500/20 text-orange-400",
    마케팅: "bg-purple-500/20 text-purple-400",
    커리어: "bg-green-500/20 text-green-400",
    자유: "bg-amber-500/20 text-amber-400",
  };
  return colorMap[category] || "bg-gray-500/20 text-gray-400";
}

// ─── 날짜 포맷 함수 ───
function timeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 30) return `${diffDay}일 전`;
  return `${Math.floor(diffDay / 30)}개월 전`;
}

// ─── 관심사 프리셋 목록 ───
const INTEREST_OPTIONS = [
  "스타트업", "마케팅", "투자", "개발", "디자인", "AI",
  "커머스", "콘텐츠", "HR", "재무", "법률", "부동산",
];

// ─── 업종 프리셋 목록 ───
const INDUSTRY_OPTIONS = [
  "IT/소프트웨어", "금융/핀테크", "커머스/유통", "교육/에듀테크",
  "F&B/외식", "제조업", "미디어/콘텐츠", "헬스케어", "부동산", "기타",
];

export default function MyPage() {
  // ─── 상태 관리 ───
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 수정 폼 상태
  const [editNickname, setEditNickname] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editStatusMessage, setEditStatusMessage] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editInterests, setEditInterests] = useState<string[]>([]);

  // 탭 상태
  const [activeTab, setActiveTab] = useState<"posts" | "comments">("posts");
  const [myPosts, setMyPosts] = useState<MyPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // 팔로워/팔로잉 숫자
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const router = useRouter();

  // ─── 프로필 데이터 불러오기 ───
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !data) {
      const defaultNickname =
        (await supabase.auth.getUser()).data.user?.email?.split("@")[0] || "익명";
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({ id: userId, nickname: defaultNickname })
        .select()
        .single();
      if (newProfile) setProfile(newProfile as Profile);
    } else {
      const profileData = {
        ...data,
        interests: data.interests || [],
        status_message: data.status_message || "",
        industry: data.industry || "",
        company: data.company || "",
        phone: data.phone || "",
        is_company_verified: data.is_company_verified || false,
        is_business_verified: data.is_business_verified || false,
      };
      setProfile(profileData as Profile);
    }
  }, []);

  // ─── 팔로워/팔로잉 숫자 불러오기 ───
  const fetchFollowCounts = useCallback(async (userId: string) => {
    const { count: followers } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId);

    const { count: following } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId);

    setFollowerCount(followers || 0);
    setFollowingCount(following || 0);
  }, []);

  // ─── 내가 쓴 글 불러오기 ───
  const fetchMyPosts = useCallback(async (userId: string) => {
    setPostsLoading(true);
    const { data } = await supabase
      .from("posts")
      .select("id, title, content, category, upvotes, comment_count, created_at")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    setMyPosts((data as MyPost[]) || []);
    setPostsLoading(false);
  }, []);

  // ─── 마운트 시 인증 확인 + 데이터 로드 ───
  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setUser(session.user);
      await Promise.all([
        fetchProfile(session.user.id),
        fetchFollowCounts(session.user.id),
        fetchMyPosts(session.user.id),
      ]);
      setAuthLoading(false);
    };

    init();
  }, [router, fetchProfile, fetchFollowCounts, fetchMyPosts]);

  // ─── 수정 모드 진입 시 현재 값으로 폼 채우기 ───
  const startEditing = () => {
    if (!profile) return;
    setEditNickname(profile.nickname);
    setEditBio(profile.bio || "");
    setEditStatusMessage(profile.status_message);
    setEditIndustry(profile.industry);
    setEditCompany(profile.company);
    setEditPhone(profile.phone);
    setEditInterests([...profile.interests]);
    setIsEditing(true);
    setError("");
    setSuccess("");
  };

  // ─── 관심사 토글 ───
  const toggleInterest = (interest: string) => {
    setEditInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : prev.length < 5
          ? [...prev, interest]
          : prev
    );
  };

  // ─── 프로필 저장 핸들러 ───
  const handleSave = async () => {
    if (!user) return;
    setError("");
    setSaving(true);

    if (!editNickname.trim()) {
      setError("닉네임을 입력해주세요.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        nickname: editNickname.trim(),
        bio: editBio.trim(),
        status_message: editStatusMessage.trim(),
        industry: editIndustry,
        company: editCompany.trim(),
        phone: editPhone.trim(),
        interests: editInterests,
      })
      .eq("id", user.id);

    if (updateError) {
      setError("저장에 실패했습니다: " + updateError.message);
    } else {
      setSuccess("프로필이 업데이트되었습니다.");
      setIsEditing(false);
      await fetchProfile(user.id);
      setTimeout(() => setSuccess(""), 3000);
    }

    setSaving(false);
  };

  // ─── 로딩 화면 ───
  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const avatarInitial = user?.email?.charAt(0).toUpperCase() || "?";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* ═══════════════════════════════════════════════════════ */}
      {/* 프로필 헤더 섹션 (다크 테마)                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="mb-6 rounded-xl border border-border-color bg-card-bg p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* 프로필 아바타 */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-orange-400 text-4xl font-bold text-white shadow-lg">
              {avatarInitial}
            </div>
          </div>

          {/* 프로필 정보 */}
          <div className="flex-1 min-w-0">
            <div className="mb-2 flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">
                {profile?.nickname || "익명"}
              </h1>

              {profile?.is_company_verified && (
                <span className="flex items-center gap-0.5 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400" title="회사 인증 완료">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  회사인증
                </span>
              )}

              {profile?.is_business_verified && (
                <span className="flex items-center gap-0.5 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400" title="사업자 인증 완료">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  사업자인증
                </span>
              )}

              {!profile?.is_company_verified && !profile?.is_business_verified && (
                <span className="text-xs text-muted">미인증</span>
              )}

              {!isEditing && (
                <button
                  onClick={startEditing}
                  className="ml-auto flex items-center gap-1 rounded-full border border-border-color px-3 py-1 text-sm font-medium text-muted hover:bg-hover-bg hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  프로필 수정
                </button>
              )}
            </div>

            {profile?.status_message && (
              <p className="mb-2 text-sm text-muted italic">
                &quot;{profile.status_message}&quot;
              </p>
            )}

            {profile?.bio && (
              <p className="mb-3 text-sm leading-relaxed text-foreground">
                {profile.bio}
              </p>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-muted">
              {profile?.industry && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {profile.industry}
                </span>
              )}
              {profile?.company && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {profile.company}
                </span>
              )}
            </div>

            <div className="flex gap-5 text-sm">
              <div className="text-center">
                <span className="font-bold text-foreground">{myPosts.length}</span>
                <span className="ml-1 text-muted">게시글</span>
              </div>
              <div className="text-center">
                <span className="font-bold text-foreground">{followerCount}</span>
                <span className="ml-1 text-muted">팔로워</span>
              </div>
              <div className="text-center">
                <span className="font-bold text-foreground">{followingCount}</span>
                <span className="ml-1 text-muted">팔로잉</span>
              </div>
            </div>

            {profile?.interests && profile.interests.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.interests.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    <Heart className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 프로필 수정 폼 (다크 테마)                               */}
      {/* ═══════════════════════════════════════════════════════ */}
      {isEditing && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">프로필 수정</h2>
            <button
              onClick={() => setIsEditing(false)}
              className="rounded-full p-1.5 text-muted hover:bg-hover-bg hover:text-foreground"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* 닉네임 */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <User className="h-4 w-4 text-muted" />
                닉네임
              </label>
              <input
                type="text"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                maxLength={20}
                className="w-full rounded-lg border border-border-color bg-input-bg px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* 상태 메시지 */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <MessageCircle className="h-4 w-4 text-muted" />
                상태 메시지
              </label>
              <input
                type="text"
                value={editStatusMessage}
                onChange={(e) => setEditStatusMessage(e.target.value)}
                placeholder="현재 상태를 한줄로 표현해보세요"
                maxLength={50}
                className="w-full rounded-lg border border-border-color bg-input-bg px-4 py-2.5 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* 자기소개 */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <FileText className="h-4 w-4 text-muted" />
                자기소개
              </label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="간단한 자기소개를 작성해보세요"
                rows={3}
                maxLength={200}
                className="w-full resize-none rounded-lg border border-border-color bg-input-bg px-4 py-2.5 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* 업종 + 회사 (2열) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Briefcase className="h-4 w-4 text-muted" />
                  업종
                </label>
                <select
                  value={editIndustry}
                  onChange={(e) => setEditIndustry(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-input-bg px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">선택하세요</option>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Building2 className="h-4 w-4 text-muted" />
                  회사명
                </label>
                <input
                  type="text"
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  placeholder="회사명 (선택)"
                  maxLength={30}
                  className="w-full rounded-lg border border-border-color bg-input-bg px-4 py-2.5 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* 이메일 (읽기 전용) + 휴대폰 (2열) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Mail className="h-4 w-4 text-muted" />
                  이메일
                </label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full rounded-lg border border-border-color bg-hover-bg px-4 py-2.5 text-sm text-muted"
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Phone className="h-4 w-4 text-muted" />
                  휴대폰
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  maxLength={13}
                  className="w-full rounded-lg border border-border-color bg-input-bg px-4 py-2.5 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* 관심사 태그 선택 */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Heart className="h-4 w-4 text-muted" />
                관심사 (최대 5개)
              </label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      editInterests.includes(interest)
                        ? "bg-primary text-white"
                        : "border border-border-color text-muted hover:border-primary hover:text-primary"
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            {/* 저장 / 취소 버튼 */}
            <div className="flex justify-end gap-3 border-t border-border-color pt-4">
              <button
                onClick={() => setIsEditing(false)}
                className="rounded-lg px-5 py-2.5 text-sm font-medium text-muted hover:bg-hover-bg hover:text-foreground"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    저장하기
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 완료 성공 메시지 */}
      {success && !isEditing && (
        <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          {success}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 하단 탭 섹션 (다크 테마)                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
        {/* 탭 헤더 */}
        <div className="flex border-b border-border-color">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${
              activeTab === "posts"
                ? "border-b-2 border-primary text-primary"
                : "text-muted hover:bg-hover-bg hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            내가 쓴 글
            <span className="rounded-full bg-hover-bg px-2 py-0.5 text-xs">
              {myPosts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("comments")}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${
              activeTab === "comments"
                ? "border-b-2 border-primary text-primary"
                : "text-muted hover:bg-hover-bg hover:text-foreground"
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            내가 단 댓글
            <span className="rounded-full bg-hover-bg px-2 py-0.5 text-xs">
              0
            </span>
          </button>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="p-4">
          {activeTab === "posts" && (
            <>
              {postsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : myPosts.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="mx-auto mb-3 h-10 w-10 text-muted" />
                  <p className="mb-1 text-sm font-medium text-foreground">
                    아직 작성한 글이 없습니다
                  </p>
                  <p className="mb-4 text-xs text-muted">
                    첫 번째 글을 작성해보세요!
                  </p>
                  <a
                    href="/submit"
                    className="inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
                  >
                    글쓰기
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  {myPosts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-lg border border-border-color p-3 hover:border-muted cursor-pointer transition-colors"
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs">
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${getCategoryColor(post.category)}`}
                        >
                          {post.category}
                        </span>
                        <span className="flex items-center gap-1 text-muted">
                          <Clock className="h-3 w-3" />
                          {timeAgo(post.created_at)}
                        </span>
                      </div>
                      <h3 className="mb-1 text-sm font-semibold text-foreground">
                        {post.title}
                      </h3>
                      <p className="mb-2 line-clamp-1 text-xs text-muted">
                        {post.content}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <ArrowBigUp className="h-3.5 w-3.5" />
                          {post.upvotes}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3.5 w-3.5" />
                          {post.comment_count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "comments" && (
            <div className="py-12 text-center">
              <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted" />
              <p className="mb-1 text-sm font-medium text-foreground">
                댓글 기능 준비 중
              </p>
              <p className="text-xs text-muted">
                다음 업데이트에서 댓글 기능이 추가될 예정입니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
