// 한글 주석: GRIT V2 홈 피드 훅
//
// ▣ 우선순위:
//   1) Phase 7 RPC(get_feed_ranked)가 있으면 랭킹 ID를 받아온다.
//   2) RPC가 아직 없거나 실패하면 최신순 피드로 조용히 fallback 한다.
// ▣ 칩 필터는 Phase 7 알고리즘 연결 전까지 UI 상태만 유지한다.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { injectMyReaction, mapPosts, type PostRowWithAuthor } from '@/lib/mappers'
import type { FeedFilter, Post } from '@/lib/types'
import type { Tables } from '@/lib/database.types'
import { useAuth } from '@/contexts/AuthContext'

const PAGE_SIZE = 20

type RankedFeedRow = Partial<Tables<'posts'>> & {
  post_id?: string
  relation?: string | null
  social_proof?: string | null
}

type FeedRpcClient = {
  rpc: (
    fn: 'get_feed_ranked',
    args: { p_viewer_id: string | null; p_limit: number; p_offset: number },
  ) => Promise<{ data: RankedFeedRow[] | null; error: { message: string } | null }>
}

export interface UseFeedReturn {
  posts: Post[]
  filter: FeedFilter
  setFilter: (filter: FeedFilter) => void
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  applyPostReaction: (
    postId: string,
    reaction: 'like' | 'dislike' | null,
    likeDelta: number,
    dislikeDelta: number,
  ) => void
}

export function useFeed(): UseFeedReturn {
  const { user, profile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [filter, setFilter] = useState<FeedFilter>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPage = useCallback(
    async (offset: number): Promise<Post[]> => {
      const rankedIds = await fetchRankedIds(user?.id ?? null, PAGE_SIZE, offset)
      const rows = rankedIds.length > 0
        ? await fetchRowsByIds(rankedIds.map((x) => x.id))
        : await fetchLatestRows(PAGE_SIZE, offset)

      const orderedRows = rankedIds.length > 0
        ? orderRows(rows, rankedIds.map((x) => x.id))
        : rows

      let mapped = mapPosts(orderedRows).map((post, idx) => ({
        ...post,
        relation:
          rankedIds[idx]?.relation ??
          rankedIds[idx]?.socialProof ??
          mockSocialProof(post.id),
      }))

      if (user?.id && mapped.length > 0) {
        const { data: myReactions } = await supabase
          .from('reactions')
          .select('target_id, type')
          .eq('user_id', user.id)
          .eq('target_type', 'post')
          .in('target_id', mapped.map((p) => p.id))

        if (myReactions) {
          mapped = injectMyReaction(
            mapped,
            myReactions as { target_id: string; type: 'like' | 'dislike' }[],
          )
        }
      }

      return mapped
    },
    [user?.id],
  )

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const next = await fetchPage(0)
      setPosts(next)
      setHasMore(next.length >= PAGE_SIZE)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '피드를 불러오지 못했어'
      setError(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    if (loading || refreshing || loadingMore || !hasMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const next = await fetchPage(posts.length)
      setPosts((prev) => [...prev, ...next])
      setHasMore(next.length >= PAGE_SIZE)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '다음 피드를 불러오지 못했어'
      setError(msg)
    } finally {
      setLoadingMore(false)
    }
  }, [fetchPage, hasMore, loading, loadingMore, posts.length, refreshing])

  const applyPostReaction = useCallback(
    (
      postId: string,
      reaction: 'like' | 'dislike' | null,
      likeDelta: number,
      dislikeDelta: number,
    ) => {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                myReaction: reaction,
                likeCount: Math.max(0, post.likeCount + likeDelta),
                dislikeCount: Math.max(0, post.dislikeCount + dislikeDelta),
              }
            : post,
        ),
      )
    },
    [],
  )

  useEffect(() => {
    setLoading(true)
    void refresh()
  }, [refresh, filter, profile?.industry, profile?.region])

  return {
    posts,
    filter,
    setFilter,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    applyPostReaction,
  }
}

async function fetchRankedIds(
  viewerId: string | null,
  limit: number,
  offset: number,
): Promise<{ id: string; relation: string | null; socialProof: string | null }[]> {
  try {
    const { data, error } = await (supabase as unknown as FeedRpcClient).rpc(
      'get_feed_ranked',
      { p_viewer_id: viewerId, p_limit: limit, p_offset: offset },
    )

    if (error || !data) return []

    return data
      .map((row) => ({
        id: row.id ?? row.post_id ?? '',
        relation: row.relation ?? null,
        socialProof: row.social_proof ?? null,
      }))
      .filter((row) => row.id.length > 0)
  } catch {
    return []
  }
}

// 한글 주석: PostgREST self-relation cache 이슈 회피
//   posts → posts (quoted_post_id) 자기참조 FK는 PostgREST cache가
//   불안정하게 인식 → quoted nested select 제거.
//   인용글 본문이 필요하면 별도 fetch로 분리 (quoted_post_id로 IN 쿼리).
async function fetchRowsByIds(ids: string[]): Promise<PostRowWithAuthor[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('posts')
    .select('*, author:profiles!author_id(*)')
    .eq('is_deleted', false)
    .in('id', ids)

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PostRowWithAuthor[]
}

async function fetchLatestRows(limit: number, offset: number): Promise<PostRowWithAuthor[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*, author:profiles!author_id(*)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PostRowWithAuthor[]
}

function orderRows(rows: PostRowWithAuthor[], ids: string[]): PostRowWithAuthor[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
}

function mockSocialProof(seed: string): string {
  const n = (seed.charCodeAt(0) % 8) + 2
  return `내 팔로워 ${n}명이 추천했습니다`
}
