-- ═══════════════════════════════════════════════════════
-- NPC 닉네임 복구 SQL (익명사업자 → 정상 닉네임)
-- 날짜: 2026-03-31
-- 원인: Supabase auth trigger가 auth.users INSERT 시
--       자동으로 profiles에 "익명사업자" + UUID 앞4자리로 생성
--       → 이후 ON CONFLICT (id) DO NOTHING이라 정상 닉네임 INSERT가 무시됨
-- 해결: email로 user_id를 찾아서 profiles.nickname을 UPDATE
--
-- 실행: Supabase 대시보드 → SQL Editor → 전체 복붙 → Run!
-- ═══════════════════════════════════════════════════════

-- ─── 1. AI NPC 8명 닉네임 복구 ───
UPDATE public.profiles SET nickname = '헤비업로더'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_heavy_uploader@biztask.bot');

UPDATE public.profiles SET nickname = '인사이트호소인'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_insight_dealer@biztask.bot');

UPDATE public.profiles SET nickname = '프로불편러'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_pro_complainer@biztask.bot');

UPDATE public.profiles SET nickname = 'AGI만세'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_agi_manse@biztask.bot');

UPDATE public.profiles SET nickname = 'ㄷㄷ형님들'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_dd_brothers@biztask.bot');

UPDATE public.profiles SET nickname = 'AI궁금한사장'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_ai_curious_boss@biztask.bot');

UPDATE public.profiles SET nickname = '프롬프트좀요'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_prompt_please@biztask.bot');

UPDATE public.profiles SET nickname = '쉽게설명좀'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_easy_explain@biztask.bot');

-- ─── 2. 왕초보 질문빌런 11명 닉네임 복구 ───
UPDATE public.profiles SET nickname = '낙타를타조로'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_camel_ostrich@biztask.bot');

UPDATE public.profiles SET nickname = '돈까스김밥'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_donkatsu_kimbap@biztask.bot');

UPDATE public.profiles SET nickname = '벤츠타는궁수'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_benz_archer@biztask.bot');

UPDATE public.profiles SET nickname = '에반참치'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_evan_tuna@biztask.bot');

UPDATE public.profiles SET nickname = '팬티엄4'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_pentium4@biztask.bot');

UPDATE public.profiles SET nickname = '이천쌀밥'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_icheon_rice@biztask.bot');

UPDATE public.profiles SET nickname = '아이스베어'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_ice_bear@biztask.bot');

UPDATE public.profiles SET nickname = '코카콜라제로'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_cola_zero@biztask.bot');

UPDATE public.profiles SET nickname = '12움3456'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_12um3456@biztask.bot');

UPDATE public.profiles SET nickname = '아버님성함'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_father_name@biztask.bot');

UPDATE public.profiles SET nickname = '배틀메easy'
WHERE id = (SELECT id FROM auth.users WHERE email = 'npc_battle_easy@biztask.bot');

-- ─── 3. personas 테이블도 동기화 (혹시 닉네임이 안 맞을 경우) ───
-- personas는 user_id로 조인하므로 profiles만 고치면 되지만,
-- 혹시 모르니 personas.nickname도 함께 업데이트
UPDATE public.personas SET nickname = '헤비업로더'     WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_heavy_uploader@biztask.bot');
UPDATE public.personas SET nickname = '인사이트호소인' WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_insight_dealer@biztask.bot');
UPDATE public.personas SET nickname = '프로불편러'     WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_pro_complainer@biztask.bot');
UPDATE public.personas SET nickname = 'AGI만세'       WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_agi_manse@biztask.bot');
UPDATE public.personas SET nickname = 'ㄷㄷ형님들'     WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_dd_brothers@biztask.bot');
UPDATE public.personas SET nickname = 'AI궁금한사장'   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_ai_curious_boss@biztask.bot');
UPDATE public.personas SET nickname = '프롬프트좀요'   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_prompt_please@biztask.bot');
UPDATE public.personas SET nickname = '쉽게설명좀'     WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_easy_explain@biztask.bot');

UPDATE public.personas SET nickname = '낙타를타조로'   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_camel_ostrich@biztask.bot');
UPDATE public.personas SET nickname = '돈까스김밥'     WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_donkatsu_kimbap@biztask.bot');
UPDATE public.personas SET nickname = '벤츠타는궁수'   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_benz_archer@biztask.bot');
UPDATE public.personas SET nickname = '에반참치'       WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_evan_tuna@biztask.bot');
UPDATE public.personas SET nickname = '팬티엄4'       WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_pentium4@biztask.bot');
UPDATE public.personas SET nickname = '이천쌀밥'       WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_icheon_rice@biztask.bot');
UPDATE public.personas SET nickname = '아이스베어'     WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_ice_bear@biztask.bot');
UPDATE public.personas SET nickname = '코카콜라제로'   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_cola_zero@biztask.bot');
UPDATE public.personas SET nickname = '12움3456'      WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_12um3456@biztask.bot');
UPDATE public.personas SET nickname = '아버님성함'     WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_father_name@biztask.bot');
UPDATE public.personas SET nickname = '배틀메easy'    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'npc_battle_easy@biztask.bot');

-- ═══════════════════════════════════════════════════════
-- 확인 쿼리 (선택사항)
-- ═══════════════════════════════════════════════════════
-- 닉네임 복구 확인:
-- SELECT p.nickname, au.email
-- FROM profiles p
-- JOIN auth.users au ON au.id = p.id
-- WHERE au.email LIKE '%@biztask.bot'
-- ORDER BY p.nickname;
