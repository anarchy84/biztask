// 파일 위치: app/layout.tsx
// 용도: 전체 앱의 루트 레이아웃 + 전역 SEO 메타데이터 (Open Graph, Twitter Card)
// Header 컴포넌트를 불러와서 로그인 상태에 따라 UI가 자동으로 변경됩니다.

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/app/components/Header";
import ClientProviders from "@/app/components/ClientProviders";
import "./globals.css";

// Google 폰트 설정 (Geist 산세리프 + 모노스페이스)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ─── 전역 SEO 메타데이터 (카카오톡/슬랙 공유 시 미리보기 카드 표시) ───
export const metadata: Metadata = {
  // 기본 타이틀 + 템플릿 (하위 페이지에서 title만 바꾸면 "제목 | BizTask" 형태로 표시)
  title: {
    default: "BizTask - 비즈니스 프로들의 힙한 커뮤니티",
    template: "%s | BizTask",
  },
  description:
    "사업, 마케팅, 커리어 성장을 위한 실전 노하우와 인사이트를 나누세요. 스타트업, 마케팅, 이직 정보를 솔직하게 공유하는 익명 비즈니스 커뮤니티.",
  keywords: [
    "비즈니스 커뮤니티",
    "스타트업",
    "마케팅",
    "커리어",
    "이직",
    "사업",
    "익명 커뮤니티",
    "BizTask",
  ],

  // Open Graph — 카카오톡, 페이스북, 슬랙 등에서 링크 미리보기
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "BizTask",
    title: "BizTask - 비즈니스 프로들의 힙한 커뮤니티",
    description:
      "사업, 마케팅, 커리어 성장을 위한 실전 노하우와 인사이트를 나누세요.",
    images: [
      {
        url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=630&fit=crop&q=80",
        width: 1200,
        height: 630,
        alt: "BizTask - 비즈니스 프로들의 힙한 커뮤니티",
      },
    ],
  },

  // Twitter Card — 트위터/X 공유 시 큰 이미지 카드
  twitter: {
    card: "summary_large_image",
    title: "BizTask - 비즈니스 프로들의 힙한 커뮤니티",
    description:
      "사업, 마케팅, 커리어 성장을 위한 실전 노하우와 인사이트를 나누세요.",
    images: [
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=630&fit=crop&q=80",
    ],
  },

  // 검색엔진 로봇 설정
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        {/* 전역 Client Provider (빙의 시스템 등) */}
        <ClientProviders>
          {/* 상단 네비게이션 바 (로그인 상태 자동 감지) */}
          <Header />

          {/* 메인 콘텐츠 영역 (각 페이지가 여기에 렌더링됨) */}
          <main className="flex-1">{children}</main>
        </ClientProviders>
      </body>
    </html>
  );
}
