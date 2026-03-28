// 파일 위치: next.config.ts
// 용도: Next.js 프로젝트 전역 설정
// Supabase Storage 외부 이미지 도메인 허용 (next/image 사용을 위해 필수)
// ⚠️ 이 파일 수정 후 반드시 서버 재시작 필요 (npm run dev 중지 후 재실행)

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ─── 외부 이미지 도메인 허용 설정 ───
  // Next.js의 <Image> 컴포넌트로 외부 URL 이미지를 사용하려면
  // remotePatterns에 해당 도메인을 등록해야 함
  images: {
    remotePatterns: [
      {
        // Supabase Storage 이미지 (프로필 아바타, 게시글 첨부 이미지)
        // search 필드 생략 → 쿼리 파라미터(?t=...) 포함 URL도 허용
        protocol: "https",
        hostname: "dqyfrzrqfhdxwgokrwii.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Unsplash 이미지 (OG 메타 이미지 등에 사용)
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
