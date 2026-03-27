// 파일 위치: app/community/[slug]/page.tsx
// 용도: 커뮤니티 전용 페이지 - 서버 컴포넌트 (동적 SEO 메타데이터)
// 레딧 서브레딧 스타일: 배너 + 커뮤니티 정보 + 게시글 피드
// 카카오톡/슬랙 공유 시 커뮤니티 이름과 설명이 미리보기에 표시됨

import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import CommunityClient from "./CommunityClient";

// ─── 동적 메타데이터 생성 (서버에서 실행) ───
type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  // URL 인코딩된 한글 slug를 원래 문자열로 복원
  // 예: "%ED%85%8C%EC%8A%A4%ED%8A%B8" → "테스트"
  const slug = decodeURIComponent(rawSlug);

  const supabase = createServerSupabaseClient();

  // slug 또는 id로 커뮤니티 조회 (.eq 개별 체인으로 안전하게)
  let community = null;
  const { data: bySlug } = await supabase
    .from("communities")
    .select("name, description, member_count")
    .eq("slug", slug)
    .maybeSingle();

  if (bySlug) {
    community = bySlug;
  } else {
    // slug로 못 찾으면 id로 한번 더 시도 (폴백)
    const { data: byId } = await supabase
      .from("communities")
      .select("name, description, member_count")
      .eq("id", slug)
      .maybeSingle();
    community = byId;
  }

  if (!community) {
    return {
      title: "커뮤니티를 찾을 수 없습니다",
      description: "삭제되었거나 존재하지 않는 커뮤니티입니다.",
    };
  }

  const description = community.description || `${community.name} 커뮤니티 - ${community.member_count}명의 멤버`;

  return {
    title: `${community.name} - BizTask 커뮤니티`,
    description,
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: "BizTask",
      title: `${community.name} - BizTask 커뮤니티`,
      description,
    },
  };
}

// ─── 페이지 컴포넌트 ───
export default async function CommunityPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  // 한글 slug 디코딩 후 클라이언트 컴포넌트에 전달
  const slug = decodeURIComponent(rawSlug);
  return <CommunityClient slug={slug} />;
}
