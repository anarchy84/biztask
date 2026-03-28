// 파일 위치: app/components/ClientProviders.tsx
// 용도: 클라이언트 사이드 Context Provider들을 모아서 감싸는 래퍼
// 이유: app/layout.tsx가 Server Component(metadata export)라서
//       "use client" Provider를 직접 넣을 수 없음
//       → 이 래퍼 컴포넌트로 분리하여 해결
// 추후 다른 전역 Provider가 추가되면 여기에 같이 추가하면 됩니다.

"use client";

import { ImpersonationProvider } from "@/app/context/ImpersonationContext";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 빙의(Impersonation) 전역 상태 Provider
    // 앱 전체에서 useImpersonation() 훅으로 접근 가능
    <ImpersonationProvider>{children}</ImpersonationProvider>
  );
}
