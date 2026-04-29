import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

type Surface = 'feed' | 'secret_lounge'
type Category =
  | 'humor'
  | 'worry'
  | 'question'
  | 'tip'
  | 'secret_staffing'
  | 'secret_cost'
  | 'secret_property'
  | 'secret_trouble'
type ActionType = 'post' | 'comment' | 'reply' | 'reaction_like' | 'reaction_dislike'

interface EngineContext {
  client: SupabaseClient
  request: Request
  dryRun: boolean
}

interface Persona {
  id: string
  profile_id: string
  display_name: string
  tone: string
  industry: string
  region: string | null
  years_in_business: number | null
  tier: 'guest' | 'general' | 'verified' | 'blue'
  primary_categories: Category[]
  category_weights: Record<string, number>
  post_freq_per_day: number
  comment_freq_per_day: number
  vote_freq_per_day: number
  active_hours: number[]
  is_active: boolean
  notes: string | null
}

interface BacklogItem {
  id: string
  target_surface: Surface
  category: Category
  source_title: string | null
  source_body: string | null
  source_comments: unknown
  risk_level: 'low' | 'medium' | 'high'
  assigned_persona_id: string | null
  scheduled_for: string | null
}

interface PostTarget {
  id: string
  title: string
  body: string
  category: Category
  comment_count: number
  like_count: number
  created_at: string
  author_id: string
}

interface CommentTarget {
  id: string
  post_id: string
  body: string
  like_count: number
  created_at: string
  author_id: string
}

const PUBLIC_CATEGORIES: Category[] = ['humor', 'worry', 'question', 'tip']
const SECRET_CATEGORIES: Category[] = ['secret_staffing', 'secret_cost', 'secret_property', 'secret_trouble']
const PROJECT_REF = 'lqotquxmmrshikevqnsg'

/** 한글 주석: Edge Function 공통 핸들러 - 인증/에러 응답/요약 포맷을 통일한다. */
export async function handleEngineRequest(
  request: Request,
  jobName: string,
  runner: (ctx: EngineContext) => Promise<Record<string, unknown>>,
): Promise<Response> {
  try {
    assertCronAuthorized(request)

    const body = request.method === 'POST' ? await safeJson(request) : {}
    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1' || body.dryRun === true
    const client = createAdminClient()
    const summary = await runner({ client, request, dryRun })

    return json({
      success: true,
      job: jobName,
      dryRun,
      summary,
      ranAt: new Date().toISOString(),
    })
  } catch (e) {
    const status = e instanceof ResponseError ? e.status : 500
    return json({
      success: false,
      job: jobName,
      error: e instanceof Error ? e.message : String(e),
    }, status)
  }
}

/** 한글 주석: content_backlog → posts 발행 잡. */
export async function runPostPublisher(
  client: SupabaseClient,
  { surface, dryRun = false }: { surface: Surface; dryRun?: boolean },
): Promise<Record<string, unknown>> {
  if (isEngineDisabled(surface)) return { skipped: true, reason: 'activity engine disabled' }

  const ratio = await getNpcPostRatio(client, surface)
  const maxRatio = Number(Deno.env.get('MAX_NPC_RATIO') ?? '0.7')
  if (surface === 'feed' && ratio.totalPosts >= 10 && ratio.npcRatio >= maxRatio) {
    return { skipped: true, reason: 'max npc ratio reached', ...ratio, maxRatio }
  }

  const now = new Date().toISOString()
  const { data: backlog, error: backlogErr } = await client
    .from('content_backlog')
    .select('*')
    .eq('status', 'queued')
    .eq('target_surface', surface)
    .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
    .order('scheduled_for', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (backlogErr) throw new Error(`content_backlog 조회 실패: ${backlogErr.message}`)
  if (!backlog) return { published: 0, reason: 'queued backlog empty', surface }

  const item = backlog as BacklogItem
  const persona = item.assigned_persona_id
    ? await getPersona(client, item.assigned_persona_id)
    : await pickPersona(client, {
      surface,
      category: item.category,
      actionType: 'post',
      count: 1,
      excludeRecentPost: true,
    }).then((xs) => xs[0] ?? null)

  if (!persona?.profile_id) {
    return { published: 0, reason: 'eligible persona empty', backlogId: item.id, surface }
  }

  const sourceComments = toStringArray(item.source_comments)
  const generated = await generatePostDraft(item, persona, sourceComments)
  const seedLikes = randInt(1, 4)
  const seedBookmarks = randInt(0, 2)
  const seedQuotes = Math.random() < 0.18 ? 1 : 0

  if (dryRun) {
    return {
      published: 0,
      dryRun: true,
      backlogId: item.id,
      persona: persona.display_name,
      draft: generated,
      seedLikes,
      seedBookmarks,
      seedQuotes,
    }
  }

  const { data: inserted, error: insertErr } = await client
    .from('posts')
    .insert({
      author_id: persona.profile_id,
      title: generated.title,
      body: generated.body,
      category: item.category,
      image_urls: [],
      like_count: seedLikes,
      bookmark_count: seedBookmarks,
      quote_count: seedQuotes,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    throw new Error(`posts INSERT 실패: ${insertErr?.message ?? 'empty result'}`)
  }

  await client
    .from('content_backlog')
    .update({
      status: 'published',
      assigned_persona_id: persona.id,
      published_post_id: inserted.id,
      published_at: new Date().toISOString(),
    })
    .eq('id', item.id)

  await logActivity(client, {
    personaId: persona.id,
    actionType: 'post',
    targetType: 'post',
    targetId: inserted.id,
    surface,
  })

  return {
    published: 1,
    postId: inserted.id,
    backlogId: item.id,
    persona: persona.display_name,
    category: item.category,
    seedLikes,
    seedBookmarks,
    seedQuotes,
  }
}

/** 한글 주석: V1 4-Layer 댓글 픽 로직을 V2 스키마로 포팅한 잡. */
export async function runCommentBot(
  client: SupabaseClient,
  { surface, dryRun = false }: { surface: Surface; dryRun?: boolean },
): Promise<Record<string, unknown>> {
  if (isEngineDisabled(surface)) return { skipped: true, reason: 'activity engine disabled' }

  const post = await pickTargetPost(client, surface)
  if (!post) return { commentsCreated: 0, reason: 'target post empty', surface }

  const existingNpcComments = await countNpcCommentsOnPost(client, post.id)
  if (existingNpcComments >= 3) {
    return { commentsCreated: 0, reason: 'npc comment cap reached', postId: post.id, existingNpcComments }
  }

  const desiredPool = Math.min(3 - existingNpcComments, decideNpcPoolSize(post))
  const personas = await pickPersona(client, {
    surface,
    category: post.category,
    actionType: 'comment',
    count: desiredPool,
    excludeProfileIds: [post.author_id],
  })

  if (personas.length === 0) {
    return { commentsCreated: 0, reason: 'eligible persona empty', postId: post.id }
  }

  const sourceComments = await getSourceCommentsForPost(client, post.id)
  const rootComments = await getRootComments(client, post.id)
  const created: Array<{ persona: string; type: 'comment' | 'reply'; id?: string }> = []
  let errors = 0

  for (const persona of personas) {
    const canReply = rootComments.length > 0 && Math.random() < 0.3
    const parent = canReply ? pickRandom(rootComments) : null
    const actionType: ActionType = parent ? 'reply' : 'comment'
    const text = await generateCommentDraft(post, persona, sourceComments, parent?.body ?? null)

    if (dryRun) {
      created.push({ persona: persona.display_name, type: parent ? 'reply' : 'comment' })
      continue
    }

    const { data: inserted, error: insertErr } = await client
      .from('comments')
      .insert({
        post_id: post.id,
        parent_id: parent?.id ?? null,
        author_id: persona.profile_id,
        body: text,
      })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      errors++
      continue
    }

    await logActivity(client, {
      personaId: persona.id,
      actionType,
      targetType: 'comment',
      targetId: inserted.id,
      surface,
    })
    created.push({ persona: persona.display_name, type: parent ? 'reply' : 'comment', id: inserted.id })
  }

  return {
    postId: post.id,
    postTitle: post.title,
    npcPool: personas.length,
    commentsCreated: dryRun ? 0 : created.length,
    dryRunCreated: dryRun ? created.length : 0,
    errors,
    created,
  }
}

/** 한글 주석: reactions UNIQUE 제약을 지키며 글/댓글에 seed 반응을 만든다. */
export async function runVoteBot(
  client: SupabaseClient,
  { surface, dryRun = false }: { surface: Surface; dryRun?: boolean },
): Promise<Record<string, unknown>> {
  if (isEngineDisabled(surface)) return { skipped: true, reason: 'activity engine disabled' }

  const postTargets = await getVotePostTargets(client, surface)
  const commentTargets = await getVoteCommentTargets(client, surface, postTargets.map((p) => p.id))
  const targetPostVotes = Math.min(postTargets.length, randInt(3, 8))
  const targetCommentVotes = Math.min(commentTargets.length, randInt(1, 4))
  let postVotesCreated = 0
  let commentVotesCreated = 0
  let duplicatesSkipped = 0
  let errors = 0

  for (let i = 0; i < targetPostVotes; i++) {
    const target = weightedPick(postTargets, postTargets.map((p) => voteTargetWeight(p.created_at, p.like_count)))
    const result = await createReactionSeed(client, {
      surface,
      targetType: 'post',
      targetId: target.id,
      category: target.category,
      dryRun,
    })
    if (result === 'created') postVotesCreated++
    else if (result === 'duplicate') duplicatesSkipped++
    else errors++
  }

  for (let i = 0; i < targetCommentVotes; i++) {
    const target = weightedPick(commentTargets, commentTargets.map((c) => voteTargetWeight(c.created_at, c.like_count)))
    const result = await createReactionSeed(client, {
      surface,
      targetType: 'comment',
      targetId: target.id,
      category: surface === 'secret_lounge' ? 'secret_trouble' : 'worry',
      dryRun,
    })
    if (result === 'created') commentVotesCreated++
    else if (result === 'duplicate') duplicatesSkipped++
    else errors++
  }

  return {
    postTargets: postTargets.length,
    commentTargets: commentTargets.length,
    targetPostVotes,
    targetCommentVotes,
    postVotesCreated,
    commentVotesCreated,
    duplicatesSkipped,
    errors,
    dryRun,
  }
}

/** 한글 주석: 시크릿 라운지 전용 통합 잡 - 발행/댓글/보팅을 verified+ NPC로만 수행한다. */
export async function runSecretLoungeBot(
  client: SupabaseClient,
  { dryRun = false }: { dryRun?: boolean },
): Promise<Record<string, unknown>> {
  if (isEngineDisabled('secret_lounge')) return { skipped: true, reason: 'secret bot disabled' }

  const publish = await runPostPublisher(client, { surface: 'secret_lounge', dryRun })
  const comments = await runCommentBot(client, { surface: 'secret_lounge', dryRun })
  const votes = await runVoteBot(client, { surface: 'secret_lounge', dryRun })

  return { publish, comments, votes }
}

function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? `https://${PROJECT_REF}.supabase.co`
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-activity-engine': 'v2' } },
  })
}

function assertCronAuthorized(request: Request): void {
  const secret = Deno.env.get('ACTIVITY_ENGINE_CRON_SECRET') ?? Deno.env.get('CRON_SECRET') ?? ''
  if (!secret) return

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const cronSecret = request.headers.get('x-cron-secret')
  if (bearer === secret || cronSecret === secret) return
  throw new ResponseError('인증 실패', 401)
}

function isEngineDisabled(surface: Surface): boolean {
  if (Deno.env.get('DISABLE_ACTIVITY_ENGINE') === 'true') return true
  if (surface === 'secret_lounge' && Deno.env.get('DISABLE_SECRET_BOT') === 'true') return true
  return false
}

async function safeJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

class ResponseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function getPersona(client: SupabaseClient, id: string): Promise<Persona | null> {
  const { data, error } = await client.from('npc_personas').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`npc_personas 조회 실패: ${error.message}`)
  return data as Persona | null
}

async function pickPersona(
  client: SupabaseClient,
  {
    surface,
    category,
    actionType,
    count,
    excludeProfileIds = [],
    excludeRecentPost = false,
  }: {
    surface: Surface
    category: Category
    actionType: ActionType
    count: number
    excludeProfileIds?: string[]
    excludeRecentPost?: boolean
  },
): Promise<Persona[]> {
  const { data, error } = await client.from('npc_personas').select('*').eq('is_active', true)
  if (error) throw new Error(`npc_personas 조회 실패: ${error.message}`)

  const hour = getKstHour()
  let candidates = ((data ?? []) as Persona[])
    .filter((p) => p.profile_id && !excludeProfileIds.includes(p.profile_id))
    .filter((p) => isSurfaceEligible(p, surface))
    .filter((p) => !p.active_hours?.length || p.active_hours.includes(hour))

  if (excludeRecentPost && candidates.length > 0) {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: recent } = await client
      .from('npc_activity_log')
      .select('persona_id')
      .eq('action_type', 'post')
      .eq('surface', surface)
      .gte('created_at', since)
      .in('persona_id', candidates.map((p) => p.id))
    const recentIds = new Set((recent ?? []).map((x: { persona_id: string }) => x.persona_id))
    candidates = candidates.filter((p) => !recentIds.has(p.id))
  }

  if (candidates.length === 0) return []

  const loadScores = await getLoadScores(client, actionType, surface)
  const weights = candidates.map((p) => {
    const categoryScore = Math.max(0.05, Number(p.category_weights?.[category] ?? 0.1))
    const loadScore = loadScores.get(p.id) ?? 1
    const primaryBoost = p.primary_categories?.includes(category) ? 1.4 : 1
    return categoryScore * loadScore * primaryBoost
  })

  return weightedPickMultiple(candidates, weights, count)
}

function isSurfaceEligible(persona: Persona, surface: Surface): boolean {
  if (surface === 'secret_lounge') return persona.tier === 'verified' || persona.tier === 'blue'
  return true
}

async function getLoadScores(
  client: SupabaseClient,
  actionType: ActionType,
  surface: Surface,
): Promise<Map<string, number>> {
  const { data, error } = await client.rpc('get_npc_load_balance', {
    p_action_type: actionType,
    p_surface: surface,
  })
  if (error) return new Map()

  return new Map((data ?? []).map((row: { persona_id: string; load_score: number | string }) => [
    row.persona_id,
    Number(row.load_score),
  ]))
}

async function getNpcPostRatio(
  client: SupabaseClient,
  surface: Surface,
): Promise<{ totalPosts: number; npcPosts: number; npcRatio: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const categories = categoriesForSurface(surface)
  const { count: totalPosts } = await client
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
    .in('category', categories)
    .eq('is_deleted', false)

  const { data: personas } = await client.from('npc_personas').select('profile_id').not('profile_id', 'is', null)
  const profileIds = (personas ?? []).map((p: { profile_id: string }) => p.profile_id)
  if (profileIds.length === 0) return { totalPosts: totalPosts ?? 0, npcPosts: 0, npcRatio: 0 }

  const { count: npcPosts } = await client
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
    .in('category', categories)
    .in('author_id', profileIds)
    .eq('is_deleted', false)

  return {
    totalPosts: totalPosts ?? 0,
    npcPosts: npcPosts ?? 0,
    npcRatio: totalPosts ? (npcPosts ?? 0) / totalPosts : 0,
  }
}

async function generatePostDraft(
  item: BacklogItem,
  persona: Persona,
  sourceComments: string[],
): Promise<{ title: string; body: string }> {
  const fallbackTitle = cleanText(item.source_title ?? categoryLabel(item.category)).slice(0, 50)
  const fallbackBody = cleanText(
    item.source_body ?? `${persona.display_name} 관점에서 ${categoryLabel(item.category)} 이야기를 남겨봅니다.`,
  )
  const system = buildSystemPrompt(persona, item.target_surface, item.category)
  const comments = sourceComments.slice(0, 5).map((c, i) => `${i + 1}. ${c}`).join('\n')
  const user = [
    `아래 재료를 GRIT V2 게시글로 재작성해.`,
    `카테고리: ${item.category}`,
    `원제목: ${item.source_title ?? '(없음)'}`,
    `원본문: ${(item.source_body ?? '').slice(0, 1200)}`,
    comments ? `원본 댓글 분위기:\n${comments}` : '',
    `출력은 JSON으로만: {"title":"50자 이내","body":"본문"}`,
  ].filter(Boolean).join('\n\n')

  const generated = await generateText(system, user)
  if (!generated) return { title: fallbackTitle, body: enforceSafety(fallbackBody, item.category) }

  const parsed = parseJsonObject(generated)
  const title = cleanText(String(parsed?.title ?? fallbackTitle)).slice(0, 50)
  const body = enforceSafety(cleanText(String(parsed?.body ?? generated)), item.category).slice(0, 2000)
  return { title: title || fallbackTitle, body: body || fallbackBody }
}

async function generateCommentDraft(
  post: PostTarget,
  persona: Persona,
  sourceComments: string[],
  parentBody: string | null,
): Promise<string> {
  const system = buildSystemPrompt(persona, categorySurface(post.category), post.category)
  const rag = sourceComments.slice(0, 4).join('\n---\n')
  const prompt = [
    `아래 글에 ${parentBody ? '대댓글' : '댓글'} 1개만 달아.`,
    `제목: ${post.title}`,
    `본문: ${post.body.slice(0, 900)}`,
    parentBody ? `반응할 댓글: ${parentBody.slice(0, 300)}` : '',
    rag ? `참고 댓글 분위기:\n${rag}` : '',
    `본문만 출력. 1~3문장. AI 티 금지.`,
  ].filter(Boolean).join('\n\n')

  const generated = await generateText(system, prompt)
  const fallback = `${
    persona.region ?? '현장'
  }에서 비슷한 일 겪어봤는데, 이건 숫자보다 흐름을 먼저 봐야 하더라. 사장님들 의견도 궁금함.`
  return enforceSafety(cleanText(generated ?? fallback), post.category).slice(0, 500)
}

async function generateText(system: string, user: string): Promise<string | null> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  if (anthropicKey) {
    const result = await callAnthropic(anthropicKey, system, user)
    if (result) return result
  }

  const openAiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
  if (openAiKey) {
    const result = await callOpenAI(openAiKey, system, user)
    if (result) return result
  }

  return null
}

async function callAnthropic(apiKey: string, system: string, user: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-3-5-haiku-latest',
        max_tokens: 700,
        temperature: 0.8,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.content?.[0]?.text ?? null
  } catch {
    return null
  }
}

async function callOpenAI(apiKey: string, system: string, user: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
        temperature: 0.8,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  }
}

function buildSystemPrompt(persona: Persona, surface: Surface, category: Category): string {
  const secretRule = surface === 'secret_lounge'
    ? '시크릿 라운지 글이다. 실명, 상호, 정확한 주소, 사업자번호 같은 민감정보는 만들지 마.'
    : '공개 피드 글이다. 누구나 읽어도 괜찮은 운영 이야기로 써.'
  const troubleRule = category === 'secret_trouble' ? '법률 단정 금지. 반드시 경험 공유와 확인 필요 톤으로 말해.' : ''

  return [
    `너는 GRIT 커뮤니티의 실제 사장님 "${persona.display_name}"이다.`,
    `업종: ${persona.industry}, 지역: ${persona.region ?? '전국'}, 연차: ${persona.years_in_business ?? '?'}년.`,
    `말투: ${persona.tone}`,
    persona.notes ? `배경: ${persona.notes}` : '',
    secretRule,
    troubleRule,
    'AI, 봇, NPC라는 표현 금지. 과한 홍보/전문가 행세 금지.',
  ].filter(Boolean).join('\n')
}

async function pickTargetPost(client: SupabaseClient, surface: Surface): Promise<PostTarget | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await client
    .from('posts')
    .select('id,title,body,category,comment_count,like_count,created_at,author_id')
    .gte('created_at', thirtyDaysAgo)
    .lt('comment_count', 25)
    .eq('is_deleted', false)
    .in('category', categoriesForSurface(surface))
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(`타겟 글 조회 실패: ${error.message}`)
  const posts = (data ?? []) as PostTarget[]
  if (posts.length === 0) return null

  const now = Date.now()
  const fresh: PostTarget[] = []
  const mid: PostTarget[] = []
  const old: PostTarget[] = []

  for (const post of posts) {
    const ageMs = now - new Date(post.created_at).getTime()
    if (ageMs <= 24 * 60 * 60 * 1000) fresh.push(post)
    else if (ageMs <= 7 * 24 * 60 * 60 * 1000) mid.push(post)
    else old.push(post)
  }

  const buckets = [
    { items: fresh, weight: 60 },
    { items: mid, weight: 30 },
    { items: old, weight: 10 },
  ].filter((bucket) => bucket.items.length > 0)

  const bucket = weightedPick(buckets, buckets.map((b) => b.weight))
  return weightedPick(bucket.items, bucket.items.map((p) => 1 + Math.max(0, 10 - p.comment_count) * 3))
}

function decideNpcPoolSize(post: PostTarget): number {
  const shortage = Math.max(0, 10 - post.comment_count)
  const roll = Math.random()
  let base = roll < 0.3 ? randInt(1, 2) : roll < 0.8 ? randInt(2, 4) : randInt(4, 5)
  if (shortage >= 8) base += 1
  return Math.min(5, base)
}

async function countNpcCommentsOnPost(client: SupabaseClient, postId: string): Promise<number> {
  const { data: personas } = await client.from('npc_personas').select('profile_id').not('profile_id', 'is', null)
  const ids = (personas ?? []).map((p: { profile_id: string }) => p.profile_id)
  if (ids.length === 0) return 0
  const { count } = await client
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId)
    .in('author_id', ids)
    .eq('is_deleted', false)
  return count ?? 0
}

async function getSourceCommentsForPost(client: SupabaseClient, postId: string): Promise<string[]> {
  const { data } = await client
    .from('content_backlog')
    .select('source_comments')
    .eq('published_post_id', postId)
    .maybeSingle()
  return toStringArray(data?.source_comments)
}

async function getRootComments(client: SupabaseClient, postId: string): Promise<CommentTarget[]> {
  const { data } = await client
    .from('comments')
    .select('id,post_id,body,like_count,created_at,author_id')
    .eq('post_id', postId)
    .is('parent_id', null)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(20)
  return (data ?? []) as CommentTarget[]
}

async function getVotePostTargets(client: SupabaseClient, surface: Surface): Promise<PostTarget[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await client
    .from('posts')
    .select('id,title,body,category,comment_count,like_count,created_at,author_id')
    .gte('created_at', since)
    .eq('is_deleted', false)
    .in('category', categoriesForSurface(surface))
    .order('created_at', { ascending: false })
    .limit(120)
  if (error) throw new Error(`보팅 글 타겟 조회 실패: ${error.message}`)
  return (data ?? []) as PostTarget[]
}

async function getVoteCommentTargets(
  client: SupabaseClient,
  surface: Surface,
  postIds: string[],
): Promise<CommentTarget[]> {
  if (postIds.length === 0) return []
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await client
    .from('comments')
    .select('id,post_id,body,like_count,created_at,author_id')
    .gte('created_at', since)
    .eq('is_deleted', false)
    .in('post_id', postIds)
    .order('created_at', { ascending: false })
    .limit(surface === 'secret_lounge' ? 80 : 160)
  if (error) throw new Error(`보팅 댓글 타겟 조회 실패: ${error.message}`)
  return (data ?? []) as CommentTarget[]
}

async function createReactionSeed(
  client: SupabaseClient,
  {
    surface,
    targetType,
    targetId,
    category,
    dryRun,
  }: {
    surface: Surface
    targetType: 'post' | 'comment'
    targetId: string
    category: Category
    dryRun: boolean
  },
): Promise<'created' | 'duplicate' | 'error'> {
  const reactionType = Math.random() < 0.8 ? 'like' : 'dislike'
  const [persona] = await pickPersona(client, {
    surface,
    category,
    actionType: reactionType === 'like' ? 'reaction_like' : 'reaction_dislike',
    count: 1,
  })
  if (!persona) return 'error'

  const { data: existing } = await client
    .from('reactions')
    .select('id')
    .eq('user_id', persona.profile_id)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle()

  if (existing) return 'duplicate'
  if (dryRun) return 'created'

  const { error } = await client.from('reactions').insert({
    user_id: persona.profile_id,
    target_type: targetType,
    target_id: targetId,
    type: reactionType,
  })

  if (error) {
    if (error.code === '23505') return 'duplicate'
    return 'error'
  }

  await logActivity(client, {
    personaId: persona.id,
    actionType: reactionType === 'like' ? 'reaction_like' : 'reaction_dislike',
    targetType,
    targetId,
    surface,
  })

  return 'created'
}

function voteTargetWeight(createdAt: string, likeCount: number): number {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  const freshness = ageHours < 24 ? 3 : ageHours < 168 ? 1.5 : 1
  const scarcity = 1 / ((likeCount ?? 0) + 2)
  return freshness * scarcity
}

async function logActivity(
  client: SupabaseClient,
  {
    personaId,
    actionType,
    targetType,
    targetId,
    surface,
  }: {
    personaId: string
    actionType: ActionType
    targetType: string
    targetId: string
    surface: Surface
  },
): Promise<void> {
  await client.from('npc_activity_log').insert({
    persona_id: personaId,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    surface,
    engine_version: 'v2',
  })
}

function categoriesForSurface(surface: Surface): Category[] {
  return surface === 'secret_lounge' ? SECRET_CATEGORIES : PUBLIC_CATEGORIES
}

function categorySurface(category: Category): Surface {
  return SECRET_CATEGORIES.includes(category) ? 'secret_lounge' : 'feed'
}

function categoryLabel(category: Category): string {
  const labels: Record<Category, string> = {
    humor: '운영 유머',
    worry: '사장님 고민',
    question: '질문',
    tip: '운영 팁',
    secret_staffing: '인력 운영',
    secret_cost: '비용 절감',
    secret_property: '매물/권리금',
    secret_trouble: '트러블 대응',
  }
  return labels[category]
}

function getKstHour(): number {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours()
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const jsonText = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    return JSON.parse(jsonText)
  } catch {
    return null
  }
}

function enforceSafety(text: string, category: Category): string {
  let next = text
    .replace(/\d{3}-\d{2}-\d{5}/g, '사업자번호는 가렸음')
    .replace(/[가-힣]{2,}(상사|식당|카페|컴퍼니|주식회사)/g, '어느 매장')

  if (category === 'secret_trouble') {
    next = next
      .replace(/무조건 고소/g, '전문가 확인이 먼저일 듯')
      .replace(/불법이다/g, '문제가 될 수 있어 보여')
      .replace(/반드시 이긴다/g, '상황별로 다를 수 있어')
  }

  return next
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0)
  if (total <= 0) return pickRandom(items)
  let cursor = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    cursor -= Math.max(0, weights[i])
    if (cursor <= 0) return items[i]
  }
  return items[items.length - 1]
}

function weightedPickMultiple<T>(items: T[], weights: number[], count: number): T[] {
  const picked: T[] = []
  const pool = [...items]
  const poolWeights = [...weights]
  while (picked.length < count && pool.length > 0) {
    const item = weightedPick(pool, poolWeights)
    const index = pool.indexOf(item)
    picked.push(item)
    pool.splice(index, 1)
    poolWeights.splice(index, 1)
  }
  return picked
}
