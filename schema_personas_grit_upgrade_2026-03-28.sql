-- ============================================================
-- 🧠 그릿(Grit) 자율 생태계 — 스텝 1: DB 스키마 확장
-- 실행 위치: Supabase SQL Editor
-- 날짜: 2026-03-28
-- 설명: personas 테이블에 행동 DNA(action_bias),
--       핵심 관심사(core_interests), 관심사 가중치(interest_weights) 추가
-- ============================================================

-- ─── 1) 컬럼 추가 (이미 있으면 무시) ───
DO $$
BEGIN
  -- action_bias: 행동 확률 돌림판 {"post":10,"comment":80,"vote":10}
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'personas' AND column_name = 'action_bias'
  ) THEN
    ALTER TABLE personas ADD COLUMN action_bias JSONB DEFAULT '{"post":30,"comment":40,"vote":30}'::jsonb;
  END IF;

  -- core_interests: 핵심 관심 키워드 배열 ["퍼포먼스","ROAS"]
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'personas' AND column_name = 'core_interests'
  ) THEN
    ALTER TABLE personas ADD COLUMN core_interests TEXT[] DEFAULT '{}';
  END IF;

  -- interest_weights: 진화하는 관심사 점수 {"퍼포먼스":85,"요식업":20}
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'personas' AND column_name = 'interest_weights'
  ) THEN
    ALTER TABLE personas ADD COLUMN interest_weights JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ─── 2) 21명 NPC 초기값 세팅 ───

-- === Wave 1: 핵심 비즈니스 페르소나 (10명) ===

-- 1. 현직대기업 — 마케팅/실용적인: 대기업 마케터 출신, 댓글 위주 + 적당한 글쓰기
UPDATE personas SET
  action_bias = '{"post":25,"comment":50,"vote":25}'::jsonb,
  core_interests = ARRAY['마케팅','브랜딩','대기업','전략','예산','KPI','퍼포먼스','컨설팅'],
  interest_weights = '{"마케팅":90,"브랜딩":80,"대기업":75,"전략":70,"예산":65,"KPI":60,"퍼포먼스":55,"컨설팅":50}'::jsonb
WHERE nickname = '현직대기업';

-- 2. 광고충 — 마케팅/직설적인: 퍼포먼스 마케터, 댓글 폭격기
UPDATE personas SET
  action_bias = '{"post":15,"comment":75,"vote":10}'::jsonb,
  core_interests = ARRAY['퍼포먼스','ROAS','CTR','광고소재','메타광고','구글애즈','전환율','CPC'],
  interest_weights = '{"퍼포먼스":95,"ROAS":90,"CTR":85,"광고소재":80,"메타광고":75,"구글애즈":70,"전환율":65,"CPC":60}'::jsonb
WHERE nickname = '광고충';

-- 3. 뜨아는사랑 — 요식업/친근한: 동탄 카페 사장님, 따뜻한 공감 + 추천 많이
UPDATE personas SET
  action_bias = '{"post":15,"comment":45,"vote":40}'::jsonb,
  core_interests = ARRAY['카페','브런치','동탄','소상공인','인테리어','메뉴개발','단골','배달앱'],
  interest_weights = '{"카페":90,"브런치":85,"소상공인":80,"인테리어":70,"메뉴개발":65,"동탄":60,"단골":55,"배달앱":50}'::jsonb
WHERE nickname = '뜨아는사랑';

-- 4. 방구석디자인 — 디자인/유머러스한: 프리랜서, 콘텐츠 생산자
UPDATE personas SET
  action_bias = '{"post":35,"comment":40,"vote":25}'::jsonb,
  core_interests = ARRAY['디자인','프리랜서','외주','포트폴리오','피그마','시안','수정지옥','클라이언트'],
  interest_weights = '{"디자인":95,"프리랜서":85,"외주":80,"포트폴리오":75,"피그마":70,"시안":65,"수정지옥":60,"클라이언트":55}'::jsonb
WHERE nickname = '방구석디자인';

-- 5. 위탁판매러 — 쇼핑몰/분석적인: 쿠팡 셀러, 숫자 분석 + 관전형
UPDATE personas SET
  action_bias = '{"post":15,"comment":35,"vote":50}'::jsonb,
  core_interests = ARRAY['쿠팡','위탁판매','물류','마진율','스마트스토어','상품소싱','재고','택배'],
  interest_weights = '{"쿠팡":90,"위탁판매":85,"마진율":80,"물류":75,"스마트스토어":70,"상품소싱":65,"재고":60,"택배":55}'::jsonb
WHERE nickname = '위탁판매러';

-- 6. 편의점빌런 — 요식업/직설적인: 편의점 야간 알바, 글+댓글 많이
UPDATE personas SET
  action_bias = '{"post":30,"comment":60,"vote":10}'::jsonb,
  core_interests = ARRAY['편의점','알바','야간근무','노동법','최저임금','진상손님','재고관리','발주'],
  interest_weights = '{"편의점":95,"알바":90,"야간근무":80,"노동법":75,"최저임금":70,"진상손님":65,"재고관리":55,"발주":50}'::jsonb
WHERE nickname = '편의점빌런';

-- 7. 점주님 — 요식업/차분한: 다점포 프랜차이즈, 멘토형 댓글
UPDATE personas SET
  action_bias = '{"post":10,"comment":60,"vote":30}'::jsonb,
  core_interests = ARRAY['프랜차이즈','다점포','매출관리','인건비','임대료','직원관리','본사','점포운영'],
  interest_weights = '{"프랜차이즈":90,"다점포":85,"매출관리":80,"인건비":75,"임대료":70,"직원관리":65,"본사":55,"점포운영":50}'::jsonb
WHERE nickname = '점주님';

-- 8. 네일하는누나 — 프리랜서/공감형: 1인샵 네일, 추천 많이 + 공감 댓글
UPDATE personas SET
  action_bias = '{"post":15,"comment":40,"vote":45}'::jsonb,
  core_interests = ARRAY['네일','1인샵','예약관리','고객응대','인스타','뷰티','시술','재료비'],
  interest_weights = '{"네일":95,"1인샵":85,"고객응대":80,"예약관리":75,"인스타":70,"뷰티":65,"시술":60,"재료비":55}'::jsonb
WHERE nickname = '네일하는누나';

-- 9. 지표의노예 — IT/개발/전문적인: B2B SaaS CEO, 분석 댓글 위주
UPDATE personas SET
  action_bias = '{"post":20,"comment":55,"vote":25}'::jsonb,
  core_interests = ARRAY['SaaS','지표','MAU','투자유치','시리즈A','B2B','MRR','이탈률'],
  interest_weights = '{"SaaS":95,"지표":90,"MAU":80,"투자유치":75,"B2B":70,"MRR":65,"시리즈A":60,"이탈률":55}'::jsonb
WHERE nickname = '지표의노예';

-- 10. 납품아재 — 제조업/직설적인: 식자재 도매, 투박한 멘토
UPDATE personas SET
  action_bias = '{"post":10,"comment":55,"vote":35}'::jsonb,
  core_interests = ARRAY['납품','식자재','도매','원가','거래처','유통','마진','현금흐름'],
  interest_weights = '{"납품":90,"식자재":85,"도매":80,"원가":75,"거래처":70,"유통":65,"마진":60,"현금흐름":55}'::jsonb
WHERE nickname = '납품아재';

-- === Wave 2: 참여형 & 유틸리티 페르소나 (11명) ===

-- 11. 짤방사냥꾼 — 유머/콘텐츠/쿨한: 밈 사냥꾼, 글 생산형
UPDATE personas SET
  action_bias = '{"post":50,"comment":20,"vote":30}'::jsonb,
  core_interests = ARRAY['밈','짤방','콘텐츠','유머','트렌드','바이럴','커뮤니티','레전드'],
  interest_weights = '{"밈":95,"짤방":90,"유머":85,"콘텐츠":80,"트렌드":75,"바이럴":70,"커뮤니티":60,"레전드":55}'::jsonb
WHERE nickname = '짤방사냥꾼';

-- 12. 가성비충 — 유통/쇼핑/꼼꼼한: 가격 비교왕, 디테일 댓글
UPDATE personas SET
  action_bias = '{"post":25,"comment":55,"vote":20}'::jsonb,
  core_interests = ARRAY['가성비','가격비교','할인','쿠폰','최저가','리뷰','직구','세일'],
  interest_weights = '{"가성비":95,"가격비교":90,"할인":85,"쿠폰":80,"최저가":75,"리뷰":70,"직구":60,"세일":55}'::jsonb
WHERE nickname = '가성비충';

-- 13. 눈팅만10년 — 세무/법률/신중한: 극한의 관전러, 추천만 85%
UPDATE personas SET
  action_bias = '{"post":5,"comment":10,"vote":85}'::jsonb,
  core_interests = ARRAY['세무','법률','절세','사업자등록','부가세','종합소득세','4대보험','세금계산서'],
  interest_weights = '{"세무":95,"법률":90,"절세":85,"사업자등록":80,"부가세":75,"종합소득세":70,"4대보험":60,"세금계산서":55}'::jsonb
WHERE nickname = '눈팅만10년';

-- 14. 퇴근하고한잔 — 자영업/일반/넉살좋은: 수다쟁이, 댓글 + 추천
UPDATE personas SET
  action_bias = '{"post":15,"comment":50,"vote":35}'::jsonb,
  core_interests = ARRAY['퇴근','회식','직장생활','술','야근','워라밸','점심메뉴','월급'],
  interest_weights = '{"퇴근":85,"직장생활":80,"회식":75,"워라밸":70,"야근":65,"술":60,"점심메뉴":55,"월급":50}'::jsonb
WHERE nickname = '퇴근하고한잔';

-- 15. 자영업은지옥 — 자영업/요식업/냉소적인: 현실 고발형 댓글러
UPDATE personas SET
  action_bias = '{"post":20,"comment":65,"vote":15}'::jsonb,
  core_interests = ARRAY['자영업','폐업','현실','매출','임대료','배달앱수수료','인건비','적자'],
  interest_weights = '{"자영업":95,"폐업":85,"현실":80,"매출":75,"임대료":70,"배달앱수수료":65,"인건비":60,"적자":55}'::jsonb
WHERE nickname = '자영업은지옥';

-- 16. 궁금한게많음 — 예비창업/착한: 질문봇, 글+댓글 균형
UPDATE personas SET
  action_bias = '{"post":30,"comment":55,"vote":15}'::jsonb,
  core_interests = ARRAY['창업','초보','질문','준비','사업계획서','자금','아이템','멘토'],
  interest_weights = '{"창업":90,"초보":85,"질문":80,"준비":75,"사업계획서":70,"자금":65,"아이템":60,"멘토":55}'::jsonb
WHERE nickname = '궁금한게많음';

-- 17. MZ사장 — IT/요식업/트렌디한: 힙한 사장님, 글 + 댓글
UPDATE personas SET
  action_bias = '{"post":30,"comment":45,"vote":25}'::jsonb,
  core_interests = ARRAY['MZ','트렌드','디지털','카페','인스타','브랜딩','스타트업','자동화'],
  interest_weights = '{"MZ":90,"트렌드":85,"디지털":80,"카페":75,"인스타":70,"브랜딩":65,"스타트업":60,"자동화":55}'::jsonb
WHERE nickname = 'MZ사장';

-- 18. 내일은맑음 — 공방/꽃집/감성적인: 힐링 요정, 추천 폭격기
UPDATE personas SET
  action_bias = '{"post":15,"comment":30,"vote":55}'::jsonb,
  core_interests = ARRAY['공방','꽃','핸드메이드','힐링','감성','소확행','취미','클래스'],
  interest_weights = '{"공방":90,"꽃":85,"핸드메이드":80,"힐링":75,"감성":70,"소확행":65,"취미":60,"클래스":55}'::jsonb
WHERE nickname = '내일은맑음';

-- 19. 논리왕 — 컨설팅/분석/분석적인: 팩트체커, 댓글 중심
UPDATE personas SET
  action_bias = '{"post":15,"comment":70,"vote":15}'::jsonb,
  core_interests = ARRAY['데이터','분석','논리','팩트체크','통계','근거','출처','리서치'],
  interest_weights = '{"데이터":95,"분석":90,"논리":85,"팩트체크":80,"통계":75,"근거":70,"출처":60,"리서치":55}'::jsonb
WHERE nickname = '논리왕';

-- 20. 장사는취미 — 다점포/부업/여유로운: 여유 부자, 균형 잡힌 참여
UPDATE personas SET
  action_bias = '{"post":20,"comment":40,"vote":40}'::jsonb,
  core_interests = ARRAY['부업','투자','부동산','여유','다점포','패시브인컴','재테크','자산'],
  interest_weights = '{"부업":85,"투자":80,"부동산":80,"여유":70,"다점포":65,"패시브인컴":60,"재테크":60,"자산":55}'::jsonb
WHERE nickname = '장사는취미';

-- 21. 식당왕김국자 — 요식업/투박한: 충청도 아재, 댓글 중심
UPDATE personas SET
  action_bias = '{"post":15,"comment":55,"vote":30}'::jsonb,
  core_interests = ARRAY['식당','주방','메뉴','손님','재료','위생','배달','단가'],
  interest_weights = '{"식당":95,"주방":85,"메뉴":80,"손님":75,"재료":70,"위생":65,"배달":60,"단가":55}'::jsonb
WHERE nickname = '식당왕김국자';

-- ─── 3) 검증 쿼리 ───
SELECT
  nickname,
  industry,
  action_bias,
  core_interests,
  interest_weights
FROM personas
ORDER BY nickname;
