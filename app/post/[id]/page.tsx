// 파일 위치: app/post/[id]/page.tsx
// 용도: 게시글 상세 페이지 - 서버 컴포넌트 (동적 SEO 메타데이터 생성)
// generateMetadata로 카카오톡/슬랙 공유 시 게시글 제목+본문 미리보기 제공
// 실제 UI 렌더링은 PostDetailClient.tsx (클라이언트 컴포넌트)에서 처리

import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import PostDetailClient from "./PostDetailClient";

// ─── 동적 메타데이터 생성 (서버에서 실행) ───
// 카카오톡/슬랙 등에 링크 공유 시 해당 게시글의 제목과 본문 요약이 미리보기 카드에 표시됨
type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Next.js 최신 버전에서는 params가 Promise이므로 await 필수
  const { id } = await params;

  // 서버사이드 Supabase 클라이언트로 게시글 조회
  const supabase = createServerSupabaseClient();
  const { data: post } = await supabase
    .from("posts")
    .select("title, content, category")
    .eq("id", id)
    .single();

  // 게시글이 없으면 기본 메타데이터 반환
  if (!post) {
    return {
      title: "게시글을 찾을 수 없습니다",
      description: "삭제되었거나 존재하지 않는 게시글입니다.",
    };
  }

  // 본문 앞 80자를 요약하여 description 생성
  const description =
    post.content.length > 80
      ? post.content.slice(0, 80) + "..."
      : post.content;

  // 카테고리를 포함한 제목 형태: "[사업] 게시글 제목"
  const fullTitle = `[${post.category}] ${post.title}`;

  return {
    title: fullTitle,
    description,
    openGraph: {
      type: "article",
      locale: "ko_KR",
      siteName: "BizTask",
      title: fullTitle,
      description,
      images: [
        {
          url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=630&fit=crop&q=80",
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=630&fit=crop&q=80",
      ],
    },
  };
}

// ─── 페이지 컴포넌트 (클라이언트 컴포넌트를 렌더링) ───
export default function PostDetailPage() {
  return <PostDetailClient />;
}
