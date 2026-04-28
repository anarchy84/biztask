// 그릿 — Sample feed data (realistic Korean small business owner content)

const SAMPLE_POSTS = [
  {
    id: 1,
    relation: "아나키 님과 다른 3명이 팔로우합니다",
    user: { name: "미식가라이언", hue: 280, verified: true,
      tags: [
        { label: "마포구 · 요식업" },
        { label: "3년차" },
      ] },
    time: "2h",
    body: "임대료 협상 후기 공유합니다. 인상률 8% 통보받고 처음엔 멘붕이었는데, 주변 시세 자료 + 코로나 이후 매출 데이터 + 인근 공실률까지 정리해서 들고 갔더니 4.5%에서 합의 봤어요.\n\n핵심은 '나도 떠날 수 있다'는 카드를 진짜처럼 보이게 만드는 것. 다른 점포 답사 사진까지 찍어뒀습니다.",
    stats: { comments: 47, reposts: 23, likes: 312 },
    liked: true,
  },
  {
    id: 2,
    relation: "내 팔로워 8명이 추천했습니다",
    user: { name: "을지로프린스", hue: 220, verified: true,
      tags: [
        { label: "을지로 · 인쇄업" },
        { label: "12년차" },
      ] },
    time: "4h",
    body: "POS 교체하면서 알게 된 거. 카드사 수수료 0.3% 차이가 1년이면 우리 가게 기준 280만원이에요. 진짜로.\n\n계산기 두드려보고 옮기세요. DM 주시면 비교표 공유합니다.",
    image: { aspect: "16/10", label: "수수료 비교표 캡처" },
    stats: { comments: 89, reposts: 156, likes: 743 },
  },
  {
    id: 3,
    user: { name: "F&B-103", hue: 340, verified: false,
      tags: [
        { label: "성수동 · 카페" },
      ] },
    time: "6h",
    body: "주방 알바 면접 보는데 '4대보험 안 되면 오히려 좋아요'라는 분 처음 봤음. 신선했다.",
    stats: { comments: 134, reposts: 12, likes: 421 },
  },
  {
    id: 4,
    relation: "팔로우하는 까칠한여우 님이 인용했습니다",
    user: { name: "강남숯불왕", hue: 30, verified: true,
      tags: [
        { label: "강남 · 고깃집" },
        { label: "프리미엄" },
      ] },
    time: "8h",
    body: "B2B 매칭으로 만난 도축장 사장님이랑 6개월째 거래 중인데, 단가 12% 줄고 등급은 올라감. 시크릿 라운지 진심 추천.",
    quoted: {
      name: "까칠한여우", hue: 0, verified: true, time: "1d",
      body: "사장님들끼리 서로 공급망 추천해주는 게 결국 제일 신뢰도 높아요. 후기 모아보면 어디가 진짜인지 보임.",
    },
    stats: { comments: 28, reposts: 67, likes: 198 },
  },
  {
    id: 5,
    user: { name: "리테일러7", hue: 160, verified: false,
      tags: [
        { label: "용산 · 의류" },
      ] },
    time: "12h",
    body: "오늘 매출이 어제 매출의 3배인데 이게 좋은 건가 슬픈 건가. 둘 다인 듯.",
    stats: { comments: 56, reposts: 4, likes: 167 },
  },
];

const TRENDING = [
  { tag: "임대료협상", count: "1,247", change: "+340%", region: "전국" },
  { tag: "최저시급2026", count: "892", change: "+128%", region: "전국" },
  { tag: "성수동상권", count: "456", change: "+62%", region: "서울" },
  { tag: "POS수수료", count: "287", change: "+45%", region: "전국" },
  { tag: "인테리어비용", count: "234", change: "+22%", region: "전국" },
];

const SUGGESTED_USERS = [
  { name: "압구정바리스타", hue: 50, tag: "강남 · 카페", verified: true,
    mutual: 12, grit: 91 },
  { name: "동대문빅마마", hue: 320, tag: "동대문 · 도소매", verified: true,
    mutual: 7, grit: 88 },
  { name: "B2B-447", hue: 200, tag: "송파 · 유통", verified: false,
    mutual: 4, grit: 76 },
  { name: "까칠한여우", hue: 0, tag: "홍대 · 펍", verified: true,
    mutual: 23, grit: 94 },
];

Object.assign(window, { SAMPLE_POSTS, TRENDING, SUGGESTED_USERS });
