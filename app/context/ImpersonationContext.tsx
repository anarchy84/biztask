// 파일 위치: app/context/ImpersonationContext.tsx
// 용도: 빙의(Impersonation) 전역 상태 관리
// 기능: 어드민이 NPC 페르소나로 "빙의"하여 글/댓글을 작성할 수 있는 시스템
// 보안: VIP(어드민)만 빙의 가능, Header에 빙의 상태 배너 표시
// 상태: 현재 빙의 중인 페르소나 정보를 앱 전역에서 접근 가능

"use client";

import { createContext, useContext, useState, useCallback } from "react";

// ─── 빙의용 페르소나 타입 (최소 필요 정보만) ───
// 전체 Persona 타입에서 빙의에 필요한 핵심 필드만 추출
export type ImpersonatedPersona = {
  id: string;          // 페르소나 고유 ID (= author_id로 사용)
  user_id: string;     // 페르소나에 연결된 Supabase user ID
  nickname: string;    // 빙의 배너에 표시할 닉네임
  avatar_url: string | null;  // 아바타 이미지 URL
  industry: string;    // 업종 태그 (배너 표시용)
  personality: string; // 성격 태그 (배너 표시용)
};

// ─── Context 타입 정의 ───
type ImpersonationContextType = {
  // 현재 빙의 중인 페르소나 (null이면 일반 모드)
  impersonating: ImpersonatedPersona | null;

  // 빙의 시작: 페르소나 정보를 받아서 전역 상태에 저장
  startImpersonation: (persona: ImpersonatedPersona) => void;

  // 빙의 해제: 원래 계정으로 복귀
  stopImpersonation: () => void;

  // 빙의 중인지 여부 (편의 함수)
  isImpersonating: boolean;
};

// ─── Context 생성 (기본값은 빙의 없음) ───
const ImpersonationContext = createContext<ImpersonationContextType>({
  impersonating: null,
  startImpersonation: () => {},
  stopImpersonation: () => {},
  isImpersonating: false,
});

// ─── Provider 컴포넌트 ───
// app/layout.tsx에서 <body> 내부를 감싸서 전역 사용
export function ImpersonationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // 빙의 상태: null이면 일반 모드, 값이 있으면 해당 NPC로 빙의 중
  const [impersonating, setImpersonating] =
    useState<ImpersonatedPersona | null>(null);

  // 빙의 시작 핸들러
  const startImpersonation = useCallback((persona: ImpersonatedPersona) => {
    setImpersonating(persona);
  }, []);

  // 빙의 해제 핸들러
  const stopImpersonation = useCallback(() => {
    setImpersonating(null);
  }, []);

  return (
    <ImpersonationContext.Provider
      value={{
        impersonating,
        startImpersonation,
        stopImpersonation,
        isImpersonating: impersonating !== null,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

// ─── 커스텀 훅: 어디서든 빙의 상태에 접근 ───
// 사용법: const { impersonating, isImpersonating } = useImpersonation();
export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error(
      "useImpersonation은 ImpersonationProvider 안에서만 사용 가능합니다."
    );
  }
  return context;
}
