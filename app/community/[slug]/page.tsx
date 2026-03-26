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
  const { slug } = await params;

  const supabase = createServerSupabaseClient();

  // slug 또는 id로 커뮤니티 조회
  const { data: community } = await supabase
    .from("communities")
    .select("name, description, member_count")
    .or(`slug.eq.${slug},id.eq.${slug}`)
    .single();

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
  const { slug } = await params;
  return <CommunityClient slug={slug} />;
}
