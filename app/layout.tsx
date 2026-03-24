// 파일 위치: app/layout.tsx
// 용도: 전체 앱의 루트 레이아웃
// Header 컴포넌트를 불러와서 로그인 상태에 따라 UI가 자동으로 변경됩니다.

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/app/components/Header";
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

// 페이지 메타데이터 (브라우저 탭에 표시되는 제목 등)
export const metadata: Metadata = {
  title: "BizTask - 익명 비즈니스 커뮤니티",
  description: "스타트업, 마케팅, 커리어에 대해 자유롭게 이야기하는 익명 커뮤니티",
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
        {/* 상단 네비게이션 바 (로그인 상태 자동 감지) */}
        <Header />

        {/* 메인 콘텐츠 영역 (각 페이지가 여기에 렌더링됨) */}
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
