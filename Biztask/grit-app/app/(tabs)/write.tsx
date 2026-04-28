// 한글 주석: 가운데 탭 = 글쓰기 트리거 더미 화면
//
// ▣ 동작:
//   - 5탭 가운데 자리 차지용 더미 (실제 화면 X)
//   - tabBarButton에서 onPress가 가로채서 /post/new 모달로 push
//   - 이 화면이 직접 렌더되는 일은 거의 없지만,
//     혹시라도 라우팅 꼬여서 들어오면 자동으로 /post/new로 redirect
//
// ▣ 왜 더미 파일이 필요한가:
//   - expo-router는 Tabs.Screen의 name이 (tabs)/ 안 파일명과 매칭돼야 함
//   - 따라서 가운데 탭 자리에 빈 파일이라도 있어야 라우터 등록됨

import { Redirect } from 'expo-router'

export default function WriteTabPlaceholder() {
  // 한글 주석: 안전망 - 직접 진입 시 글쓰기 모달로
  return <Redirect href={'/post/new' as any} />
}
