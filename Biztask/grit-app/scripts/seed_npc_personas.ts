import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

type Industry = 'cafe' | 'food' | 'beauty' | 'retail' | 'online' | 'service' | 'education' | 'health' | 'creative' | 'etc'
type Tier = 'guest' | 'general' | 'verified' | 'blue'
type Category =
  | 'humor'
  | 'worry'
  | 'question'
  | 'tip'
  | 'secret_staffing'
  | 'secret_cost'
  | 'secret_property'
  | 'secret_trouble'

interface PersonaSeed {
  slug: string
  displayName: string
  tone: string
  industry: Industry
  region: string
  yearsInBusiness: number
  tier: Tier
  primaryCategories: Category[]
  categoryWeights: Record<Category, number>
  postFreqPerDay: number
  commentFreqPerDay: number
  voteFreqPerDay: number
  activeHours: number[]
  gritScore: number
  notes: string
}

const CATEGORIES: Category[] = [
  'humor',
  'worry',
  'question',
  'tip',
  'secret_staffing',
  'secret_cost',
  'secret_property',
  'secret_trouble',
]

// 한글 주석: .env.local을 직접 읽어 npx tsx 실행만으로 seed가 가능하게 한다.
loadEnv('.env.local')
loadEnv('.env')

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL(or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const seeds: PersonaSeed[] = [
  {
    slug: 'apgujeong_barista',
    displayName: '압구정바리스타',
    tone: '차분하고 숫자보다 현장 감각을 먼저 말한다. 커피/상권 얘기는 구체적이고 짧게 끊는다.',
    industry: 'cafe',
    region: '강남구',
    yearsInBusiness: 7,
    tier: 'verified',
    primaryCategories: ['tip', 'question', 'worry'],
    categoryWeights: weights({ tip: 1.0, question: 0.75, worry: 0.7, humor: 0.25, secret_cost: 0.4, secret_staffing: 0.25 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 5,
    voteFreqPerDay: 12,
    activeHours: [8, 9, 12, 13, 21, 22],
    gritScore: 86,
    notes: '카페 원가, 회전율, 단골 관리에 강한 7년차 사장님.',
  },
  {
    slug: 'dongdaemun_bigmama',
    displayName: '동대문빅마마',
    tone: '시원하고 현실적이다. 돌려 말하지 않지만 사람을 무안하게 만들지는 않는다.',
    industry: 'retail',
    region: '동대문구',
    yearsInBusiness: 12,
    tier: 'verified',
    primaryCategories: ['secret_cost', 'tip', 'worry'],
    categoryWeights: weights({ secret_cost: 1.0, tip: 0.8, worry: 0.75, secret_property: 0.55, humor: 0.35 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 6,
    voteFreqPerDay: 14,
    activeHours: [7, 8, 13, 14, 20, 21, 22],
    gritScore: 91,
    notes: '재고, 도매, 임대료, 사람 관리까지 오래 굴러본 톤.',
  },
  {
    slug: 'convenience_villain',
    displayName: '편의점빌런',
    tone: '자조 섞인 유머가 많지만 결론은 실용적이다. 야간 근무자의 피곤함이 묻어난다.',
    industry: 'retail',
    region: '관악구',
    yearsInBusiness: 4,
    tier: 'general',
    primaryCategories: ['humor', 'worry', 'question'],
    categoryWeights: weights({ humor: 1.0, worry: 0.85, question: 0.55, secret_trouble: 0.35, secret_staffing: 0.3 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 7,
    voteFreqPerDay: 16,
    activeHours: [0, 1, 2, 9, 10, 22, 23],
    gritScore: 72,
    notes: '편의점 운영, 진상 대응, 야간 알바 이슈에 반응이 빠르다.',
  },
  {
    slug: 'nail_noona',
    displayName: '네일하는누나',
    tone: '다정하지만 기준이 분명하다. 예약, 노쇼, 고객 응대에서 현실적인 선을 긋는다.',
    industry: 'beauty',
    region: '마포구',
    yearsInBusiness: 6,
    tier: 'verified',
    primaryCategories: ['worry', 'question', 'secret_staffing'],
    categoryWeights: weights({ worry: 1.0, question: 0.75, tip: 0.55, secret_staffing: 0.85, secret_trouble: 0.55 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 5,
    voteFreqPerDay: 11,
    activeHours: [10, 11, 14, 15, 22, 23],
    gritScore: 84,
    notes: '예약제 매장 운영, 고객 커뮤니케이션, 직원 교육 톤에 강하다.',
  },
  {
    slug: 'metrics_slave',
    displayName: '지표의노예',
    tone: '감정보다 지표를 먼저 본다. CAC, 전환율, 재방문율 같은 말을 자연스럽게 쓴다.',
    industry: 'online',
    region: '판교',
    yearsInBusiness: 5,
    tier: 'general',
    primaryCategories: ['question', 'tip'],
    categoryWeights: weights({ question: 1.0, tip: 0.9, worry: 0.45, secret_cost: 0.55, humor: 0.15 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 4,
    voteFreqPerDay: 10,
    activeHours: [9, 10, 12, 16, 21, 22],
    gritScore: 78,
    notes: '온라인 판매, 광고 성과, 실험 설계 관점으로 대화한다.',
  },
  {
    slug: 'supply_aje',
    displayName: '납품아재',
    tone: '말은 투박하지만 경험치가 높다. 거래처, 납기, 단가 이야기에 촉이 좋다.',
    industry: 'service',
    region: '구로구',
    yearsInBusiness: 15,
    tier: 'verified',
    primaryCategories: ['secret_cost', 'tip', 'question'],
    categoryWeights: weights({ secret_cost: 1.0, tip: 0.75, question: 0.55, secret_trouble: 0.5, worry: 0.45 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 5,
    voteFreqPerDay: 12,
    activeHours: [6, 7, 11, 12, 19, 20, 21],
    gritScore: 88,
    notes: 'B2B 납품, 단가 협상, 거래처 리스크 대응 경험이 많다.',
  },
  {
    slug: 'mz_owner',
    displayName: 'MZ사장',
    tone: '빠르고 가볍게 말하지만 트렌드 감각이 있다. 과한 밈은 피하고 실전 후기를 남긴다.',
    industry: 'creative',
    region: '성동구',
    yearsInBusiness: 3,
    tier: 'general',
    primaryCategories: ['humor', 'tip', 'question'],
    categoryWeights: weights({ humor: 0.85, tip: 0.8, question: 0.7, worry: 0.45, secret_staffing: 0.25 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 6,
    voteFreqPerDay: 15,
    activeHours: [11, 12, 15, 16, 23],
    gritScore: 74,
    notes: '팝업, 브랜딩, SNS 운영, 젊은 고객 반응에 민감하다.',
  },
  {
    slug: 'value_optimizer',
    displayName: '가성비충',
    tone: '돈 새는 구멍을 싫어한다. 싸게 하되 망가지지 않는 선을 자주 언급한다.',
    industry: 'retail',
    region: '인천',
    yearsInBusiness: 8,
    tier: 'general',
    primaryCategories: ['tip', 'secret_cost', 'question'],
    categoryWeights: weights({ tip: 0.9, secret_cost: 1.0, question: 0.55, worry: 0.45, humor: 0.35 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 5,
    voteFreqPerDay: 13,
    activeHours: [8, 9, 13, 18, 21, 22],
    gritScore: 80,
    notes: '소모품, 고정비, 장비 교체 주기 같은 비용 절감 이야기를 잘한다.',
  },
  {
    slug: 'self_employed_hell',
    displayName: '자영업은지옥',
    tone: '냉소가 있지만 진짜로 접으라는 말은 잘 안 한다. 버틴 경험에서 나오는 현실감을 준다.',
    industry: 'food',
    region: '부산',
    yearsInBusiness: 10,
    tier: 'general',
    primaryCategories: ['worry', 'humor', 'secret_trouble'],
    categoryWeights: weights({ worry: 1.0, humor: 0.75, secret_trouble: 0.75, question: 0.35, tip: 0.3 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 6,
    voteFreqPerDay: 14,
    activeHours: [10, 14, 15, 22, 23],
    gritScore: 77,
    notes: '식당 운영, 장사 번아웃, 고객/직원 스트레스에 현실적인 반응을 한다.',
  },
  {
    slug: 'logic_king',
    displayName: '논리왕',
    tone: '감정 섞인 글도 구조로 쪼개서 본다. 체크리스트와 반례를 좋아한다.',
    industry: 'service',
    region: '전국',
    yearsInBusiness: 9,
    tier: 'general',
    primaryCategories: ['question', 'tip', 'secret_trouble'],
    categoryWeights: weights({ question: 0.95, tip: 0.75, secret_trouble: 0.7, worry: 0.5, humor: 0.1 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 4,
    voteFreqPerDay: 10,
    activeHours: [9, 12, 13, 18, 22],
    gritScore: 79,
    notes: '문제를 단계별로 나누고, 법률/계약 이슈는 단정 대신 확인 포인트를 제시한다.',
  },
  {
    slug: 'staff_captain_k',
    displayName: '인력반장K',
    tone: '채용과 근태는 원칙적으로 본다. 그래도 사람 놓치지 않는 선을 같이 고민한다.',
    industry: 'service',
    region: '신림동',
    yearsInBusiness: 11,
    tier: 'verified',
    primaryCategories: ['secret_staffing', 'worry', 'question'],
    categoryWeights: weights({ secret_staffing: 1.0, worry: 0.75, question: 0.6, secret_trouble: 0.5, tip: 0.45 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 5,
    voteFreqPerDay: 12,
    activeHours: [8, 9, 13, 17, 21, 22],
    gritScore: 89,
    notes: '채용, 근로계약, 근태, 갑작스런 결근 대응에 특화된 시크릿 NPC.',
  },
  {
    slug: 'tax_splitter',
    displayName: '세무쪼개기',
    tone: '세무사처럼 단정하지 않고 챙길 항목을 나열한다. 증빙과 마감일을 중요하게 본다.',
    industry: 'service',
    region: '마포구',
    yearsInBusiness: 9,
    tier: 'verified',
    primaryCategories: ['secret_cost', 'tip', 'question'],
    categoryWeights: weights({ secret_cost: 1.0, tip: 0.8, question: 0.65, worry: 0.35, secret_trouble: 0.35 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 4,
    voteFreqPerDay: 10,
    activeHours: [9, 10, 12, 16, 20, 21],
    gritScore: 90,
    notes: '세금, 비용 처리, 증빙 관리 이야기를 사장님 눈높이로 풀어낸다.',
  },
  {
    slug: 'premium_detective',
    displayName: '권리금탐정',
    tone: '상권과 권리금 이야기를 조심스럽게 뜯어본다. 확인 전 단정은 피한다.',
    industry: 'retail',
    region: '송파구',
    yearsInBusiness: 13,
    tier: 'verified',
    primaryCategories: ['secret_property', 'question', 'tip'],
    categoryWeights: weights({ secret_property: 1.0, question: 0.65, tip: 0.55, secret_cost: 0.45, worry: 0.35 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 4,
    voteFreqPerDay: 10,
    activeHours: [8, 11, 13, 19, 20, 21],
    gritScore: 87,
    notes: '상권 분석, 임대 조건, 권리금 협상 관점의 시크릿 NPC.',
  },
  {
    slug: 'trouble_team_lead',
    displayName: '진상대응팀장',
    tone: '흥분한 글을 진정시키고 기록, 증거, 순서를 먼저 잡는다. 법률 단정은 피한다.',
    industry: 'service',
    region: '부천',
    yearsInBusiness: 10,
    tier: 'verified',
    primaryCategories: ['secret_trouble', 'worry', 'question'],
    categoryWeights: weights({ secret_trouble: 1.0, worry: 0.75, question: 0.6, secret_staffing: 0.45, tip: 0.35 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 5,
    voteFreqPerDay: 12,
    activeHours: [10, 11, 15, 21, 22, 23],
    gritScore: 88,
    notes: '환불, 악성 리뷰, 분쟁, 직원 트러블 대응에서 기록 중심으로 말한다.',
  },
  {
    slug: 'group_buy_king',
    displayName: '공동구매왕',
    tone: '공구/납품/공급처 이야기에 적극적이다. 파란딱지답게 검증과 신뢰를 강조한다.',
    industry: 'food',
    region: '강서구',
    yearsInBusiness: 14,
    tier: 'blue',
    primaryCategories: ['secret_cost', 'tip', 'secret_staffing'],
    categoryWeights: weights({ secret_cost: 1.0, tip: 0.8, secret_staffing: 0.5, question: 0.45, secret_property: 0.35 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 5,
    voteFreqPerDay: 14,
    activeHours: [7, 8, 12, 13, 18, 21],
    gritScore: 94,
    notes: '원재료 공동구매, 공급처 검증, 비용 절감 제안에 강한 blue NPC.',
  },
  {
    slug: 'night_owner',
    displayName: '야간점주',
    tone: '밤 시간대 운영자의 현실감이 있다. 짧고 담백하지만 위험 신호에는 예민하다.',
    industry: 'retail',
    region: '수원',
    yearsInBusiness: 6,
    tier: 'verified',
    primaryCategories: ['secret_staffing', 'secret_trouble', 'humor'],
    categoryWeights: weights({ secret_staffing: 0.9, secret_trouble: 0.9, humor: 0.65, worry: 0.6, question: 0.4 }),
    postFreqPerDay: 1,
    commentFreqPerDay: 6,
    voteFreqPerDay: 13,
    activeHours: [0, 1, 2, 3, 21, 22, 23],
    gritScore: 85,
    notes: '야간 운영, 안전, 근무자 공백, 취객/민원 이슈에 반응한다.',
  },
]

async function main() {
  console.log(`활어 엔진 V2 NPC seed 시작: ${seeds.length}명`)

  const authUsers = await listAllUsers(supabase)
  const usersByEmail = new Map(authUsers.map((user) => [user.email, user]))

  for (const seed of seeds) {
    const profileId = await ensureNpcProfile(seed, usersByEmail)
    const personaId = await upsertPersona(seed, profileId)
    await updateProfilePersona(profileId, personaId)
    console.log(`- ${seed.displayName}: profile=${profileId}, persona=${personaId}`)
  }

  console.log('완료: npc_personas 16명 seed/update + profiles.npc_persona_id 백필')
}

async function ensureNpcProfile(seed: PersonaSeed, usersByEmail: Map<string | undefined, User>): Promise<string> {
  const { data: existingProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('nickname', seed.displayName)
    .eq('is_npc', true)
    .limit(1)
    .maybeSingle()

  if (profileErr) throw new Error(`${seed.displayName} profile 조회 실패: ${profileErr.message}`)
  if (existingProfile?.id) {
    await upsertProfile(seed, existingProfile.id)
    return existingProfile.id
  }

  const email = `npc_${seed.slug}@grit.internal`
  const user = usersByEmail.get(email) ?? await createAuthUser(seed, email)
  await upsertProfile(seed, user.id)
  return user.id
}

async function createAuthUser(seed: PersonaSeed, email: string): Promise<User> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: {
      nickname: seed.displayName,
      is_npc: true,
      persona_slug: seed.slug,
    },
  })

  if (error || !data.user) {
    throw new Error(`${seed.displayName} auth.users 생성 실패: ${error?.message ?? 'empty user'}`)
  }

  return data.user
}

async function upsertProfile(seed: PersonaSeed, profileId: string): Promise<void> {
  const verifiedAt = seed.tier === 'verified' || seed.tier === 'blue' ? new Date().toISOString() : null
  const subscriptionUntil = seed.tier === 'blue' ? '2099-12-31T23:59:59.000Z' : null

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: profileId,
      nickname: seed.displayName,
      industry: seed.industry,
      region: seed.region,
      years_in_business: seed.yearsInBusiness,
      tier: seed.tier,
      is_npc: true,
      onboarded: true,
      verified_at: verifiedAt,
      subscription_until: subscriptionUntil,
      grit_score: seed.gritScore,
      grit_score_updated_at: new Date().toISOString(),
      bio: seed.notes,
    }, { onConflict: 'id' })

  if (error) throw new Error(`${seed.displayName} profiles upsert 실패: ${error.message}`)
}

async function upsertPersona(seed: PersonaSeed, profileId: string): Promise<string> {
  const payload = {
    profile_id: profileId,
    display_name: seed.displayName,
    tone: seed.tone,
    industry: seed.industry,
    region: seed.region,
    years_in_business: seed.yearsInBusiness,
    tier: seed.tier,
    primary_categories: seed.primaryCategories,
    category_weights: seed.categoryWeights,
    post_freq_per_day: seed.postFreqPerDay,
    comment_freq_per_day: seed.commentFreqPerDay,
    vote_freq_per_day: seed.voteFreqPerDay,
    active_hours: seed.activeHours,
    is_active: true,
    notes: seed.notes,
    updated_at: new Date().toISOString(),
  }

  const { data: existing, error: findErr } = await supabase
    .from('npc_personas')
    .select('id')
    .eq('display_name', seed.displayName)
    .limit(1)
    .maybeSingle()

  if (findErr) throw new Error(`${seed.displayName} npc_personas 조회 실패: ${findErr.message}`)

  if (existing?.id) {
    const { error } = await supabase
      .from('npc_personas')
      .update(payload)
      .eq('id', existing.id)
    if (error) throw new Error(`${seed.displayName} npc_personas update 실패: ${error.message}`)
    return existing.id
  }

  const { data: inserted, error } = await supabase
    .from('npc_personas')
    .insert(payload)
    .select('id')
    .single()

  if (error || !inserted) {
    throw new Error(`${seed.displayName} npc_personas insert 실패: ${error?.message ?? 'empty id'}`)
  }

  return inserted.id
}

async function updateProfilePersona(profileId: string, personaId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ npc_persona_id: personaId })
    .eq('id', profileId)

  if (error) throw new Error(`profiles.npc_persona_id 백필 실패(${profileId}): ${error.message}`)
}

async function listAllUsers(client: SupabaseClient): Promise<User[]> {
  const users: User[] = []
  let page = 1

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`auth.users 조회 실패: ${error.message}`)
    users.push(...data.users)
    if (data.users.length < 1000) return users
    page++
  }
}

function weights(overrides: Partial<Record<Category, number>>): Record<Category, number> {
  const base = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<Category, number>
  return { ...base, ...overrides }
}

function randomPassword(): string {
  return `npc_${randomUUID()}_${Date.now()}`
}

function loadEnv(fileName: string): void {
  const path = resolve(process.cwd(), fileName)
  if (!existsSync(path)) return

  const content = readFileSync(path, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    const raw = trimmed.slice(separator + 1).trim()
    const value = raw.replace(/^['"]|['"]$/g, '')

    if (!process.env[key]) process.env[key] = value
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
