-- ─────────────────────────────────────────────────────────────
-- 한글 주석: M011 - 글쓰기 사이클 RLS + 카운터 안전망
--
-- ▣ 목적:
--   - 익명 세션은 읽기만 가능, general 이상만 글/댓글/반응/팔로우 작성 가능
--   - posts/comments/reactions/profiles/storage RLS 누락 보강
--   - reactions 중복 방지 + 좋아요/댓글 카운터 트리거 보강
-- ─────────────────────────────────────────────────────────────

-- 1) tier helper: Supabase 익명 세션은 auth.uid()가 있어도 guest로 취급
CREATE OR REPLACE FUNCTION public.current_user_tier_rank()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 0
    WHEN COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN 0
    ELSE COALESCE((
      SELECT CASE p.tier
        WHEN 'guest'::public.user_tier THEN 0
        WHEN 'general'::public.user_tier THEN 1
        WHEN 'verified'::public.user_tier THEN 2
        WHEN 'blue'::public.user_tier THEN 3
      END
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ), 0)
  END;
$$;

-- 2) profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 한글 주석: tier/인증/카운터/그릿 점수는 클라이언트가 직접 바꾸지 못하게 방어
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND auth.uid() = NEW.id THEN
    IF NEW.tier IS DISTINCT FROM OLD.tier
      OR NEW.business_number IS DISTINCT FROM OLD.business_number
      OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
      OR NEW.subscription_until IS DISTINCT FROM OLD.subscription_until
      OR NEW.is_npc IS DISTINCT FROM OLD.is_npc
      OR NEW.grit_score IS DISTINCT FROM OLD.grit_score
      OR NEW.grit_score_updated_at IS DISTINCT FROM OLD.grit_score_updated_at
      OR NEW.follower_count IS DISTINCT FROM OLD.follower_count
      OR NEW.following_count IS DISTINCT FROM OLD.following_count
    THEN
      RAISE EXCEPTION 'protected profile fields cannot be updated from client';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 3) posts RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select_public" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_general" ON public.posts;
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;

CREATE POLICY "posts_select_public"
  ON public.posts FOR SELECT
  USING (is_deleted = false OR auth.uid() = author_id);

CREATE POLICY "posts_insert_general"
  ON public.posts FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND public.current_user_tier_rank() >= 1
    AND is_deleted = false
  );

CREATE POLICY "posts_update_own"
  ON public.posts FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "posts_delete_own"
  ON public.posts FOR DELETE
  USING (auth.uid() = author_id);

-- 4) comments RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_public" ON public.comments;
DROP POLICY IF EXISTS "comments_insert_general" ON public.comments;
DROP POLICY IF EXISTS "comments_update_own" ON public.comments;
DROP POLICY IF EXISTS "comments_delete_own" ON public.comments;

CREATE POLICY "comments_select_public"
  ON public.comments FOR SELECT
  USING (is_deleted = false OR auth.uid() = author_id);

CREATE POLICY "comments_insert_general"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND public.current_user_tier_rank() >= 1
    AND is_deleted = false
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = public.comments.post_id
        AND p.is_deleted = false
    )
    AND (
      parent_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.comments parent
        WHERE parent.id = public.comments.parent_id
          AND parent.post_id = public.comments.post_id
          AND parent.is_deleted = false
      )
    )
  );

CREATE POLICY "comments_update_own"
  ON public.comments FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "comments_delete_own"
  ON public.comments FOR DELETE
  USING (auth.uid() = author_id);

-- 5) reactions RLS + 중복 방지
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactions_select_own" ON public.reactions;
DROP POLICY IF EXISTS "reactions_insert_own_general" ON public.reactions;
DROP POLICY IF EXISTS "reactions_update_own" ON public.reactions;
DROP POLICY IF EXISTS "reactions_delete_own" ON public.reactions;

CREATE POLICY "reactions_select_own"
  ON public.reactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "reactions_insert_own_general"
  ON public.reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.current_user_tier_rank() >= 1
    AND (
      (target_type = 'post'::public.reaction_target AND EXISTS (
        SELECT 1 FROM public.posts p WHERE p.id = target_id AND p.is_deleted = false
      ))
      OR
      (target_type = 'comment'::public.reaction_target AND EXISTS (
        SELECT 1 FROM public.comments c WHERE c.id = target_id AND c.is_deleted = false
      ))
    )
  );

CREATE POLICY "reactions_update_own"
  ON public.reactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reactions_delete_own"
  ON public.reactions FOR DELETE
  USING (auth.uid() = user_id);

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, target_type, target_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.reactions
)
DELETE FROM public.reactions r
USING ranked d
WHERE r.id = d.id
  AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS reactions_one_per_target_per_user
  ON public.reactions (user_id, target_type, target_id);

-- 6) follows 정책 보강: auth.uid()만 있으면 되는 상태에서 general 이상으로 상향
DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;

CREATE POLICY "follows_insert_own"
  ON public.follows FOR INSERT
  WITH CHECK (
    auth.uid() = follower_id
    AND public.current_user_tier_rank() >= 1
    AND follower_id <> following_id
  );

CREATE POLICY "follows_delete_own"
  ON public.follows FOR DELETE
  USING (
    auth.uid() = follower_id
    AND public.current_user_tier_rank() >= 1
  );

-- 7) 카운터 트리거: reactions / comments 쓰기 성공 후 denormalized count 동기화
CREATE OR REPLACE FUNCTION public.bump_reaction_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.target_type = 'post' THEN
      UPDATE public.posts
      SET
        like_count = like_count + CASE WHEN NEW.type = 'like' THEN 1 ELSE 0 END,
        dislike_count = dislike_count + CASE WHEN NEW.type = 'dislike' THEN 1 ELSE 0 END
      WHERE id = NEW.target_id;
    ELSE
      UPDATE public.comments
      SET
        like_count = like_count + CASE WHEN NEW.type = 'like' THEN 1 ELSE 0 END,
        dislike_count = dislike_count + CASE WHEN NEW.type = 'dislike' THEN 1 ELSE 0 END
      WHERE id = NEW.target_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.target_type = 'post' THEN
      UPDATE public.posts
      SET
        like_count = GREATEST(like_count - CASE WHEN OLD.type = 'like' THEN 1 ELSE 0 END, 0),
        dislike_count = GREATEST(dislike_count - CASE WHEN OLD.type = 'dislike' THEN 1 ELSE 0 END, 0)
      WHERE id = OLD.target_id;
    ELSE
      UPDATE public.comments
      SET
        like_count = GREATEST(like_count - CASE WHEN OLD.type = 'like' THEN 1 ELSE 0 END, 0),
        dislike_count = GREATEST(dislike_count - CASE WHEN OLD.type = 'dislike' THEN 1 ELSE 0 END, 0)
      WHERE id = OLD.target_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.target_type = 'post' THEN
      UPDATE public.posts
      SET
        like_count = GREATEST(like_count - CASE WHEN OLD.type = 'like' THEN 1 ELSE 0 END, 0),
        dislike_count = GREATEST(dislike_count - CASE WHEN OLD.type = 'dislike' THEN 1 ELSE 0 END, 0)
      WHERE id = OLD.target_id;
    ELSE
      UPDATE public.comments
      SET
        like_count = GREATEST(like_count - CASE WHEN OLD.type = 'like' THEN 1 ELSE 0 END, 0),
        dislike_count = GREATEST(dislike_count - CASE WHEN OLD.type = 'dislike' THEN 1 ELSE 0 END, 0)
      WHERE id = OLD.target_id;
    END IF;

    IF NEW.target_type = 'post' THEN
      UPDATE public.posts
      SET
        like_count = like_count + CASE WHEN NEW.type = 'like' THEN 1 ELSE 0 END,
        dislike_count = dislike_count + CASE WHEN NEW.type = 'dislike' THEN 1 ELSE 0 END
      WHERE id = NEW.target_id;
    ELSE
      UPDATE public.comments
      SET
        like_count = like_count + CASE WHEN NEW.type = 'like' THEN 1 ELSE 0 END,
        dislike_count = dislike_count + CASE WHEN NEW.type = 'dislike' THEN 1 ELSE 0 END
      WHERE id = NEW.target_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reactions_count_trigger ON public.reactions;
CREATE TRIGGER reactions_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_reaction_count();

CREATE OR REPLACE FUNCTION public.bump_post_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_deleted = false THEN
      UPDATE public.posts
      SET comment_count = comment_count + 1
      WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_deleted = false THEN
      UPDATE public.posts
      SET comment_count = GREATEST(comment_count - 1, 0)
      WHERE id = OLD.post_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
      UPDATE public.posts
      SET comment_count = GREATEST(comment_count - 1, 0)
      WHERE id = NEW.post_id;
    ELSIF OLD.is_deleted = true AND NEW.is_deleted = false THEN
      UPDATE public.posts
      SET comment_count = comment_count + 1
      WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS comments_count_trigger ON public.comments;
CREATE TRIGGER comments_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_post_comment_count();

-- 8) Storage bucket + RLS
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('post-images', 'post-images', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "storage_post_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "storage_post_images_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "storage_post_images_update_own" ON storage.objects;
DROP POLICY IF EXISTS "storage_post_images_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "storage_avatars_select_public" ON storage.objects;
DROP POLICY IF EXISTS "storage_avatars_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "storage_avatars_update_own" ON storage.objects;
DROP POLICY IF EXISTS "storage_avatars_delete_own" ON storage.objects;

CREATE POLICY "storage_post_images_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-images');

CREATE POLICY "storage_post_images_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'post-images'
    AND public.current_user_tier_rank() >= 1
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_post_images_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'post-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'post-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_post_images_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'post-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_avatars_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "storage_avatars_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND public.current_user_tier_rank() >= 1
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_avatars_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_avatars_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
